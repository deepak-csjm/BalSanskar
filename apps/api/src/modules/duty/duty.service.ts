import type { Prisma, PrismaClient } from '@prisma/client';
import {
  isSection27Purpose,
  type DutyCategory,
  type DutyRecord,
  type DutySummary,
  type ListDutiesQuery,
  type RecordDutyInput,
} from '@balsanskar/shared';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * Teaching days consumed by work that is not teaching.
 *
 * See packages/shared/src/contracts/duty.ts for why this exists and why it is
 * shaped the way it is. The one rule to keep in mind while reading the code:
 * inside a school this is a per-teacher record, and above the school it is a
 * school total with no name attached. Every function here has to hold that
 * line, and `assertNoNamesAboveSchool` is where it is held.
 */

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toRecord(
  row: {
    id: string;
    category: DutyCategory;
    description: string;
    orderReference: string | null;
    fromDate: Date;
    toDate: Date;
    teachingDaysLost: number;
    duringSchoolHours: boolean;
    honorariumDueRupees: number | null;
    honorariumReceivedRupees: number | null;
    note: string | null;
    attestedAt: Date | null;
    createdAt: Date;
    teacher?: { fullName: string } | null;
    attestedBy?: { fullName: string } | null;
  },
  withNames: boolean,
): DutyRecord {
  return {
    id: row.id,
    category: row.category,
    section27: isSection27Purpose(row.category),
    description: row.description,
    orderReference: row.orderReference,
    fromDate: row.fromDate.toISOString().slice(0, 10),
    toDate: row.toDate.toISOString().slice(0, 10),
    teachingDaysLost: row.teachingDaysLost,
    duringSchoolHours: row.duringSchoolHours,
    honorariumDueRupees: row.honorariumDueRupees,
    honorariumReceivedRupees: row.honorariumReceivedRupees,
    note: row.note,
    // The line the whole feature depends on. Inside the school a head teacher
    // needs to see how the load is distributed — districts exempted head
    // teachers from Census 2027 duty, which simply pushed it onto assistant
    // teachers, and nobody can see that happen today. Outside it, a name
    // attached to days-absent-from-class is a disciplinary document.
    teacherName: withNames ? (row.teacher?.fullName ?? null) : null,
    attestedByName: withNames ? (row.attestedBy?.fullName ?? null) : null,
    attestedAt: row.attestedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** True only when the caller is inside the single school being listed. */
function seesNames(actor: Actor, scope: { schoolId?: string }): boolean {
  return Boolean(scope.schoolId) && (actor.role === 'PRINCIPAL' || actor.role === 'TEACHER');
}

export async function recordDuty(
  prisma: PrismaClient,
  actor: Actor,
  input: RecordDutyInput,
  audit: AuditContext,
): Promise<DutyRecord> {
  const { schoolId, blockId, districtId } = actor;
  if (!schoolId || !blockId || !districtId) {
    throw forbidden('Only school staff can record a duty');
  }

  const from = dateOnly(input.fromDate);
  const to = dateOnly(input.toDate);
  if (to < from)
    throw badRequest('The duty cannot end before it started', {
      toDate: ['The end date is before the start date'],
    });

  // A span of N calendar days cannot have cost more than N teaching days. The
  // reverse — fewer, because of Sundays and holidays — is the normal case and
  // is exactly why the field is asked for rather than computed.
  const spanDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (input.teachingDaysLost > spanDays) {
    throw badRequest('More teaching days than there are days in the period', {
      teachingDaysLost: [`This period is ${spanDays} days long`],
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const duty = await tx.dutyRecord.create({
      data: {
        schoolId,
        blockId,
        districtId,
        teacherId: actor.id,
        category: input.category,
        description: input.description,
        orderReference: input.orderReference || null,
        fromDate: from,
        toDate: to,
        teachingDaysLost: input.teachingDaysLost,
        duringSchoolHours: input.duringSchoolHours,
        honorariumDueRupees: input.honorariumDueRupees ?? null,
        honorariumReceivedRupees: input.honorariumReceivedRupees ?? null,
        note: input.note || null,
      },
      include: { teacher: { select: { fullName: true } } },
    });
    await recordAudit(tx, audit, {
      action: 'DUTY_RECORDED',
      entityType: 'DutyRecord',
      entityId: duty.id,
      schoolId,
      blockId,
      districtId,
      metadata: { category: input.category, teachingDaysLost: input.teachingDaysLost },
    });
    return duty;
  });

  return toRecord(created, true);
}

/**
 * The head teacher's confirmation that the school really did lose these days.
 *
 * Without it the number is one person's word. With it, it is the school's
 * record — which is what makes it worth anything to a block officer, and what
 * makes it evidence rather than a complaint.
 *
 * Deliberately carries no score and no aggregate. Head teachers in this state
 * have had their salaries stopped in bulk over district-wide data-compliance
 * failures they did not individually cause; the moment attestation becomes a
 * number a district can be ranked on, head teachers will either refuse to
 * attest or attest everything blindly, and both destroy the record.
 */
export async function attestDuty(
  prisma: PrismaClient,
  actor: Actor,
  id: string,
  audit: AuditContext,
): Promise<DutyRecord> {
  const duty = await prisma.dutyRecord.findUnique({
    where: { id },
    select: { id: true, schoolId: true, blockId: true, districtId: true, teacherId: true },
  });
  if (!duty) throw notFound('No such duty record');
  if (actor.schoolId !== duty.schoolId) throw forbidden('This school is outside your area');
  if (duty.teacherId === actor.id) {
    throw forbidden('Somebody else has to confirm your own duty record');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.dutyRecord.update({
      where: { id },
      data: { attestedById: actor.id, attestedAt: new Date() },
      include: {
        teacher: { select: { fullName: true } },
        attestedBy: { select: { fullName: true } },
      },
    });
    await recordAudit(tx, audit, {
      action: 'DUTY_ATTESTED',
      entityType: 'DutyRecord',
      entityId: id,
      schoolId: duty.schoolId,
      blockId: duty.blockId,
      districtId: duty.districtId,
    });
    return row;
  });

  return toRecord(updated, true);
}

function whereFor(actor: Actor, query: ListDutiesQuery): Prisma.DutyRecordWhereInput {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  return {
    ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    ...(scope.blockId ? { blockId: scope.blockId } : {}),
    ...(scope.districtId ? { districtId: scope.districtId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.from ? { toDate: { gte: dateOnly(query.from) } } : {}),
    ...(query.to ? { fromDate: { lte: dateOnly(query.to) } } : {}),
  };
}

export async function listDuties(
  prisma: PrismaClient,
  actor: Actor,
  query: ListDutiesQuery,
): Promise<DutyRecord[]> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  // A teacher sees their own days and nobody else's; the head teacher sees the
  // school. An officer who asks for one school's list gets it without names.
  const mine = actor.role === 'TEACHER' ? { teacherId: actor.id } : {};
  const rows = await prisma.dutyRecord.findMany({
    where: { ...whereFor(actor, query), ...mine },
    include: {
      teacher: { select: { fullName: true } },
      attestedBy: { select: { fullName: true } },
    },
    orderBy: { fromDate: 'desc' },
    take: 500,
  });
  const withNames = seesNames(actor, scope);
  return rows.map((row) => toRecord(row, withNames));
}

/**
 * The roll-up, which is the number nobody in the state currently has.
 *
 * Grouped by category so that the days the Act permits and the days it does not
 * list are separable without anybody having to characterise them. No name
 * appears at any level, including the school's own summary — a summary is for
 * arguing about the load, and a name in it turns the argument into a case.
 */
export async function summariseDuties(
  prisma: PrismaClient,
  actor: Actor,
  query: ListDutiesQuery,
): Promise<DutySummary> {
  const where = whereFor(actor, query);
  const [byCategory, totals, hours, schools] = await Promise.all([
    prisma.dutyRecord.groupBy({
      by: ['category'],
      where,
      _sum: { teachingDaysLost: true },
      _count: { _all: true },
    }),
    prisma.dutyRecord.aggregate({
      where,
      _sum: { teachingDaysLost: true, honorariumDueRupees: true, honorariumReceivedRupees: true },
    }),
    prisma.dutyRecord.aggregate({
      where: { ...where, duringSchoolHours: true },
      _sum: { teachingDaysLost: true },
    }),
    prisma.dutyRecord.findMany({ where, select: { schoolId: true }, distinct: ['schoolId'] }),
  ]);

  const rows = byCategory
    .map((row) => ({
      category: row.category as DutyCategory,
      section27: isSection27Purpose(row.category as DutyCategory),
      days: row._sum.teachingDaysLost ?? 0,
      records: row._count._all,
    }))
    .sort((a, b) => b.days - a.days);

  const section27Days = rows.filter((r) => r.section27).reduce((n, r) => n + r.days, 0);
  const total = totals._sum.teachingDaysLost ?? 0;
  const due = totals._sum.honorariumDueRupees ?? 0;
  const received = totals._sum.honorariumReceivedRupees ?? 0;

  return {
    from: query.from ?? '',
    to: query.to ?? '',
    teachingDaysLost: total,
    section27Days,
    otherDays: total - section27Days,
    duringSchoolHoursDays: hours._sum.teachingDaysLost ?? 0,
    byCategory: rows,
    honorarium: {
      dueRupees: due,
      receivedRupees: received,
      // Never negative: an overpayment is not this platform's business, and a
      // negative number here would read as the teacher owing the department.
      outstandingRupees: Math.max(0, due - received),
    },
    schools: schools.length,
  };
}
