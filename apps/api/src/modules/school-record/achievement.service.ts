import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  Achievement,
  CreateAchievementInput,
  ListAchievementsQuery,
  VerifyAchievementInput,
} from '@balsanskar/shared';
import { badRequest, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter, type ScopeFilter } from '../../lib/scope.js';
import { toApiClassLevel, toDbClassLevel } from '../../lib/class-level.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * Individual recognition for a child.
 *
 * Deliberately requires verification by someone other than the person who
 * entered it before it counts anywhere. An unverified achievement is visible to
 * the school that entered it and to nobody else, and it is excluded from every
 * report — otherwise the first block that discovers the leaderboard would win it
 * by typing.
 */

const achievementInclude = {
  creditedTeacher: { select: { fullName: true } },
  school: { select: { id: true, nameHi: true } },
  verifiedBy: { select: { fullName: true } },
} satisfies Prisma.AchievementInclude;

type AchievementRow = Prisma.AchievementGetPayload<{ include: typeof achievementInclude }>;

function toAchievement(row: AchievementRow): Achievement {
  return {
    id: row.id,
    classLevel: toApiClassLevel(row.classLevel),
    childrenRecognised: row.childrenRecognised,
    creditedTeacherName: row.creditedTeacher?.fullName ?? null,
    schoolId: row.schoolId,
    schoolName: row.school.nameHi,
    category: row.category,
    level: row.level,
    title: row.title,
    description: row.description,
    awardedOn: row.awardedOn.toISOString().slice(0, 10),
    position: row.position,
    organiser: row.organiser,
    status: row.status,
    verifiedByName: row.verifiedBy?.fullName ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function scopeToWhere(scope: ScopeFilter): Prisma.AchievementWhereInput {
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.blockId) return { blockId: scope.blockId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

export async function listAchievements(
  prisma: PrismaClient,
  actor: Actor,
  query: ListAchievementsQuery,
): Promise<{ items: Achievement[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const cursorId = decodeCursor(query.cursor);

  const rows = await prisma.achievement.findMany({
    where: {
      ...scopeToWhere(scope),
      ...(query.classLevel ? { classLevel: toDbClassLevel(query.classLevel) } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            awardedOn: {
              ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
              ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    },
    include: achievementInclude,
    orderBy: [{ awardedOn: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  return { items: page.items.map(toAchievement), nextCursor: page.nextCursor };
}

export async function createAchievement(
  prisma: PrismaClient,
  actor: Actor,
  input: CreateAchievementInput,
  audit: AuditContext,
): Promise<Achievement> {
  const { schoolId, blockId, districtId } = actor;
  if (!schoolId || !blockId || !districtId) {
    throw forbidden('Only school staff can record an achievement');
  }

  const created = await prisma.$transaction(async (tx) => {
    const achievement = await tx.achievement.create({
      data: {
        classLevel: toDbClassLevel(input.classLevel),
        childrenRecognised: input.childrenRecognised,
        // The teacher who guided it, which is the whole point of recording it
        // against a school rather than a child.
        creditedTeacherId: actor.id,
        schoolId,
        blockId,
        districtId,
        category: input.category,
        level: input.level,
        title: input.title,
        description: input.description || null,
        awardedOn: new Date(`${input.awardedOn}T00:00:00.000Z`),
        position: input.position ?? null,
        organiser: input.organiser ?? null,
        createdById: actor.id,
        status: 'PENDING',
      },
      include: achievementInclude,
    });
    await recordAudit(tx, audit, {
      action: 'ACHIEVEMENT_CREATED',
      entityType: 'Achievement',
      entityId: achievement.id,
      schoolId: achievement.schoolId,
      blockId: achievement.blockId,
      districtId: achievement.districtId,
      metadata: { classLevel: input.classLevel, level: input.level },
    });
    return achievement;
  });

  return toAchievement(created);
}

/**
 * Verification, by someone who did not enter the record.
 *
 * Higher-level awards need higher-level sign-off: a head teacher can confirm a
 * school sports day, but a claimed state-level prize has to be seen by the
 * district office. This is the one rule that keeps the state dashboard honest.
 */
export async function verifyAchievement(
  prisma: PrismaClient,
  actor: Actor,
  achievementId: string,
  input: VerifyAchievementInput,
  audit: AuditContext,
): Promise<Achievement> {
  const existing = await prisma.achievement.findUnique({
    where: { id: achievementId },
    include: achievementInclude,
  });
  if (!existing) throw notFound('Achievement not found');

  resolveScopeFilter(actor, {
    schoolId: existing.schoolId,
    blockId: existing.blockId,
    districtId: existing.districtId,
  });

  if (existing.createdById === actor.id) {
    throw forbidden(
      'An achievement must be verified by someone other than the person who recorded it',
    );
  }
  if (existing.status !== 'PENDING') {
    throw invalidState('This achievement has already been reviewed');
  }
  if (!canVerifyLevel(actor.role, existing.level)) {
    throw forbidden(
      `A ${existing.level.toLowerCase()}-level achievement must be verified by the ${requiredVerifierLabel(existing.level)}`,
    );
  }
  if (input.decision === 'REJECTED' && !input.reason) {
    throw badRequest('Give a reason so the school knows what to correct', {
      reason: ['A reason is required when rejecting'],
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const achievement = await tx.achievement.update({
      where: { id: achievementId },
      data: {
        status: input.decision,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        reviewNote: input.reason ?? null,
      },
      include: achievementInclude,
    });
    await recordAudit(tx, audit, {
      action: input.decision === 'VERIFIED' ? 'ACHIEVEMENT_VERIFIED' : 'ACHIEVEMENT_REJECTED',
      entityType: 'Achievement',
      entityId: achievement.id,
      schoolId: achievement.schoolId,
      blockId: achievement.blockId,
      districtId: achievement.districtId,
      metadata: input.reason ? { reason: input.reason } : undefined,
    });
    return achievement;
  });

  return toAchievement(updated);
}

const VERIFIER_RANK: Record<string, number> = {
  PRINCIPAL: 20,
  BLOCK_ADMIN: 30,
  DISTRICT_ADMIN: 40,
  STATE_ADMIN: 50,
  SUPER_ADMIN: 60,
};

const LEVEL_REQUIREMENT: Record<string, number> = {
  SCHOOL: 20,
  CLUSTER: 20,
  BLOCK: 30,
  DISTRICT: 40,
  STATE: 40,
  NATIONAL: 40,
};

function canVerifyLevel(role: string, level: string): boolean {
  const rank = VERIFIER_RANK[role];
  const required = LEVEL_REQUIREMENT[level];
  return rank !== undefined && required !== undefined && rank >= required;
}

function requiredVerifierLabel(level: string): string {
  const required = LEVEL_REQUIREMENT[level] ?? 20;
  if (required >= 40) return 'district office';
  if (required >= 30) return 'block office';
  return 'head teacher';
}
