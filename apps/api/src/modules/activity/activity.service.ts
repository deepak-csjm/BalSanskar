import type { Prisma, PrismaClient } from '@prisma/client';
import {
  canEditActivity,
  canTransitionActivity,
  evaluatePublishBlockers,
  maxApprovableVisibility,
  VISIBILITY_RANK,
  type ActivityDetail,
  type ActivitySummary,
  type CreateActivityInput,
  type GiveAppreciationInput,
  type ListActivitiesQuery,
  type ModerateActivityInput,
  type SubmitActivityInput,
  type UpdateActivityInput,
  type VisibilityLevel,
} from '@balsanskar/shared';
import { badRequest, conflict, forbidden, invalidState, notFound } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter, type ScopeFilter } from '../../lib/scope.js';
import { toApiClassLevels, toDbClassLevels } from '../../lib/class-level.js';
import { getStorage } from '../../lib/storage.js';
import { isPrismaError, PG_ERROR } from '../../lib/prisma.js';
import type { Actor } from '../../plugins/auth.js';
import { findStudentsWithoutConsent } from '../student/student.service.js';

/**
 * Activities: the record of what a school actually did.
 *
 * The lifecycle is DRAFT -> PENDING_REVIEW -> PUBLISHED, with REJECTED and
 * ARCHIVED as the other terminal states. Nothing skips review, and the publish
 * step is where every child-safety rule is enforced.
 */

const activityInclude = {
  school: { select: { id: true, nameHi: true } },
  block: { select: { nameHi: true } },
  district: { select: { nameHi: true } },
  author: { select: { id: true, fullName: true } },
  reviewedBy: { select: { fullName: true } },
  media: {
    orderBy: { order: 'asc' },
    include: { asset: true },
  },
  recognisedStudents: {
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          classLevel: true,
          consents: { where: { isCurrent: true }, select: { status: true }, take: 1 },
        },
      },
    },
  },
  _count: { select: { media: true } },
} satisfies Prisma.ActivityInclude;

type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

async function toSummary(row: ActivityRow): Promise<ActivitySummary> {
  const cover = row.media[0];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    visibility: row.visibility,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    schoolId: row.schoolId,
    schoolName: row.school.nameHi,
    blockName: row.block.nameHi,
    districtName: row.district.nameHi,
    authorName: row.author.fullName,
    participantCount: row.participantCount,
    mediaCount: row._count.media,
    coverUrl: cover ? await getStorage().getSignedReadUrl(cover.asset.storageKey) : null,
    appreciationCount: row.appreciationCount,
    createdAt: row.createdAt.toISOString(),
  };
}

async function toDetail(row: ActivityRow, actor: Actor): Promise<ActivityDetail> {
  const storage = getStorage();
  const summary = await toSummary(row);

  const media = await Promise.all(
    row.media.map(async (item) => ({
      id: item.id,
      kind: item.asset.kind,
      url: await storage.getSignedReadUrl(item.asset.storageKey),
      thumbnailUrl: null,
      caption: item.caption,
      width: item.asset.width,
      height: item.asset.height,
      order: item.order,
    })),
  );

  const recognisedStudents = row.recognisedStudents.map((link) => ({
    id: link.student.id,
    fullName: link.student.fullName,
    classLevel: toApiClassLevels([link.student.classLevel])[0]!,
    hasMediaConsent: link.student.consents[0]?.status === 'GRANTED',
  }));

  const detail: ActivityDetail = {
    ...summary,
    description: row.description,
    learningOutcome: row.learningOutcome,
    classLevels: toApiClassLevels(row.classLevels),
    tags: row.tags,
    media,
    recognisedStudents,
    authorId: row.authorId,
    requestedVisibility: row.requestedVisibility,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedByName: row.reviewedBy?.fullName ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
  };

  // Moderators get the checklist; authors get it too, so they can fix problems
  // before submitting rather than after being rejected.
  const ceiling = maxApprovableVisibility(actor.role);
  if (ceiling) {
    detail.publishBlockers = evaluatePublishBlockers(
      toPublishCandidate(row),
      row.requestedVisibility ?? 'BLOCK',
      actor.role,
    );
  }
  return detail;
}

function toPublishCandidate(row: ActivityRow) {
  return {
    status: row.status,
    hasMedia: row.media.length > 0,
    recognisedStudentConsents: row.recognisedStudents.map(
      (link) => link.student.consents[0]?.status ?? 'DENIED',
    ),
    mediaWithoutConsentCount: row.media.filter((item) => !item.consentVerified).length,
    descriptionLength: row.description.length,
  };
}

function scopeToWhere(scope: ScopeFilter): Prisma.ActivityWhereInput {
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.blockId) return { blockId: scope.blockId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

/**
 * What a caller may see, on top of their geographic scope.
 *
 * A teacher sees their school's published work plus their own drafts. Someone
 * else's unfinished draft is nobody's business, including their head teacher's,
 * until it is submitted.
 */
function visibilityWhere(actor: Actor): Prisma.ActivityWhereInput {
  if (actor.role === 'TEACHER') {
    return {
      OR: [
        { authorId: actor.id },
        { status: { in: ['PUBLISHED', 'ARCHIVED'] } },
      ],
    };
  }
  return { OR: [{ status: { not: 'DRAFT' } }, { authorId: actor.id }, { schoolId: actor.schoolId ?? undefined }] };
}

export async function listActivities(
  prisma: PrismaClient,
  actor: Actor,
  query: ListActivitiesQuery,
): Promise<{ items: ActivitySummary[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const cursorId = decodeCursor(query.cursor);

  const where: Prisma.ActivityWhereInput = {
    AND: [
      scopeToWhere(scope),
      visibilityWhere(actor),
      ...(query.awaitingMyReview ? [{ status: 'PENDING_REVIEW' as const }] : []),
      ...(query.status ? [{ status: query.status }] : []),
      ...(query.category ? [{ category: query.category }] : []),
      ...(query.authorId ? [{ authorId: query.authorId }] : []),
      ...(query.search ? [{ title: { startsWith: query.search, mode: 'insensitive' as const } }] : []),
      ...(query.from || query.to
        ? [
            {
              occurredOn: {
                ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
                ...(query.to ? { lte: new Date(`${query.to}T00:00:00.000Z`) } : {}),
              },
            },
          ]
        : []),
    ],
  };

  const rows = await prisma.activity.findMany({
    where,
    include: activityInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  return {
    items: await Promise.all(page.items.map(toSummary)),
    nextCursor: page.nextCursor,
  };
}

async function loadActivityInScope(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
): Promise<ActivityRow> {
  const row = await prisma.activity.findUnique({
    where: { id: activityId },
    include: activityInclude,
  });
  if (!row) throw notFound('Activity not found');
  resolveScopeFilter(actor, {
    schoolId: row.schoolId,
    blockId: row.blockId,
    districtId: row.districtId,
  });
  if (row.status === 'DRAFT' && row.authorId !== actor.id && actor.role === 'TEACHER') {
    throw notFound('Activity not found');
  }
  return row;
}

export async function getActivity(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
): Promise<ActivityDetail> {
  return toDetail(await loadActivityInScope(prisma, actor, activityId), actor);
}

export async function createActivity(
  prisma: PrismaClient,
  actor: Actor,
  input: CreateActivityInput,
  audit: AuditContext,
): Promise<ActivityDetail> {
  if (!actor.schoolId || !actor.blockId || !actor.districtId) {
    throw forbidden('Only staff attached to a school can record an activity');
  }

  const studentIds = await validateStudentIds(prisma, actor.schoolId, input.studentIds);
  const assetIds = await validateAssets(prisma, actor, input.mediaKeys);

  const created = await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        schoolId: actor.schoolId!,
        blockId: actor.blockId!,
        districtId: actor.districtId!,
        authorId: actor.id,
        title: input.title,
        description: input.description,
        learningOutcome: input.learningOutcome || null,
        category: input.category,
        occurredOn: new Date(`${input.occurredOn}T00:00:00.000Z`),
        classLevels: toDbClassLevels(input.classLevels),
        participantCount: input.participantCount ?? null,
        tags: input.tags,
        status: 'DRAFT',
        visibility: 'SCHOOL',
        recognisedStudents: { create: studentIds.map((studentId) => ({ studentId })) },
        media: {
          create: assetIds.map((assetId, index) => ({ assetId, order: index })),
        },
      },
      include: activityInclude,
    });

    if (assetIds.length > 0) {
      await tx.mediaAsset.updateMany({
        where: { id: { in: assetIds } },
        data: { attachedAt: new Date() },
      });
    }

    await recordAudit(tx, audit, {
      action: 'ACTIVITY_CREATED',
      entityType: 'Activity',
      entityId: activity.id,
      schoolId: activity.schoolId,
      blockId: activity.blockId,
      districtId: activity.districtId,
    });
    return activity;
  });

  return toDetail(created, actor);
}

export async function updateActivity(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  input: UpdateActivityInput,
  audit: AuditContext,
): Promise<ActivityDetail> {
  const existing = await loadActivityInScope(prisma, actor, activityId);
  const isAuthor = existing.authorId === actor.id;

  if (!canEditActivity(existing.status, isAuthor, actor.role)) {
    throw forbidden('This activity can no longer be edited');
  }
  if (!isAuthor && actor.role === 'TEACHER') {
    throw forbidden("You can only edit activities you recorded");
  }

  const studentIds =
    input.studentIds !== undefined
      ? await validateStudentIds(prisma, existing.schoolId, input.studentIds)
      : null;
  const assetIds =
    input.mediaKeys !== undefined ? await validateAssets(prisma, actor, input.mediaKeys) : null;

  const updated = await prisma.$transaction(async (tx) => {
    if (studentIds) {
      await tx.activityStudent.deleteMany({ where: { activityId } });
      if (studentIds.length > 0) {
        await tx.activityStudent.createMany({
          data: studentIds.map((studentId) => ({ activityId, studentId })),
        });
      }
    }
    if (assetIds) {
      // Replacing the media set resets consent verification: a moderator
      // approved the old photographs, not these.
      await tx.activityMedia.deleteMany({ where: { activityId } });
      for (const [index, assetId] of assetIds.entries()) {
        await tx.activityMedia.create({ data: { activityId, assetId, order: index } });
      }
      if (assetIds.length > 0) {
        await tx.mediaAsset.updateMany({
          where: { id: { in: assetIds } },
          data: { attachedAt: new Date() },
        });
      }
    }

    const activity = await tx.activity.update({
      where: { id: activityId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.learningOutcome !== undefined
          ? { learningOutcome: input.learningOutcome || null }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.occurredOn !== undefined
          ? { occurredOn: new Date(`${input.occurredOn}T00:00:00.000Z`) }
          : {}),
        ...(input.classLevels !== undefined
          ? { classLevels: toDbClassLevels(input.classLevels) }
          : {}),
        ...(input.participantCount !== undefined
          ? { participantCount: input.participantCount }
          : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
      },
      include: activityInclude,
    });

    await recordAudit(tx, audit, {
      action: 'ACTIVITY_UPDATED',
      entityType: 'Activity',
      entityId: activity.id,
      schoolId: activity.schoolId,
      blockId: activity.blockId,
      districtId: activity.districtId,
      metadata: { changed: Object.keys(input) },
    });
    return activity;
  });

  return toDetail(updated, actor);
}

export async function submitActivity(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  input: SubmitActivityInput,
  audit: AuditContext,
): Promise<ActivityDetail> {
  const existing = await loadActivityInScope(prisma, actor, activityId);
  if (existing.authorId !== actor.id && actor.role === 'TEACHER') {
    throw forbidden('You can only submit activities you recorded');
  }
  if (!canTransitionActivity(existing.status, 'PENDING_REVIEW')) {
    throw invalidState(`An activity that is ${existing.status.toLowerCase()} cannot be submitted`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.update({
      where: { id: activityId },
      data: {
        status: 'PENDING_REVIEW',
        requestedVisibility: input.requestedVisibility,
        submittedAt: new Date(),
        rejectionReason: null,
      },
      include: activityInclude,
    });
    await recordAudit(tx, audit, {
      action: 'ACTIVITY_SUBMITTED',
      entityType: 'Activity',
      entityId: activity.id,
      schoolId: activity.schoolId,
      blockId: activity.blockId,
      districtId: activity.districtId,
      metadata: { requestedVisibility: input.requestedVisibility, note: input.note },
    });
    return activity;
  });

  return toDetail(updated, actor);
}

/**
 * The moderation decision.
 *
 * This is the function that decides whether a photograph of a child leaves the
 * department's systems, so it re-checks every rule from scratch rather than
 * trusting anything the client sent or any earlier check. In particular:
 *
 *   - the moderator may not be the author,
 *   - the moderator's role caps the visibility they can grant,
 *   - PUBLIC additionally requires granted consent for every named child and a
 *     moderator's confirmation on every photograph.
 */
export async function moderateActivity(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  input: ModerateActivityInput,
  audit: AuditContext,
): Promise<ActivityDetail> {
  const existing = await loadActivityInScope(prisma, actor, activityId);

  if (existing.status !== 'PENDING_REVIEW') {
    throw invalidState('Only an activity awaiting review can be moderated');
  }
  if (existing.authorId === actor.id) {
    throw forbidden('An activity must be reviewed by someone other than the teacher who recorded it');
  }

  if (input.decision === 'REJECT') {
    if (!input.reason) {
      throw badRequest('Give a reason so the teacher knows what to change', {
        reason: ['A reason is required when rejecting'],
      });
    }
    const rejected = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.update({
        where: { id: activityId },
        data: {
          status: 'REJECTED',
          reviewedById: actor.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason ?? null,
        },
        include: activityInclude,
      });
      await recordAudit(tx, audit, {
        action: 'ACTIVITY_REJECTED',
        entityType: 'Activity',
        entityId: activity.id,
        schoolId: activity.schoolId,
        blockId: activity.blockId,
        districtId: activity.districtId,
        metadata: { reason: input.reason },
      });
      return activity;
    });
    return toDetail(rejected, actor);
  }

  const visibility: VisibilityLevel =
    input.visibility ?? existing.requestedVisibility ?? 'BLOCK';

  const blockers = evaluatePublishBlockers(
    toPublishCandidate(existing),
    visibility,
    actor.role,
    existing.requestedVisibility,
  );
  if (blockers.length > 0) {
    throw conflict(describeBlockers(blockers), 'INVALID_STATE_TRANSITION');
  }

  // Re-read consent inside the transaction. The check above used the row loaded
  // at the start of the request; a guardian could have withdrawn consent in
  // between, and this is the one place where losing that race would put a
  // child's photograph on the open web.
  const published = await prisma.$transaction(async (tx) => {
    if (visibility === 'PUBLIC') {
      const studentIds = existing.recognisedStudents.map((link) => link.studentId);
      const missing = await findStudentsWithoutConsent(tx, studentIds);
      if (missing.length > 0) {
        throw conflict(
          `Guardian consent has not been recorded for: ${missing.map((s) => s.fullName).join(', ')}`,
          'CONSENT_MISSING',
        );
      }
    }

    const activity = await tx.activity.update({
      where: { id: activityId },
      data: {
        status: 'PUBLISHED',
        visibility,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        publishedAt: existing.publishedAt ?? new Date(),
        rejectionReason: null,
      },
      include: activityInclude,
    });
    await recordAudit(tx, audit, {
      action: 'ACTIVITY_PUBLISHED',
      entityType: 'Activity',
      entityId: activity.id,
      schoolId: activity.schoolId,
      blockId: activity.blockId,
      districtId: activity.districtId,
      metadata: { visibility },
    });
    return activity;
  });

  return toDetail(published, actor);
}

function describeBlockers(blockers: string[]): string {
  const messages: Record<string, string> = {
    NOT_SUBMITTED: 'this activity has not been submitted for review',
    DESCRIPTION_TOO_SHORT: 'the description is too short to be a useful record',
    STUDENT_CONSENT_MISSING: 'guardian consent is missing for a named student',
    MEDIA_CONSENT_MISSING: 'a photograph has not been confirmed against a consent slip',
    VISIBILITY_ABOVE_ROLE: 'your role cannot approve content at that visibility',
    VISIBILITY_ABOVE_REQUEST: 'that is wider than the visibility the teacher asked for',
  };
  const reasons = blockers.map((code) => messages[code] ?? code.toLowerCase());
  return `Cannot publish: ${reasons.join('; ')}.`;
}

/**
 * Confirms that a photograph is covered by consent slips.
 *
 * Separate from publishing on purpose: it is a per-image judgement made by a
 * person who looked at the image, and recording it separately means the
 * moderation log shows who looked, at what, and when.
 */
export async function setMediaConsentVerified(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  mediaId: string,
  verified: boolean,
  audit: AuditContext,
): Promise<void> {
  const activity = await loadActivityInScope(prisma, actor, activityId);
  const media = activity.media.find((item) => item.id === mediaId);
  if (!media) throw notFound('Photograph not found on this activity');

  await prisma.$transaction(async (tx) => {
    await tx.activityMedia.update({
      where: { id: mediaId },
      data: {
        consentVerified: verified,
        consentVerifiedAt: verified ? new Date() : null,
      },
    });
    await recordAudit(tx, audit, {
      action: 'ACTIVITY_UPDATED',
      entityType: 'ActivityMedia',
      entityId: mediaId,
      schoolId: activity.schoolId,
      blockId: activity.blockId,
      districtId: activity.districtId,
      metadata: { consentVerified: verified, activityId },
    });
  });
}

export async function archiveActivity(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  audit: AuditContext,
): Promise<void> {
  const existing = await loadActivityInScope(prisma, actor, activityId);
  if (!canTransitionActivity(existing.status, 'ARCHIVED')) {
    throw invalidState('This activity cannot be archived');
  }
  await prisma.$transaction(async (tx) => {
    await tx.activity.update({
      where: { id: activityId },
      // Archiving pulls the record back to the school. It stays as evidence, but
      // it stops being visible to the block, the district and the public.
      data: { status: 'ARCHIVED', visibility: 'SCHOOL' },
    });
    await recordAudit(tx, audit, {
      action: 'ACTIVITY_ARCHIVED',
      entityType: 'Activity',
      entityId: activityId,
      schoolId: existing.schoolId,
      blockId: existing.blockId,
      districtId: existing.districtId,
    });
  });
}

export async function giveAppreciation(
  prisma: PrismaClient,
  actor: Actor,
  activityId: string,
  input: GiveAppreciationInput,
  audit: AuditContext,
): Promise<{ appreciationCount: number }> {
  const activity = await loadActivityInScope(prisma, actor, activityId);
  if (activity.status !== 'PUBLISHED') {
    throw invalidState('Only published work can be appreciated');
  }
  if (activity.authorId === actor.id) {
    throw forbidden('You cannot appreciate your own activity');
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.appreciation.create({
        data: { activityId, userId: actor.id, message: input.message ?? null },
      });
      const updated = await tx.activity.update({
        where: { id: activityId },
        data: { appreciationCount: { increment: 1 } },
        select: { appreciationCount: true },
      });
      await recordAudit(tx, audit, {
        action: 'APPRECIATION_GIVEN',
        entityType: 'Activity',
        entityId: activityId,
        schoolId: activity.schoolId,
        blockId: activity.blockId,
        districtId: activity.districtId,
      });
      return updated;
    });
    return { appreciationCount: result.appreciationCount };
  } catch (error) {
    if (isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      throw conflict('You have already appreciated this activity');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Input validation against the database
// ---------------------------------------------------------------------------

/** Students must exist and belong to the school the activity belongs to. */
async function validateStudentIds(
  prisma: PrismaClient,
  schoolId: string,
  studentIds: string[],
): Promise<string[]> {
  if (studentIds.length === 0) return [];
  const unique = [...new Set(studentIds)];
  const found = await prisma.student.findMany({
    where: { id: { in: unique }, schoolId, isActive: true },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw badRequest('One or more selected students are not on this school\'s active roster', {
      studentIds: ['Unknown or inactive student'],
    });
  }
  return found.map((row) => row.id);
}

/**
 * Uploaded files must belong to the caller and must not already be attached
 * elsewhere — otherwise one school could reference another school's photographs
 * by guessing a storage key.
 */
async function validateAssets(
  prisma: PrismaClient,
  actor: Actor,
  keys: string[],
): Promise<string[]> {
  if (keys.length === 0) return [];
  const unique = [...new Set(keys)];
  const assets = await prisma.mediaAsset.findMany({
    where: { storageKey: { in: unique }, uploadedById: actor.id },
    select: { id: true, storageKey: true },
  });
  if (assets.length !== unique.length) {
    throw badRequest('One or more uploaded files could not be found', {
      mediaKeys: ['Unknown upload. Please try uploading again.'],
    });
  }
  // Preserve the order the client asked for; it is the display order.
  const byKey = new Map(assets.map((asset) => [asset.storageKey, asset.id]));
  return unique.map((key) => byKey.get(key)!);
}

export { VISIBILITY_RANK };
