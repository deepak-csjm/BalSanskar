import type { PrismaClient } from '@prisma/client';
import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_MEDIA_PER_SCHOOL_PER_MONTH,
  MAX_UPLOAD_BYTES,
  MEDIA_RETENTION_DAYS,
  ORPHAN_UPLOAD_HOURS,
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

  // A monthly ceiling per school, well above what an active school files. It
  // is here so that one misconfigured script cannot put a district's storage
  // bill on the platform in an afternoon — not to ration honest work.
  if (actor.schoolId) {
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const thisMonth = await prisma.mediaAsset.count({
      where: { schoolId: actor.schoolId, createdAt: { gte: monthAgo } },
    });
    if (thisMonth >= MAX_MEDIA_PER_SCHOOL_PER_MONTH) {
      throw new AppError(
        429,
        ERROR_CODES.RATE_LIMITED,
        `This school has added ${MAX_MEDIA_PER_SCHOOL_PER_MONTH} photographs in the last month, which is the limit. Please try again in a few days, or speak to the block office.`,
      );
    }
  }

  const isDocument = (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(input.contentType);
  const key = buildStorageKey({
    scope: actor.schoolId ?? actor.blockId ?? actor.districtId ?? 'state',
    purpose:
      input.purpose === 'CONSENT_DOCUMENT'
        ? 'consent'
        : input.purpose === 'SCHOOL_EVIDENCE'
          ? 'evidence'
          : 'activity',
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
        // Computed in the browser, so the platform can spot a recycled
        // photograph without ever handling the bytes. A client that forges it
        // only ever earns itself a flag it would otherwise have avoided.
        perceptualHash: input.perceptualHash ?? null,
      },
    });
    await recordAudit(tx, audit, {
      action: 'MEDIA_UPLOADED',
      entityType: 'MediaAsset',
      entityId: key,
      schoolId: actor.schoolId,
      blockId: actor.blockId,
      districtId: actor.districtId,
      metadata: {
        purpose: input.purpose,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
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
  olderThanHours = ORPHAN_UPLOAD_HOURS,
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

/**
 * Deletes photographs that have outlived their activity.
 *
 * The largest lever on running cost and the one that keeps it predictable:
 * uploads grow the store, this shrinks it, and after one retention window the
 * two cancel and the bill stops climbing. It is also plain data minimisation —
 * the department's need is to see the work at the time and count it afterwards,
 * and the counts are in the activity record, not in the image.
 *
 * The activity, its write-up, its risk assessment and its clearance trail all
 * survive. Only the pictures go.
 */
export async function expireOldMedia(
  prisma: PrismaClient,
  retentionDays = MEDIA_RETENTION_DAYS,
): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const expired = await prisma.mediaAsset.findMany({
    where: { attachedAt: { not: null, lt: cutoff } },
    select: { id: true, storageKey: true },
    take: 500,
  });

  const storage = getStorage();
  let deleted = 0;
  for (const asset of expired) {
    try {
      await storage.delete(asset.storageKey);
      // The join row goes with it; the activity itself is untouched.
      await prisma.activityMedia.deleteMany({ where: { assetId: asset.id } });
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
      deleted += 1;
    } catch {
      // A file already gone is fine; anything else is retried next run.
    }
  }
  return { deleted };
}
