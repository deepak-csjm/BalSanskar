import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditAction } from '@balsanskar/shared';

export interface AuditContext {
  actorId: string | null;
  actorRole: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  schoolId?: string | null;
  blockId?: string | null;
  districtId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

type Client = PrismaClient | Prisma.TransactionClient;

/**
 * Records a state change.
 *
 * Callers pass the transaction client whenever the change and its audit row must
 * either both land or both roll back — which is the default expectation for
 * anything touching a child's record or a moderation decision. Writing the audit
 * row outside the transaction would leave an unexplained gap in the trail
 * exactly when someone is trying to explain one.
 */
export async function recordAudit(
  db: Client,
  context: AuditContext,
  entry: AuditEntry,
): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorId: context.actorId,
      actorRole: context.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      schoolId: entry.schoolId ?? null,
      blockId: entry.blockId ?? null,
      districtId: entry.districtId ?? null,
      metadata: entry.metadata ?? undefined,
      ip: context.ip,
      userAgent: context.userAgent?.slice(0, 300) ?? null,
    },
  });
}
