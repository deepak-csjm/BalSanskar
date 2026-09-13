import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CreateNeedInput,
  HabitationSurvey,
  ListNeedsQuery,
  Need,
  RecordSmcMeetingInput,
  RecordSurveyInput,
  ResolveNeedInput,
  SmcMeeting,
  SurveySummary,
  VillageSchoolPage,
} from '@balsanskar/shared';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import { toApiClassLevel, toApiClassLevels, toDbClassLevels } from '../../lib/class-level.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * The village's side of the school.
 *
 * See packages/shared/src/contracts/village.ts for why any of this exists. The
 * short version: the Right to Education Act already puts a committee of parents
 * in charge of every government school, and almost nowhere can that committee
 * see anything. Authority without information is not authority.
 */

/**
 * Whether this actor may touch a record belonging to that school.
 *
 * Takes the owning school's id explicitly rather than a row, because the rows
 * this guards carry it as `schoolId` while a school row calls it `id` — and a
 * helper that silently reads the wrong field rejects the owner along with
 * everybody else, which is a bug that looks exactly like the feature working.
 */
function assertMayTouch(
  actor: Actor,
  owner: { schoolId: string; blockId: string; districtId: string },
): void {
  const scope = resolveScopeFilter(actor, {});
  if (scope.schoolId && scope.schoolId !== owner.schoolId) {
    throw forbidden('This school is outside your area');
  }
  if (scope.blockId && scope.blockId !== owner.blockId) {
    throw forbidden('This school is outside your area');
  }
  if (scope.districtId && scope.districtId !== owner.districtId) {
    throw forbidden('This school is outside your area');
  }
}

// ---------------------------------------------------------------------------
// Needs
// ---------------------------------------------------------------------------

function toNeed(row: {
  id: string;
  kind: Need['kind'];
  status: Need['status'];
  title: string;
  detail: string | null;
  quantity: number | null;
  classLevels: Parameters<typeof toApiClassLevels>[0];
  helperCredit: string | null;
  metOn: Date | null;
  createdAt: Date;
}): Need {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    detail: row.detail,
    quantity: row.quantity,
    classLevels: toApiClassLevels(row.classLevels),
    helperCredit: row.helperCredit,
    metOn: row.metOn?.toISOString().slice(0, 10) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createNeed(
  prisma: PrismaClient,
  actor: Actor,
  input: CreateNeedInput,
  audit: AuditContext,
): Promise<Need> {
  const { schoolId, blockId, districtId } = actor;
  if (!schoolId || !blockId || !districtId) {
    throw forbidden('Only school staff can post what their school needs');
  }

  const created = await prisma.$transaction(async (tx) => {
    const need = await tx.schoolNeed.create({
      data: {
        schoolId,
        blockId,
        districtId,
        kind: input.kind,
        title: input.title,
        detail: input.detail || null,
        quantity: input.quantity ?? null,
        classLevels: toDbClassLevels(input.classLevels),
        createdById: actor.id,
      },
    });
    await recordAudit(tx, audit, {
      action: 'NEED_POSTED',
      entityType: 'SchoolNeed',
      entityId: need.id,
      schoolId,
      blockId,
      districtId,
      metadata: { kind: input.kind },
    });
    return need;
  });

  return toNeed(created);
}

/**
 * Marks a need promised, met or withdrawn.
 *
 * Only the school can say a need was met, because only the school knows whether
 * the person actually turned up. A self-service "I helped" button would be a
 * claim rather than a record, and the first person to abuse it would be the
 * reason nobody trusted any of it again.
 */
export async function resolveNeed(
  prisma: PrismaClient,
  actor: Actor,
  needId: string,
  input: ResolveNeedInput,
  audit: AuditContext,
): Promise<Need> {
  const existing = await prisma.schoolNeed.findUnique({ where: { id: needId } });
  if (!existing) throw notFound('That need is not on the board');
  assertMayTouch(actor, existing);

  if (input.status === 'MET' && !input.metOn) {
    throw badRequest('Say when it was met', { metOn: ['Required when marking a need met'] });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const need = await tx.schoolNeed.update({
      where: { id: needId },
      data: {
        status: input.status,
        helperCredit: input.helperCredit ?? existing.helperCredit,
        metOn: input.metOn ? new Date(`${input.metOn}T00:00:00.000Z`) : existing.metOn,
      },
    });
    await recordAudit(tx, audit, {
      action: 'NEED_RESOLVED',
      entityType: 'SchoolNeed',
      entityId: needId,
      schoolId: existing.schoolId,
      blockId: existing.blockId,
      districtId: existing.districtId,
      metadata: { status: input.status },
    });
    return need;
  });

  return toNeed(updated);
}

export async function listNeeds(
  prisma: PrismaClient,
  actor: Actor,
  query: ListNeedsQuery,
): Promise<{ items: Need[] }> {
  const scope = resolveScopeFilter(actor, query);
  const where: Prisma.SchoolNeedWhereInput = {
    ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    ...(scope.blockId ? { blockId: scope.blockId } : {}),
    ...(scope.districtId ? { districtId: scope.districtId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const rows = await prisma.schoolNeed.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  });
  return { items: rows.map(toNeed) };
}

// ---------------------------------------------------------------------------
// The School Management Committee
// ---------------------------------------------------------------------------

export async function recordSmcMeeting(
  prisma: PrismaClient,
  actor: Actor,
  input: RecordSmcMeetingInput,
  audit: AuditContext,
): Promise<SmcMeeting> {
  const { schoolId, blockId, districtId } = actor;
  if (!schoolId || !blockId || !districtId) {
    throw forbidden('Only school staff can record a committee meeting');
  }
  // Arithmetic somebody would otherwise get wrong in a hurry, and a wrong
  // number here is the kind of thing an auditor notices years later.
  if (input.parentsPresent > input.membersPresent || input.womenPresent > input.membersPresent) {
    throw badRequest('More parents or women present than members present', {
      membersPresent: ['Cannot be fewer than the parents or women counted'],
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const meeting = await tx.smcMeeting.create({
      data: {
        schoolId,
        blockId,
        districtId,
        heldOn: new Date(`${input.heldOn}T00:00:00.000Z`),
        membersPresent: input.membersPresent,
        parentsPresent: input.parentsPresent,
        womenPresent: input.womenPresent,
        decisions: input.decisions,
        raisedWithBlock: input.raisedWithBlock || null,
        recordedById: actor.id,
      },
      include: { recordedBy: { select: { fullName: true } } },
    });
    await recordAudit(tx, audit, {
      action: 'SMC_MEETING_RECORDED',
      entityType: 'SmcMeeting',
      entityId: meeting.id,
      schoolId,
      blockId,
      districtId,
      metadata: { heldOn: input.heldOn, membersPresent: input.membersPresent },
    });
    return meeting;
  });

  return {
    id: created.id,
    heldOn: created.heldOn.toISOString().slice(0, 10),
    membersPresent: created.membersPresent,
    parentsPresent: created.parentsPresent,
    womenPresent: created.womenPresent,
    decisions: created.decisions,
    raisedWithBlock: created.raisedWithBlock,
    recordedByName: created.recordedBy.fullName,
    createdAt: created.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Children who are not in school
// ---------------------------------------------------------------------------

function toSurvey(row: {
  id: string;
  habitationName: string;
  kind: HabitationSurvey['kind'];
  surveyedOn: Date;
  householdsVisited: number;
  childrenFound: number;
  childrenEnrolled: number;
  surveyedBy: string;
  note: string | null;
  schoolId: string;
  createdAt: Date;
  school: { nameHi: string };
}): HabitationSurvey {
  return {
    id: row.id,
    habitationName: row.habitationName,
    kind: row.kind,
    surveyedOn: row.surveyedOn.toISOString().slice(0, 10),
    householdsVisited: row.householdsVisited,
    childrenFound: row.childrenFound,
    childrenEnrolled: row.childrenEnrolled,
    // The number the whole exercise is about, computed rather than stored so it
    // cannot drift from the two counts it comes from.
    stillOut: Math.max(0, row.childrenFound - row.childrenEnrolled),
    surveyedBy: row.surveyedBy,
    note: row.note,
    schoolId: row.schoolId,
    schoolName: row.school.nameHi,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordSurvey(
  prisma: PrismaClient,
  actor: Actor,
  input: RecordSurveyInput,
  audit: AuditContext,
): Promise<HabitationSurvey> {
  const { schoolId, blockId, districtId } = actor;
  if (!schoolId || !blockId || !districtId) {
    throw forbidden('Only school staff can record a survey');
  }
  if (input.childrenEnrolled > input.childrenFound) {
    throw badRequest('More children enrolled than were found out of school', {
      childrenEnrolled: ['Cannot exceed the number found'],
    });
  }

  const saved = await prisma.$transaction(async (tx) => {
    // Walking the same hamlet again replaces the earlier count for that day
    // rather than adding to it, because two people surveying the same place is
    // a duplicate, not twice the children.
    const row = await tx.habitationSurvey.upsert({
      where: {
        schoolId_habitationName_surveyedOn: {
          schoolId,
          habitationName: input.habitationName,
          surveyedOn: new Date(`${input.surveyedOn}T00:00:00.000Z`),
        },
      },
      create: {
        schoolId,
        blockId,
        districtId,
        habitationName: input.habitationName,
        kind: input.kind,
        surveyedOn: new Date(`${input.surveyedOn}T00:00:00.000Z`),
        householdsVisited: input.householdsVisited,
        childrenFound: input.childrenFound,
        childrenEnrolled: input.childrenEnrolled,
        surveyedBy: input.surveyedBy,
        note: input.note || null,
        recordedById: actor.id,
      },
      update: {
        kind: input.kind,
        householdsVisited: input.householdsVisited,
        childrenFound: input.childrenFound,
        childrenEnrolled: input.childrenEnrolled,
        surveyedBy: input.surveyedBy,
        note: input.note || null,
        recordedById: actor.id,
      },
      include: { school: { select: { nameHi: true } } },
    });
    await recordAudit(tx, audit, {
      action: 'SURVEY_RECORDED',
      entityType: 'HabitationSurvey',
      entityId: row.id,
      schoolId,
      blockId,
      districtId,
      metadata: {
        habitation: input.habitationName,
        childrenFound: input.childrenFound,
        childrenEnrolled: input.childrenEnrolled,
      },
    });
    return row;
  });

  return toSurvey(saved);
}

export async function summariseSurveys(
  prisma: PrismaClient,
  where: Prisma.HabitationSurveyWhereInput,
): Promise<SurveySummary> {
  const [totals, latest] = await Promise.all([
    prisma.habitationSurvey.aggregate({
      where,
      _count: { _all: true },
      _sum: { householdsVisited: true, childrenFound: true, childrenEnrolled: true },
    }),
    prisma.habitationSurvey.findFirst({
      where,
      orderBy: { surveyedOn: 'desc' },
      select: { surveyedOn: true },
    }),
  ]);

  const found = totals._sum.childrenFound ?? 0;
  const enrolled = totals._sum.childrenEnrolled ?? 0;
  return {
    habitationsSurveyed: totals._count._all,
    householdsVisited: totals._sum.householdsVisited ?? 0,
    childrenFound: found,
    childrenEnrolled: enrolled,
    stillOut: Math.max(0, found - enrolled),
    lastSurveyedOn: latest?.surveyedOn.toISOString().slice(0, 10) ?? null,
  };
}

export async function listSurveys(
  prisma: PrismaClient,
  actor: Actor,
  query: { schoolId?: string; blockId?: string; districtId?: string },
): Promise<{ items: HabitationSurvey[]; summary: SurveySummary }> {
  const scope = resolveScopeFilter(actor, query);
  const where: Prisma.HabitationSurveyWhereInput = {
    ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    ...(scope.blockId ? { blockId: scope.blockId } : {}),
    ...(scope.districtId ? { districtId: scope.districtId } : {}),
  };
  const [rows, summary] = await Promise.all([
    prisma.habitationSurvey.findMany({
      where,
      orderBy: { surveyedOn: 'desc' },
      take: 200,
      include: { school: { select: { nameHi: true } } },
    }),
    summariseSurveys(prisma, where),
  ]);
  return { items: rows.map(toSurvey), summary };
}

// ---------------------------------------------------------------------------
// The page on the school wall
// ---------------------------------------------------------------------------

/**
 * What a villager sees when they scan the code by the door.
 *
 * Unauthenticated, so the rules are strict and worth restating at the point
 * they are enforced: only a confirmed school, only work a block officer has
 * cleared, only counts, and no route by which a name of a child, a parent or a
 * helper's contact details could appear. Everything here already exists for
 * another reason — a page that has to be fed separately goes stale, and a stale
 * noticeboard is worse than a bare wall.
 */
export async function getVillageSchoolPage(
  prisma: PrismaClient,
  udiseCode: string,
): Promise<VillageSchoolPage> {
  const school = await prisma.school.findUnique({
    where: { udiseCode },
    select: {
      id: true,
      udiseCode: true,
      nameHi: true,
      villageOrWard: true,
      status: true,
      block: { select: { nameHi: true } },
      district: { select: { nameHi: true } },
    },
  });
  // A school the block office has not confirmed has no public page: an
  // unverified school with a village-facing noticeboard is exactly the shape a
  // fake school would want.
  if (!school || school.status !== 'ACTIVE') throw notFound('School not found');

  const [enrolment, work, open, met, meeting, outOfSchool] = await Promise.all([
    prisma.classEnrolment.findMany({
      where: { schoolId: school.id },
      orderBy: { classLevel: 'asc' },
      select: { classLevel: true, enrolled: true, asOn: true },
    }),
    prisma.activity.findMany({
      where: {
        schoolId: school.id,
        status: 'PUBLISHED',
        // Cleared by a block officer, or auto-cleared on the school's record.
        // Nothing still awaiting a decision reaches a public wall.
        clearance: { in: ['CLEARED', 'AUTO_CLEARED'] },
        visibility: { in: ['BLOCK', 'DISTRICT', 'STATE', 'PUBLIC'] },
      },
      orderBy: { occurredOn: 'desc' },
      take: 8,
      select: { id: true, title: true, occurredOn: true, category: true, schemes: true },
    }),
    prisma.schoolNeed.findMany({
      where: { schoolId: school.id, status: { in: ['OPEN', 'PROMISED'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.schoolNeed.findMany({
      where: { schoolId: school.id, status: 'MET' },
      orderBy: { metOn: 'desc' },
      take: 5,
    }),
    prisma.smcMeeting.findFirst({
      where: { schoolId: school.id },
      orderBy: { heldOn: 'desc' },
      include: { recordedBy: { select: { fullName: true } } },
    }),
    summariseSurveys(prisma, { schoolId: school.id }),
  ]);

  return {
    udiseCode: school.udiseCode,
    schoolName: school.nameHi,
    blockName: school.block.nameHi,
    districtName: school.district.nameHi,
    villageOrWard: school.villageOrWard,
    enrolment: {
      total: enrolment.reduce((sum, row) => sum + row.enrolled, 0),
      classes: enrolment.map((row) => ({
        classLevel: toApiClassLevel(row.classLevel),
        enrolled: row.enrolled,
      })),
      asOn: enrolment[0]?.asOn.toISOString().slice(0, 10) ?? null,
    },
    recentWork: work.map((row) => ({
      id: row.id,
      title: row.title,
      occurredOn: row.occurredOn.toISOString().slice(0, 10),
      category: row.category,
      schemes: row.schemes,
    })),
    openNeeds: open.map(toNeed),
    recentlyMet: met.map(toNeed),
    lastSmcMeeting: meeting
      ? {
          id: meeting.id,
          heldOn: meeting.heldOn.toISOString().slice(0, 10),
          membersPresent: meeting.membersPresent,
          parentsPresent: meeting.parentsPresent,
          womenPresent: meeting.womenPresent,
          decisions: meeting.decisions,
          raisedWithBlock: meeting.raisedWithBlock,
          recordedByName: meeting.recordedBy.fullName,
          createdAt: meeting.createdAt.toISOString(),
        }
      : null,
    outOfSchool,
  };
}
