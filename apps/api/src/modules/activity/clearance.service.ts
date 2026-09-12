import type { Prisma, PrismaClient } from '@prisma/client';
import {
  ATTESTATION_TEXT,
  SAMPLE_RATE,
  TEXT_REUSE_THRESHOLD,
  computeTrustTier,
  isLongBackdated,
  isNonWorkingDay,
  looksLikeSameImage,
  needsClearance,
  requiresBlockReview,
  reviewReason,
  scoreRisk,
  textSimilarity,
  type ClearanceQueueItem,
  type DecideClearanceInput,
  type ListClearanceQuery,
  type RiskFlag,
  type SchoolTrust,
  type VisibilityLevel,
} from '@balsanskar/shared';
import { badRequest, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import { getStorage } from '../../lib/storage.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * The gate between a school's own record and everyone else's view of it.
 *
 * A head teacher's approval is not an independent check on a colleague's work.
 * That is acceptable for something the school keeps for itself and not for
 * something shown to the block, the district, or the open web. So anything
 * above school visibility carries a named attestation, is scored for risk, and
 * is either drawn for a block officer's review or cleared automatically on the
 * school's record.
 *
 * The reasoning, and an honest account of what none of this catches, is in
 * docs/integrity.md.
 */

// ---------------------------------------------------------------------------
// Risk assessment
// ---------------------------------------------------------------------------

export interface RiskAssessment {
  flags: RiskFlag[];
  score: number;
  /** One plain sentence per flag, for the officer reading the queue. */
  notes: string[];
}

const activityForRisk = {
  media: { include: { asset: true } },
  recognisedStudents: {
    include: {
      student: {
        select: {
          id: true,
          consents: { where: { isCurrent: true }, select: { status: true }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.ActivityInclude;

type ActivityForRisk = Prisma.ActivityGetPayload<{ include: typeof activityForRisk }>;

/**
 * Everything about this activity a human might want to look at before it leaves
 * the school.
 *
 * Every check here is cheap and every one of them is fallible. A Sunday
 * activity is usually a genuine community event; a reused photograph is usually
 * an honest mistake. None of this rejects anything — it decides where an
 * officer's limited attention goes.
 */
export async function assessRisk(
  db: PrismaClient | Prisma.TransactionClient,
  activity: ActivityForRisk,
): Promise<RiskAssessment> {
  const flags: RiskFlag[] = [];
  const notes: string[] = [];

  // --- The photograph -----------------------------------------------------
  const hashes = activity.media
    .map((item) => item.asset.perceptualHash)
    .filter((hash): hash is string => typeof hash === 'string');

  if (activity.media.length === 0) {
    flags.push('NO_EVIDENCE');
    notes.push('No photograph attached.');
  }

  if (hashes.length > 0) {
    // The whole table is candidate; the partial index on perceptualHash keeps
    // this a scan of the hashed rows rather than of every asset ever uploaded.
    const others = await db.mediaAsset.findMany({
      where: {
        perceptualHash: { not: null },
        attachedAt: { not: null },
        NOT: { id: { in: activity.media.map((item) => item.assetId) } },
      },
      select: { id: true, perceptualHash: true, schoolId: true, createdAt: true },
      take: 5000,
    });

    let sameSchool: (typeof others)[number] | null = null;
    let otherSchool: (typeof others)[number] | null = null;

    for (const candidate of others) {
      if (!candidate.perceptualHash) continue;
      const matched = hashes.some((hash) => looksLikeSameImage(hash, candidate.perceptualHash!));
      if (!matched) continue;
      if (candidate.schoolId === activity.schoolId) {
        sameSchool ??= candidate;
      } else {
        otherSchool ??= candidate;
      }
      if (otherSchool && sameSchool) break;
    }

    if (otherSchool) {
      flags.push('PHOTO_REUSED_OTHER_SCHOOL');
      notes.push(
        `A photograph on this activity has already been used by another school (uploaded ${otherSchool.createdAt.toISOString().slice(0, 10)}).`,
      );
    }
    if (sameSchool) {
      flags.push('PHOTO_REUSED_OWN_SCHOOL');
      notes.push(
        `A photograph on this activity was already used by this school (uploaded ${sameSchool.createdAt.toISOString().slice(0, 10)}).`,
      );
    }
  }

  // --- Against the school's own records -----------------------------------
  if (activity.participantCount !== null) {
    const rosterTotal = await db.student.count({
      where: { schoolId: activity.schoolId, isActive: true },
    });
    if (rosterTotal > 0 && activity.participantCount > rosterTotal) {
      flags.push('COUNT_EXCEEDS_ROSTER');
      notes.push(
        `${activity.participantCount} participants recorded, but the school has ${rosterTotal} children on its roster.`,
      );
    } else if (activity.classLevels.length > 0) {
      const inClasses = await db.student.count({
        where: {
          schoolId: activity.schoolId,
          isActive: true,
          classLevel: { in: activity.classLevels },
        },
      });
      if (inClasses > 0 && activity.participantCount > inClasses) {
        flags.push('COUNT_EXCEEDS_CLASSES');
        notes.push(
          `${activity.participantCount} participants recorded, but the classes named hold ${inClasses} children.`,
        );
      }
    }
  }

  // --- The date -----------------------------------------------------------
  const occurredOn = activity.occurredOn.toISOString().slice(0, 10);
  if (isNonWorkingDay(occurredOn)) {
    flags.push('NON_WORKING_DAY');
    notes.push('Dated on a Sunday.');
  }
  if (isLongBackdated(occurredOn, activity.createdAt)) {
    flags.push('LONG_BACKDATED');
    notes.push('Recorded more than three months after it is said to have happened.');
  }

  // --- The write-up -------------------------------------------------------
  const recent = await db.activity.findMany({
    where: {
      schoolId: activity.schoolId,
      id: { not: activity.id },
      createdAt: { gte: new Date(Date.now() - 180 * 86_400_000) },
    },
    select: { description: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  for (const other of recent) {
    if (textSimilarity(activity.description, other.description) >= TEXT_REUSE_THRESHOLD) {
      flags.push('TEXT_REUSED');
      notes.push('The description closely repeats another recent activity from this school.');
      break;
    }
  }

  // --- The pattern --------------------------------------------------------
  const dayAgo = new Date(Date.now() - 86_400_000);
  const submittedToday = await db.activity.count({
    where: { schoolId: activity.schoolId, submittedAt: { gte: dayAgo } },
  });
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);
  const submittedThisMonth = await db.activity.count({
    where: { schoolId: activity.schoolId, submittedAt: { gte: monthAgo } },
  });
  // A school that normally sends a handful a month suddenly sending a dozen in
  // a day is the shape of someone catching up before a review meeting.
  if (submittedToday >= 6 && submittedToday > submittedThisMonth - submittedToday) {
    flags.push('BURST');
    notes.push(`${submittedToday} activities submitted by this school in the last 24 hours.`);
  }

  // --- Consent ------------------------------------------------------------
  const withoutConsent = activity.recognisedStudents.filter(
    (link) => link.student.consents[0]?.status !== 'GRANTED',
  ).length;
  if (withoutConsent > 0) {
    flags.push('CONSENT_GAPS');
    notes.push(
      `${withoutConsent} named ${withoutConsent === 1 ? 'child has' : 'children have'} no guardian consent on file.`,
    );
  }

  // --- History ------------------------------------------------------------
  const priorEscalations = await db.activity.count({
    where: {
      schoolId: activity.schoolId,
      id: { not: activity.id },
      clearance: { in: ['CLEARED', 'AUTO_CLEARED'] },
    },
  });
  if (priorEscalations === 0) {
    flags.push('FIRST_SUBMISSION');
    notes.push("This is the school's first activity sent beyond its own walls.");
  }

  return { flags, score: scoreRisk(flags), notes };
}

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------

/**
 * Decides what has to happen to this activity before it can leave the school.
 *
 * Called from the moderation path rather than exposed on its own, so that the
 * head teacher performs one action — read the statement, confirm it, send it on
 * — instead of a two-step dance they will learn to click through.
 *
 * `draw` is passed in so the sampling decision is reproducible in tests rather
 * than hidden inside a call to `Math.random`.
 */
export async function prepareEscalation(
  db: PrismaClient | Prisma.TransactionClient,
  activity: ActivityForRisk,
  target: VisibilityLevel,
  draw: number = Math.random(),
): Promise<{
  clearance: 'AWAITING_BLOCK' | 'AUTO_CLEARED';
  assessment: RiskAssessment;
  tier: ReturnType<typeof computeTrustTier>;
  reason: 'FLAGGED' | 'SAMPLED' | null;
}> {
  const school = await db.school.findUniqueOrThrow({
    where: { id: activity.schoolId },
    select: { trustTier: true, clearedCount: true, returnedCount: true, lastReturnedAt: true },
  });

  const assessment = await assessRisk(db, activity);
  const tier = computeTrustTier({
    clearedCount: school.clearedCount,
    returnedCount: school.returnedCount,
    lastReturnedAt: school.lastReturnedAt,
  });

  const mustReview = requiresBlockReview({ tier, flags: assessment.flags, draw });

  return {
    clearance: mustReview ? 'AWAITING_BLOCK' : 'AUTO_CLEARED',
    assessment,
    tier,
    reason: mustReview ? reviewReason(assessment.flags) : null,
  };
}

export type { ActivityForRisk };
export { activityForRisk, needsClearance };

// ---------------------------------------------------------------------------
// The block officer's queue
// ---------------------------------------------------------------------------

const queueInclude = {
  school: { select: { id: true, nameHi: true, trustTier: true } },
  author: { select: { fullName: true } },
  attestedBy: { select: { fullName: true } },
  media: { orderBy: { order: 'asc' as const }, take: 1, include: { asset: true } },
} satisfies Prisma.ActivityInclude;

/**
 * Ordered by risk, not by arrival.
 *
 * An officer who opens this and finds the top three items genuinely worth
 * looking at will open it again tomorrow. An officer who finds two hundred
 * items in chronological order will not.
 */
export async function listClearanceQueue(
  prisma: PrismaClient,
  actor: Actor,
  query: ListClearanceQuery,
): Promise<{ items: ClearanceQueueItem[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const cursorId = decodeCursor(query.cursor);

  const rows = await prisma.activity.findMany({
    where: {
      clearance: 'AWAITING_BLOCK',
      ...(scope.schoolId
        ? { schoolId: scope.schoolId }
        : scope.blockId
          ? { blockId: scope.blockId }
          : scope.districtId
            ? { districtId: scope.districtId }
            : {}),
      ...(query.flaggedOnly ? { riskScore: { gt: 0 } } : {}),
    },
    include: queueInclude,
    orderBy: [{ riskScore: 'desc' }, { submittedAt: 'asc' }, { id: 'asc' }],
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  const storage = getStorage();

  const items = await Promise.all(
    page.items.map(async (row) => {
      const flags = row.riskFlags as RiskFlag[];
      const cover = row.media[0];
      return {
        activityId: row.id,
        title: row.title,
        occurredOn: row.occurredOn.toISOString().slice(0, 10),
        schoolId: row.schoolId,
        schoolName: row.school.nameHi,
        schoolTrustTier: row.school.trustTier,
        authorName: row.author.fullName,
        attestedByName: row.attestedBy?.fullName ?? null,
        attestedAt: row.attestedAt?.toISOString() ?? null,
        target: row.clearanceTarget ?? 'BLOCK',
        riskScore: row.riskScore,
        riskFlags: flags,
        // Recomputed for display rather than stored: the notes carry dates and
        // counts that read better fresh, and storing prose invites it going stale.
        riskNotes: flags.map(flagSentence),
        reason: reviewReason(flags),
        coverUrl: cover ? await storage.getSignedReadUrl(cover.asset.storageKey) : null,
        submittedAt: row.submittedAt?.toISOString() ?? null,
      } satisfies ClearanceQueueItem;
    }),
  );

  return { items, nextCursor: page.nextCursor };
}

function flagSentence(flag: RiskFlag): string {
  const sentences: Record<RiskFlag, string> = {
    PHOTO_REUSED_OTHER_SCHOOL: 'A photograph here has already been used by another school.',
    PHOTO_REUSED_OWN_SCHOOL: 'A photograph here was already used by this school.',
    COUNT_EXCEEDS_ROSTER: 'More participants than the school has children on its roster.',
    COUNT_EXCEEDS_CLASSES: 'More participants than the classes named hold.',
    TEXT_REUSED: 'The description closely repeats another recent activity from this school.',
    BURST: 'Part of an unusual burst of submissions from this school.',
    CONSENT_GAPS: 'A named child has no guardian consent on file.',
    LONG_BACKDATED: 'Recorded long after it is said to have happened.',
    NON_WORKING_DAY: 'Dated on a Sunday.',
    NO_EVIDENCE: 'No photograph attached.',
    FIRST_SUBMISSION: "The school's first activity sent beyond its own walls.",
  };
  return sentences[flag];
}

/**
 * The officer's decision, and the only place a school's trust tier moves.
 *
 * Clearing raises the school's record and may earn it lighter oversight;
 * returning puts it on watch for six months. Both happen in the same
 * transaction as the decision, so the tier can never disagree with the history
 * it is derived from.
 */
export async function decideClearance(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  input: DecideClearanceInput,
  audit: AuditContext,
): Promise<{ clearance: string; visibility: VisibilityLevel; trustTier: string }> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      schoolId: true,
      blockId: true,
      districtId: true,
      clearance: true,
      clearanceTarget: true,
      attestedById: true,
      authorId: true,
      status: true,
      visibility: true,
      publishedAt: true,
      reviewedById: true,
    },
  });
  if (!activity) throw notFound('Activity not found');

  resolveScopeFilter(actor, {
    schoolId: activity.schoolId,
    blockId: activity.blockId,
    districtId: activity.districtId,
  });

  if (activity.clearance !== 'AWAITING_BLOCK') {
    throw invalidState('This activity is not waiting for block clearance');
  }
  // A block officer who wrote or attested the thing is not the independent
  // check this step exists to be.
  if (activity.authorId === actor.id || activity.attestedById === actor.id) {
    throw forbidden('You cannot clear an activity you recorded or attested');
  }
  if (input.decision === 'RETURN' && !input.note) {
    throw badRequest('Say what is wrong so the school can correct it', {
      note: ['A note is required when returning an activity'],
    });
  }

  const target = (activity.clearanceTarget ?? 'BLOCK') as VisibilityLevel;

  const result = await prisma.$transaction(async (tx) => {
    const school = await tx.school.findUniqueOrThrow({
      where: { id: activity.schoolId },
      select: { clearedCount: true, returnedCount: true, lastReturnedAt: true, trustTier: true },
    });

    let next;
    if (input.decision === 'CLEAR') {
      next = {
        clearedCount: school.clearedCount + 1,
        returnedCount: school.returnedCount,
        lastReturnedAt: school.lastReturnedAt,
      };
      await tx.activity.update({
        where: { id: activityId },
        data: {
          clearance: 'CLEARED',
          clearedById: actor.id,
          clearedAt: new Date(),
          clearanceNote: input.note ?? null,
          // Only now does the activity become visible above its own school.
          visibility: target,
          status: 'PUBLISHED',
          publishedAt: activity.publishedAt ?? new Date(),
          reviewedById: activity.reviewedById ?? activity.attestedById,
          reviewedAt: new Date(),
        },
      });
    } else {
      next = {
        clearedCount: school.clearedCount,
        returnedCount: school.returnedCount + 1,
        lastReturnedAt: new Date(),
      };
      await tx.activity.update({
        where: { id: activityId },
        data: {
          clearance: 'RETURNED',
          clearedById: actor.id,
          clearedAt: new Date(),
          clearanceNote: input.note ?? null,
          // Back to the school, and back to the teacher to fix.
          visibility: 'SCHOOL',
          status: 'REJECTED',
          rejectionReason: input.note ?? null,
        },
      });
    }

    const tier = computeTrustTier(next);
    await tx.school.update({
      where: { id: activity.schoolId },
      data: { ...next, trustTier: tier },
    });

    await recordAudit(tx, audit, {
      action: input.decision === 'CLEAR' ? 'ACTIVITY_CLEARED' : 'ACTIVITY_RETURNED',
      entityType: 'Activity',
      entityId: activityId,
      schoolId: activity.schoolId,
      blockId: activity.blockId,
      districtId: activity.districtId,
      metadata: { target, note: input.note, trustTier: tier },
    });

    if (tier !== school.trustTier) {
      await recordAudit(tx, audit, {
        action: 'SCHOOL_TRUST_CHANGED',
        entityType: 'School',
        entityId: activity.schoolId,
        schoolId: activity.schoolId,
        blockId: activity.blockId,
        districtId: activity.districtId,
        metadata: { from: school.trustTier, to: tier, because: input.decision },
      });
    }

    return {
      clearance: input.decision === 'CLEAR' ? 'CLEARED' : 'RETURNED',
      visibility: (input.decision === 'CLEAR' ? target : 'SCHOOL') as VisibilityLevel,
      trustTier: tier,
    };
  });

  return result;
}

/** What a school's own staff and its officers can see about its standing. */
export async function getSchoolTrust(
  prisma: PrismaClient,
  actor: Actor,
  schoolId: string,
): Promise<SchoolTrust> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      nameHi: true,
      status: true,
      trustTier: true,
      clearedCount: true,
      returnedCount: true,
      lastReturnedAt: true,
      blockId: true,
      districtId: true,
    },
  });
  if (!school) throw notFound('School not found');

  resolveScopeFilter(actor, {
    schoolId: school.id,
    blockId: school.blockId,
    districtId: school.districtId,
  });

  const tier = computeTrustTier({
    clearedCount: school.clearedCount,
    returnedCount: school.returnedCount,
    lastReturnedAt: school.lastReturnedAt,
  });

  return {
    schoolId: school.id,
    schoolName: school.nameHi,
    tier,
    clearedCount: school.clearedCount,
    returnedCount: school.returnedCount,
    lastReturnedAt: school.lastReturnedAt?.toISOString() ?? null,
    sampleRate: SAMPLE_RATE[tier],
    status: school.status,
  };
}

export { ATTESTATION_TEXT };
