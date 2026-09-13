import type { PrismaClient } from '@prisma/client';
import type { ClassLevel, Enrolment, SetEnrolmentInput } from '@balsanskar/shared';
import { forbidden, notFound } from '../../lib/errors.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter } from '../../lib/scope.js';
import { toApiClassLevel, toDbClassLevel, toDbClassLevels } from '../../lib/class-level.js';
import type { Actor } from '../../plugins/auth.js';

/**
 * How many children a school teaches, by class.
 *
 * This replaced a roster of named children, and the replacement is smaller in
 * every sense: one number per class instead of a record per child, updated once
 * a term instead of continuously, and holding nothing about anybody. See
 * docs/data-protection.md for why.
 *
 * It also removed the most resented screen in the product. A head teacher was
 * being asked to type in two hundred children, keep them current, and chase a
 * signed slip for each one — work that produced nothing they could see. What
 * the platform actually needed from all of that was a denominator.
 */

/** The same scope rule the rest of the API applies, answered once here. */
function assertWithinReach(
  actor: Actor,
  school: { id: string; blockId: string; districtId: string },
): void {
  const scope = resolveScopeFilter(actor, {});
  if (scope.schoolId && scope.schoolId !== school.id) {
    throw forbidden('This school is outside your area');
  }
  if (scope.blockId && scope.blockId !== school.blockId) {
    throw forbidden('This school is outside your area');
  }
  if (scope.districtId && scope.districtId !== school.districtId) {
    throw forbidden('This school is outside your area');
  }
}

export async function getEnrolment(
  prisma: PrismaClient,
  actor: Actor,
  schoolId: string,
): Promise<Enrolment> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, nameHi: true, blockId: true, districtId: true },
  });
  if (!school) throw notFound('School not found');
  assertWithinReach(actor, school);

  const rows = await prisma.classEnrolment.findMany({
    where: { schoolId },
    orderBy: { classLevel: 'asc' },
    include: { updatedBy: { select: { fullName: true } } },
  });

  const latest = rows.reduce<(typeof rows)[number] | null>(
    (newest, row) => (newest === null || row.updatedAt > newest.updatedAt ? row : newest),
    null,
  );

  return {
    schoolId: school.id,
    schoolName: school.nameHi,
    classes: rows.map((row) => ({
      classLevel: toApiClassLevel(row.classLevel),
      enrolled: row.enrolled,
    })),
    total: rows.reduce((sum, row) => sum + row.enrolled, 0),
    asOn: latest?.asOn.toISOString().slice(0, 10) ?? null,
    updatedByName: latest?.updatedBy?.fullName ?? null,
    updatedAt: latest?.updatedAt.toISOString() ?? null,
  };
}

/**
 * Records the register, replacing whatever was there.
 *
 * A whole-form replace rather than per-class edits: a head teacher reads the
 * register once and enters what it says, and a class that has vanished from the
 * form has vanished from the school. Partial updates would leave a class
 * lingering at last term's number with nothing to show it was stale.
 */
export async function setEnrolment(
  prisma: PrismaClient,
  actor: Actor,
  schoolId: string,
  input: SetEnrolmentInput,
  audit: AuditContext,
): Promise<Enrolment> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, blockId: true, districtId: true },
  });
  if (!school) throw notFound('School not found');
  assertWithinReach(actor, school);

  const asOn = new Date(`${input.asOn}T00:00:00.000Z`);
  const seen = new Set<string>();
  const classes = input.classes.filter((row) => {
    if (seen.has(row.classLevel)) return false;
    seen.add(row.classLevel);
    return true;
  });

  await prisma.$transaction(async (tx) => {
    await tx.classEnrolment.deleteMany({
      where: {
        schoolId,
        classLevel: { notIn: toDbClassLevels(classes.map((row) => row.classLevel)) },
      },
    });
    for (const row of classes) {
      await tx.classEnrolment.upsert({
        where: {
          schoolId_classLevel: { schoolId, classLevel: toDbClassLevel(row.classLevel) },
        },
        create: {
          schoolId,
          classLevel: toDbClassLevel(row.classLevel),
          enrolled: row.enrolled,
          asOn,
          updatedById: actor.id,
        },
        update: { enrolled: row.enrolled, asOn, updatedById: actor.id },
      });
    }
    await recordAudit(tx, audit, {
      action: 'ENROLMENT_RECORDED',
      entityType: 'School',
      entityId: schoolId,
      schoolId,
      blockId: school.blockId,
      districtId: school.districtId,
      metadata: {
        asOn: input.asOn,
        total: classes.reduce((sum, row) => sum + row.enrolled, 0),
      },
    });
  });

  return getEnrolment(prisma, actor, schoolId);
}

/**
 * The denominator the over-counting risk check compares against.
 *
 * Zero when a school has not recorded its register yet, which the caller must
 * read as "cannot say" rather than "no children" — flagging every activity at
 * every school that has not filled the form in would flood the block queue on
 * day one and teach officers to ignore it.
 */
export async function countEnrolled(
  prisma: PrismaClient,
  schoolId: string,
  classLevels: readonly ClassLevel[] = [],
): Promise<number> {
  const rows = await prisma.classEnrolment.findMany({
    where: {
      schoolId,
      ...(classLevels.length > 0 ? { classLevel: { in: toDbClassLevels([...classLevels]) } } : {}),
    },
    select: { enrolled: true },
  });
  return rows.reduce((sum, row) => sum + row.enrolled, 0);
}
