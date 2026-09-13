import type { PrismaClient } from '@prisma/client';
import {
  RESPONSE_EXPECTATION_DAYS,
  type ResponseTimes,
  type ResponseTimeRow,
  type WaitingBoard,
  type WaitingItem,
  type WaitingStage,
} from '@balsanskar/shared';
import { forbidden, notFound } from '../../lib/errors.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * Who is holding this, and for how long.
 *
 * See packages/shared/src/contracts/waiting.ts for why this exists. The short
 * version: this platform puts three offices in the path of a teacher's work,
 * and a platform that timed the teacher but not the offices would reproduce
 * exactly the asymmetry that produced a statewide boycott in July 2024.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(from: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS));
}

/**
 * The office a role owes answers to at each stage.
 *
 * A teacher owes nothing here, and state-level roles sit outside the chain
 * rather than above it — nobody escalates to Lucknow in this design, so
 * pretending Lucknow has a backlog would be a fiction on the screen.
 */
function stageOwedBy(actor: Actor): WaitingStage | null {
  switch (actor.role) {
    case 'PRINCIPAL':
      return 'HEAD_TEACHER';
    case 'BLOCK_ADMIN':
      return 'BLOCK_OFFICE';
    case 'DISTRICT_ADMIN':
      return 'DISTRICT_OFFICE';
    default:
      return null;
  }
}

function toItem(
  partial: Omit<WaitingItem, 'waitingDays' | 'overdue' | 'waitingSince'> & { since: Date },
  now: Date,
): WaitingItem {
  const waitingDays = daysSince(partial.since, now);
  const { since, ...rest } = partial;
  return {
    ...rest,
    waitingSince: since.toISOString(),
    waitingDays,
    overdue: waitingDays > RESPONSE_EXPECTATION_DAYS[partial.stage],
  };
}

/**
 * Everything in the caller's reach that is waiting on somebody.
 *
 * Oldest first, deliberately. A queue ordered by arrival buries the item that
 * has been ignored longest, and that item is the only one on the screen that
 * genuinely needs a decision rather than a glance.
 */
export async function getWaitingBoard(prisma: PrismaClient, actor: Actor): Promise<WaitingBoard> {
  const scope = resolveScopeFilter(actor, {});
  const now = new Date();
  const activityScope = {
    ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    ...(scope.blockId ? { blockId: scope.blockId } : {}),
    ...(scope.districtId ? { districtId: scope.districtId } : {}),
  };

  const include = {
    school: { select: { id: true, nameHi: true, udiseCode: true } },
    block: { select: { nameHi: true } },
    district: { select: { nameHi: true } },
  } as const;

  const [withHead, withBlock, withDistrict, claims, smcRequests] = await Promise.all([
    // Submitted, and the head teacher has neither published nor sent it up.
    // A returned activity counts too: the block has answered and the school
    // owes the next move, which is exactly what the teacher needs to see.
    prisma.activity.findMany({
      where: {
        ...activityScope,
        status: 'PENDING_REVIEW',
        clearance: { in: ['NOT_REQUIRED', 'AWAITING_ATTESTATION', 'RETURNED'] },
      },
      include,
      orderBy: { submittedAt: 'asc' },
      take: 200,
    }),
    prisma.activity.findMany({
      where: { ...activityScope, clearance: 'AWAITING_BLOCK' },
      include,
      orderBy: { attestedAt: 'asc' },
      take: 200,
    }),
    // Cleared by the block and aiming for the open web, which only a district
    // officer can grant. AUTO_CLEARED is deliberately excluded: the policy
    // never lets it reach PUBLIC, so it is not waiting on anyone.
    prisma.activity.findMany({
      where: {
        ...activityScope,
        clearance: 'CLEARED',
        clearanceTarget: 'PUBLIC',
        visibility: { not: 'PUBLIC' },
        status: { not: 'ARCHIVED' },
      },
      include,
      orderBy: { clearedAt: 'asc' },
      take: 200,
    }),
    // A pending claim blocks a whole school from existing, so it is the most
    // expensive thing on this board to leave sitting.
    prisma.schoolClaim.findMany({
      where: {
        status: 'PENDING',
        ...(scope.blockId ? { blockId: scope.blockId } : {}),
        ...(scope.districtId ? { districtId: scope.districtId } : {}),
        // A school-scoped actor has no business in the claims queue.
        ...(scope.schoolId ? { id: '__never__' } : {}),
      },
      include: { block: { select: { nameHi: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    prisma.smcMeeting.findMany({
      where: {
        ...activityScope,
        raisedWithBlock: { not: null },
        answeredAt: null,
      },
      include,
      orderBy: { heldOn: 'asc' },
      take: 200,
    }),
  ]);

  const items: WaitingItem[] = [];

  for (const row of withHead) {
    items.push(
      toItem(
        {
          id: row.id,
          kind: 'ACTIVITY',
          title: row.title,
          schoolId: row.school.id,
          schoolName: row.school.nameHi,
          udiseCode: row.school.udiseCode,
          stage: 'HEAD_TEACHER',
          holder: row.school.nameHi,
          since: row.submittedAt ?? row.createdAt,
        },
        now,
      ),
    );
  }

  for (const row of withBlock) {
    items.push(
      toItem(
        {
          id: row.id,
          kind: 'ACTIVITY',
          title: row.title,
          schoolId: row.school.id,
          schoolName: row.school.nameHi,
          udiseCode: row.school.udiseCode,
          stage: 'BLOCK_OFFICE',
          holder: row.block.nameHi,
          since: row.attestedAt ?? row.submittedAt ?? row.createdAt,
        },
        now,
      ),
    );
  }

  for (const row of withDistrict) {
    items.push(
      toItem(
        {
          id: row.id,
          kind: 'ACTIVITY',
          title: row.title,
          schoolId: row.school.id,
          schoolName: row.school.nameHi,
          udiseCode: row.school.udiseCode,
          stage: 'DISTRICT_OFFICE',
          holder: row.district.nameHi,
          since: row.clearedAt ?? row.attestedAt ?? row.createdAt,
        },
        now,
      ),
    );
  }

  for (const row of claims) {
    items.push(
      toItem(
        {
          id: row.id,
          kind: 'SCHOOL_CLAIM',
          title: row.proposedNameHi,
          schoolId: row.schoolId ?? '',
          schoolName: row.proposedNameHi,
          udiseCode: row.udiseCode,
          stage: 'BLOCK_OFFICE',
          holder: row.block.nameHi,
          since: row.createdAt,
        },
        now,
      ),
    );
  }

  for (const row of smcRequests) {
    items.push(
      toItem(
        {
          id: row.id,
          kind: 'SMC_REQUEST',
          title: row.raisedWithBlock ?? '',
          schoolId: row.school.id,
          schoolName: row.school.nameHi,
          udiseCode: row.school.udiseCode,
          stage: 'BLOCK_OFFICE',
          holder: row.block.nameHi,
          since: row.heldOn,
        },
        now,
      ),
    );
  }

  items.sort((a, b) => b.waitingDays - a.waitingDays);

  const owed = stageOwedBy(actor);
  return {
    items,
    owedByYou: owed ? items.filter((item) => item.stage === owed).length : 0,
    oldestDays: items[0]?.waitingDays ?? 0,
    total: items.length,
  };
}

/**
 * The block's written answer to something a committee of parents asked for.
 *
 * In writing and attributed, because the one reform teachers welcomed in the
 * Manav Sampada leave portal was the rule that forced an officer to record a
 * reason. The same principle applies to the village: a committee that is told
 * "no" by a named officer with a reason has been answered; one whose request
 * simply stops appearing has been ignored with extra steps.
 */
export async function answerSmcRequest(
  prisma: PrismaClient,
  actor: Actor,
  id: string,
  input: { answer: string },
  audit: AuditContext,
): Promise<{ id: string; answeredAt: string; answerNote: string; answeredByName: string }> {
  const meeting = await prisma.smcMeeting.findUnique({
    where: { id },
    select: { id: true, schoolId: true, blockId: true, districtId: true, raisedWithBlock: true },
  });
  if (!meeting) throw notFound('No such meeting');
  if (!meeting.raisedWithBlock) {
    throw forbidden('This meeting asked the block office for nothing');
  }

  const scope = resolveScopeFilter(actor, {});
  if (scope.schoolId) throw forbidden('Only the block office can answer what a committee raised');
  if (scope.blockId && scope.blockId !== meeting.blockId) {
    throw forbidden('This school is outside your area');
  }
  if (scope.districtId && scope.districtId !== meeting.districtId) {
    throw forbidden('This school is outside your area');
  }

  const answeredAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.smcMeeting.update({
      where: { id },
      data: { answeredAt, answeredById: actor.id, answerNote: input.answer },
    });
    await recordAudit(tx, audit, {
      action: 'SMC_REQUEST_ANSWERED',
      entityType: 'SmcMeeting',
      entityId: id,
      schoolId: meeting.schoolId,
      blockId: meeting.blockId,
      districtId: meeting.districtId,
    });
  });

  return {
    id,
    answeredAt: answeredAt.toISOString(),
    answerNote: input.answer,
    answeredByName: actor.fullName,
  };
}

// ---------------------------------------------------------------------------
// The mirror
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
      : (sorted[middle] ?? 0);
  return Math.round(value * 10) / 10;
}

/**
 * How long each office actually takes.
 *
 * The counterpart to the school reports an officer already reads, and grouped
 * the same way those are: by office, never by person. A district officer sees
 * their blocks; the state sees districts. The rule that stops a teacher being
 * ranked stops a block officer being ranked, for the same reason and with the
 * same wording — an officer measured by name starts clearing work without
 * reading it, which defeats the point of having a gate.
 */
export async function getResponseTimes(
  prisma: PrismaClient,
  actor: Actor,
  window: { from: Date; to: Date },
): Promise<ResponseTimes> {
  const scope = resolveScopeFilter(actor, {});
  const now = new Date();
  const activityScope = {
    ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    ...(scope.blockId ? { blockId: scope.blockId } : {}),
    ...(scope.districtId ? { districtId: scope.districtId } : {}),
  };

  // A block officer looking at their own office sees one row; a district
  // officer sees a row per block. Nothing here ever resolves to a person.
  const groupByBlock = actor.role !== 'STATE_ADMIN' && actor.role !== 'SUPER_ADMIN';

  const [decided, pending] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...activityScope,
        clearedAt: { gte: window.from, lte: window.to },
        attestedAt: { not: null },
      },
      select: {
        blockId: true,
        districtId: true,
        attestedAt: true,
        clearedAt: true,
        block: { select: { nameHi: true } },
        district: { select: { nameHi: true } },
      },
      take: 5000,
    }),
    prisma.activity.findMany({
      where: { ...activityScope, clearance: 'AWAITING_BLOCK' },
      select: {
        blockId: true,
        districtId: true,
        attestedAt: true,
        submittedAt: true,
        createdAt: true,
        block: { select: { nameHi: true } },
        district: { select: { nameHi: true } },
      },
      take: 5000,
    }),
  ]);

  const buckets = new Map<string, { name: string; durations: number[]; pending: number[] }>();
  const bucket = (id: string, name: string) => {
    let found = buckets.get(id);
    if (!found) {
      found = { name, durations: [], pending: [] };
      buckets.set(id, found);
    }
    return found;
  };

  for (const row of decided) {
    if (!row.attestedAt || !row.clearedAt) continue;
    const key = groupByBlock ? row.blockId : row.districtId;
    const name = groupByBlock ? row.block.nameHi : row.district.nameHi;
    bucket(key, name).durations.push(daysSince(row.attestedAt, row.clearedAt));
  }
  for (const row of pending) {
    const key = groupByBlock ? row.blockId : row.districtId;
    const name = groupByBlock ? row.block.nameHi : row.district.nameHi;
    bucket(key, name).pending.push(
      daysSince(row.attestedAt ?? row.submittedAt ?? row.createdAt, now),
    );
  }

  const rows: ResponseTimeRow[] = [...buckets.entries()].map(([id, value]) => ({
    id,
    name: value.name,
    stage: 'BLOCK_OFFICE' as const,
    decided: value.durations.length,
    medianDays: median(value.durations),
    slowestDays: value.durations.length ? Math.max(...value.durations) : 0,
    pending: value.pending.length,
    oldestPendingDays: value.pending.length ? Math.max(...value.pending) : 0,
  }));

  // Slowest first: this report exists to find the office that has stopped
  // answering, not to congratulate the one that has not.
  rows.sort((a, b) => b.oldestPendingDays - a.oldestPendingDays || b.medianDays - a.medianDays);

  return { from: window.from.toISOString(), to: window.to.toISOString(), rows };
}
