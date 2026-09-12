import type { PrismaClient } from '@prisma/client';
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  type RequestUploadInput,
  type UploadTicket,
} from '@balsanskar/shared';
import { AppError, ERROR_CODES, forbidden } from '../../lib/errors.js';
import { buildStorageKey, getStorage } from '../../lib/storage.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * Uploads are two-phase: the API issues a ticket, the client sends the bytes
 * straight to storage, then the key is attached to a record.
 *
 * The alternative — proxying file bytes through this process — would put a
 * teacher's slow 3G upload on the API's event loop for thirty seconds at a time,
 * which is exactly the traffic profile this platform will have.
 *
 * The `MediaAsset` row is created up front so an upload that is never attached
 * is visible and can be swept, rather than becoming an untracked object in a
 * bucket nobody audits.
 */
export async function createUploadTicket(
  prisma: PrismaClient,
  actor: Actor,
  input: RequestUploadInput,
  audit: AuditContext,
): Promise<UploadTicket> {
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new AppError(
      413,
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      `Files must be under ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB. Please compress the photo and try again.`,
    );
  }
  if (!actor.schoolId && actor.role !== 'SUPER_ADMIN' && actor.role !== 'STATE_ADMIN') {
    // District and block officers upload against a school context, not their own.
    if (!actor.districtId) throw forbidden('This account cannot upload files');
  }

  const isDocument = (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(input.contentType);
  const key = buildStorageKey({
    scope: actor.schoolId ?? actor.blockId ?? actor.districtId ?? 'state',
    purpose: input.purpose === 'CONSENT_DOCUMENT' ? 'consent' : 'activity',
    contentType: input.contentType,
  });

  const ticket = await getStorage().createUploadTicket({
    key,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });

  await prisma.$transaction(async (tx) => {
    await tx.mediaAsset.create({
      data: {
        storageKey: key,
        kind: isDocument ? 'DOCUMENT' : 'IMAGE',
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        uploadedById: actor.id,
        schoolId: actor.schoolId,
      },
    });
    await recordAudit(tx, audit, {
      action: 'MEDIA_UPLOADED',
      entityType: 'MediaAsset',
      entityId: key,
      schoolId: actor.schoolId,
      blockId: actor.blockId,
      districtId: actor.districtId,
      metadata: { purpose: input.purpose, contentType: input.contentType, sizeBytes: input.sizeBytes },
    });
  });

  return ticket;
}

/**
 * Deletes uploads that were never attached to anything.
 *
 * Run from a scheduled job. Without it, every abandoned form leaves a
 * photograph of a child sitting in the bucket indefinitely.
 */
export async function sweepOrphanedUploads(
  prisma: PrismaClient,
  olderThanHours = 24,
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000);
  const orphans = await prisma.mediaAsset.findMany({
    where: { attachedAt: null, createdAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
    take: 500,
  });

  const storage = getStorage();
  let deleted = 0;
  for (const orphan of orphans) {
    try {
      await storage.delete(orphan.storageKey);
      await prisma.mediaAsset.delete({ where: { id: orphan.id } });
      deleted += 1;
    } catch {
      // A file that has already gone is fine; anything else is retried next run.
    }
  }
  return { deleted };
}
