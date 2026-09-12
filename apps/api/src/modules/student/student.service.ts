import type { Prisma, PrismaClient } from '@prisma/client';
import {
  ERROR_CODES,
  type ConsentRecord,
  type CreateStudentInput,
  type ListStudentsQuery,
  type RecordConsentInput,
  type Student,
  type UpdateStudentInput,
} from '@balsanskar/shared';
import { AppError, conflict, invalidState, notFound } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter, type ScopeFilter } from '../../lib/scope.js';
import { isPrismaError, PG_ERROR } from '../../lib/prisma.js';
import { toApiClassLevel, toDbClassLevel } from '../../lib/class-level.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * Student records and the guardian consent attached to them.
 *
 * Everything in this module concerns a minor, so two rules hold throughout:
 * a record is only ever readable inside the child's own school unless an
 * officer with oversight asks for it, and every write leaves an audit row.
 */

const studentInclude = {
  consents: {
    where: { isCurrent: true },
    take: 1,
    select: { status: true },
  },
} satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    schoolId: row.schoolId,
    fullName: row.fullName,
    classLevel: toApiClassLevel(row.classLevel),
    section: row.section,
    rollNumber: row.rollNumber,
    gender: row.gender,
    birthYear: row.birthYear,
    guardianName: row.guardianName,
    guardianPhone: row.guardianPhone,
    isActive: row.isActive,
    mediaConsent: row.consents[0]?.status ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function scopeToStudentWhere(scope: ScopeFilter): Prisma.StudentWhereInput {
  if (scope.schoolId) return { schoolId: scope.schoolId };
  if (scope.blockId) return { school: { blockId: scope.blockId } };
  if (scope.districtId) return { school: { districtId: scope.districtId } };
  return {};
}

export async function listStudents(
  prisma: PrismaClient,
  actor: Actor,
  query: ListStudentsQuery,
): Promise<{ items: Student[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, { schoolId: query.schoolId });
  const cursorId = decodeCursor(query.cursor);

  const rows = await prisma.student.findMany({
    where: {
      ...scopeToStudentWhere(scope),
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(query.classLevel ? { classLevel: toDbClassLevel(query.classLevel) } : {}),
      ...(query.section ? { section: query.section } : {}),
      ...(query.search ? { fullName: { startsWith: query.search, mode: 'insensitive' } } : {}),
    },
    include: studentInclude,
    orderBy: { id: 'asc' },
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  return { items: page.items.map(toStudent), nextCursor: page.nextCursor };
}

/** Loads a student and refuses if they are outside the caller's area. */
export async function loadStudentInScope(
  prisma: PrismaClient,
  actor: Actor,
  studentId: string,
): Promise<StudentRow & { school: { id: string; blockId: string; districtId: string } }> {
  const row = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      ...studentInclude,
      school: { select: { id: true, blockId: true, districtId: true } },
    },
  });
  if (!row) throw notFound('Student not found');
  resolveScopeFilter(actor, {
    schoolId: row.schoolId,
    blockId: row.school.blockId,
    districtId: row.school.districtId,
  });
  return row;
}

export async function getStudent(
  prisma: PrismaClient,
  actor: Actor,
  studentId: string,
): Promise<Student> {
  return toStudent(await loadStudentInScope(prisma, actor, studentId));
}

export async function createStudent(
  prisma: PrismaClient,
  actor: Actor,
  schoolId: string,
  input: CreateStudentInput,
  audit: AuditContext,
): Promise<Student> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, blockId: true, districtId: true, isActive: true },
  });
  if (!school) throw notFound('School not found');
  if (!school.isActive) throw conflict('That school is marked inactive');
  resolveScopeFilter(actor, {
    schoolId: school.id,
    blockId: school.blockId,
    districtId: school.districtId,
  });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          schoolId: school.id,
          fullName: input.fullName,
          classLevel: toDbClassLevel(input.classLevel),
          section: input.section ?? null,
          rollNumber: input.rollNumber ?? null,
          gender: input.gender,
          birthYear: input.birthYear ?? null,
          guardianName: input.guardianName,
          guardianPhone: input.guardianPhone ?? null,
          createdById: actor.id,
        },
        include: studentInclude,
      });
      await recordAudit(tx, audit, {
        action: 'STUDENT_CREATED',
        entityType: 'Student',
        entityId: student.id,
        schoolId: school.id,
        blockId: school.blockId,
        districtId: school.districtId,
      });
      return student;
    });
    return toStudent(created);
  } catch (error) {
    if (isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      throw conflict('A student with that roll number already exists in this class and section');
    }
    throw error;
  }
}

export async function updateStudent(
  prisma: PrismaClient,
  actor: Actor,
  studentId: string,
  input: UpdateStudentInput,
  audit: AuditContext,
): Promise<Student> {
  const existing = await loadStudentInScope(prisma, actor, studentId);

  const data: Prisma.StudentUpdateInput = {
    ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
    ...(input.classLevel !== undefined ? { classLevel: toDbClassLevel(input.classLevel) } : {}),
    ...(input.section !== undefined ? { section: input.section } : {}),
    ...(input.rollNumber !== undefined ? { rollNumber: input.rollNumber } : {}),
    ...(input.gender !== undefined ? { gender: input.gender } : {}),
    ...(input.birthYear !== undefined ? { birthYear: input.birthYear } : {}),
    ...(input.guardianName !== undefined ? { guardianName: input.guardianName } : {}),
    ...(input.guardianPhone !== undefined ? { guardianPhone: input.guardianPhone } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const student = await tx.student.update({
        where: { id: studentId },
        data,
        include: studentInclude,
      });
      await recordAudit(tx, audit, {
        action: input.isActive === false ? 'STUDENT_DEACTIVATED' : 'STUDENT_UPDATED',
        entityType: 'Student',
        entityId: student.id,
        schoolId: existing.schoolId,
        blockId: existing.school.blockId,
        districtId: existing.school.districtId,
        metadata: { changed: Object.keys(data) },
      });
      return student;
    });
    return toStudent(updated);
  } catch (error) {
    if (isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      throw conflict('A student with that roll number already exists in this class and section');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Guardian consent
// ---------------------------------------------------------------------------

function toConsentRecord(
  row: Prisma.MediaConsentGetPayload<{ include: { recordedBy: { select: { fullName: true } } } }>,
): ConsentRecord {
  return {
    id: row.id,
    studentId: row.studentId,
    status: row.status,
    method: row.method,
    guardianName: row.guardianName,
    guardianRelation: row.guardianRelation,
    hasDocument: row.documentKey !== null,
    note: row.note,
    recordedByName: row.recordedBy.fullName,
    recordedAt: row.recordedAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

/**
 * Records a guardian's decision, superseding any earlier one.
 *
 * The previous decision is not deleted or edited; it is marked as no longer
 * current. A school must be able to show what it believed, and when it believed
 * it, at the time a photograph was published.
 */
export async function recordConsent(
  prisma: PrismaClient,
  actor: Actor,
  studentId: string,
  input: RecordConsentInput,
  audit: AuditContext,
): Promise<ConsentRecord> {
  const student = await loadStudentInScope(prisma, actor, studentId);

  const created = await prisma.$transaction(async (tx) => {
    await tx.mediaConsent.updateMany({
      where: { studentId, isCurrent: true },
      data: { isCurrent: false },
    });
    const consent = await tx.mediaConsent.create({
      data: {
        studentId,
        status: input.status,
        method: input.method,
        guardianName: input.guardianName,
        guardianRelation: input.guardianRelation ?? null,
        documentKey: input.documentKey ?? null,
        note: input.note ?? null,
        recordedById: actor.id,
        isCurrent: true,
      },
      include: { recordedBy: { select: { fullName: true } } },
    });
    await recordAudit(tx, audit, {
      action: 'CONSENT_RECORDED',
      entityType: 'MediaConsent',
      entityId: consent.id,
      schoolId: student.schoolId,
      blockId: student.school.blockId,
      districtId: student.school.districtId,
      metadata: { studentId, status: input.status, method: input.method },
    });
    return consent;
  });

  return toConsentRecord(created);
}

/**
 * Withdraws consent.
 *
 * A guardian can change their mind at any time, and when they do the change has
 * to reach everything already published. Any public activity naming the child is
 * pulled back to district visibility in the same transaction — not queued for a
 * moderator, not flagged for review. Consent withdrawn means the photograph
 * comes off the open web immediately.
 */
export async function revokeConsent(
  prisma: PrismaClient,
  actor: Actor,
  studentId: string,
  reason: string,
  audit: AuditContext,
): Promise<{ consent: ConsentRecord; unpublishedActivityCount: number }> {
  const student = await loadStudentInScope(prisma, actor, studentId);

  const current = await prisma.mediaConsent.findFirst({ where: { studentId, isCurrent: true } });
  if (!current) throw notFound('No consent has been recorded for this student');
  if (current.status === 'REVOKED') throw invalidState('Consent has already been withdrawn');

  const result = await prisma.$transaction(async (tx) => {
    await tx.mediaConsent.updateMany({
      where: { studentId, isCurrent: true },
      data: { isCurrent: false },
    });
    const consent = await tx.mediaConsent.create({
      data: {
        studentId,
        status: 'REVOKED',
        method: current.method,
        guardianName: current.guardianName,
        guardianRelation: current.guardianRelation,
        note: current.note,
        recordedById: actor.id,
        revokedById: actor.id,
        revokedAt: new Date(),
        revokeReason: reason,
        isCurrent: true,
      },
      include: { recordedBy: { select: { fullName: true } } },
    });

    const affected = await tx.activity.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        recognisedStudents: { some: { studentId } },
      },
      select: { id: true },
    });

    if (affected.length > 0) {
      await tx.activity.updateMany({
        where: { id: { in: affected.map((row) => row.id) } },
        data: { visibility: 'DISTRICT' },
      });
      for (const activity of affected) {
        await recordAudit(tx, audit, {
          action: 'ACTIVITY_UPDATED',
          entityType: 'Activity',
          entityId: activity.id,
          schoolId: student.schoolId,
          blockId: student.school.blockId,
          districtId: student.school.districtId,
          metadata: {
            reason: 'CONSENT_REVOKED',
            studentId,
            visibilityChangedTo: 'DISTRICT',
          },
        });
      }
    }

    await recordAudit(tx, audit, {
      action: 'CONSENT_REVOKED',
      entityType: 'MediaConsent',
      entityId: consent.id,
      schoolId: student.schoolId,
      blockId: student.school.blockId,
      districtId: student.school.districtId,
      metadata: { studentId, reason, unpublishedActivities: affected.length },
    });

    return { consent, unpublishedActivityCount: affected.length };
  });

  return {
    consent: toConsentRecord(result.consent),
    unpublishedActivityCount: result.unpublishedActivityCount,
  };
}

export async function listConsentHistory(
  prisma: PrismaClient,
  actor: Actor,
  studentId: string,
): Promise<ConsentRecord[]> {
  await loadStudentInScope(prisma, actor, studentId);
  const rows = await prisma.mediaConsent.findMany({
    where: { studentId },
    orderBy: { recordedAt: 'desc' },
    include: { recordedBy: { select: { fullName: true } } },
  });
  return rows.map(toConsentRecord);
}

/**
 * The check the publish path depends on.
 *
 * Returns the students among `studentIds` who do *not* currently have granted
 * consent, so the caller can name them rather than saying "something is wrong".
 */
export async function findStudentsWithoutConsent(
  db: PrismaClient | Prisma.TransactionClient,
  studentIds: string[],
): Promise<Array<{ id: string; fullName: string }>> {
  if (studentIds.length === 0) return [];
  const rows = await db.student.findMany({
    where: { id: { in: studentIds } },
    select: {
      id: true,
      fullName: true,
      consents: { where: { isCurrent: true }, select: { status: true }, take: 1 },
    },
  });
  return rows
    .filter((row) => row.consents[0]?.status !== 'GRANTED')
    .map((row) => ({ id: row.id, fullName: row.fullName }));
}

export function assertConsentPresent(missing: Array<{ fullName: string }>): void {
  if (missing.length === 0) return;
  const names = missing.map((student) => student.fullName).join(', ');
  throw new AppError(
    409,
    ERROR_CODES.CONSENT_MISSING,
    `Guardian consent has not been recorded for: ${names}`,
  );
}
