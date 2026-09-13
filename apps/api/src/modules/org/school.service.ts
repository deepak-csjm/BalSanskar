import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CreateSchoolInput,
  ListSchoolsQuery,
  SchoolDetail,
  SchoolLookup,
  SchoolSummary,
  UpdateSchoolInput,
} from '@balsanskar/shared';
import { conflict, notFound } from '../../lib/errors.js';
import { decodeCursor, paginate } from '../../lib/validate.js';
import { recordAudit, type AuditContext } from '../../lib/audit.js';
import { resolveScopeFilter, type ScopeFilter } from '../../lib/scope.js';
import type { Actor } from '../../plugins/auth.js';
import { isPrismaError, PG_ERROR } from '../../lib/prisma.js';

const schoolInclude = {
  district: { select: { id: true, nameHi: true } },
  block: { select: { id: true, nameHi: true } },
} satisfies Prisma.SchoolInclude;

type SchoolRow = Prisma.SchoolGetPayload<{ include: typeof schoolInclude }>;

function toSummary(row: SchoolRow): SchoolSummary {
  return {
    id: row.id,
    udiseCode: row.udiseCode,
    nameHi: row.nameHi,
    nameEn: row.nameEn,
    type: row.type,
    districtId: row.districtId,
    districtName: row.district.nameHi,
    blockId: row.blockId,
    blockName: row.block.nameHi,
    villageOrWard: row.villageOrWard,
    isActive: row.isActive,
  };
}

export async function listSchools(
  prisma: PrismaClient,
  actor: Actor,
  query: ListSchoolsQuery,
): Promise<{ items: SchoolSummary[]; nextCursor: string | null }> {
  const scope = resolveScopeFilter(actor, {
    districtId: query.districtId,
    blockId: query.blockId,
  });

  const cursorId = decodeCursor(query.cursor);
  const where: Prisma.SchoolWhereInput = {
    ...scopeToSchoolWhere(scope),
    ...(query.type ? { type: query.type } : {}),
    ...(query.search ? { OR: nameSearch(query.search) } : {}),
  };

  const rows = await prisma.school.findMany({
    where,
    include: schoolInclude,
    orderBy: { id: 'asc' },
    take: query.limit + 1,
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const page = paginate(rows, query.limit, (row) => row.id);
  return { items: page.items.map(toSummary), nextCursor: page.nextCursor };
}

/**
 * Prefix search over Hindi and English names, and an exact match on the UDISE
 * code. Teachers reliably know the code; they spell the name three different
 * ways.
 */
function nameSearch(search: string): Prisma.SchoolWhereInput[] {
  return [
    { nameHi: { startsWith: search, mode: 'insensitive' } },
    { nameEn: { startsWith: search, mode: 'insensitive' } },
    { udiseCode: search },
  ];
}

export function scopeToSchoolWhere(scope: ScopeFilter): Prisma.SchoolWhereInput {
  if (scope.schoolId) return { id: scope.schoolId };
  if (scope.blockId) return { blockId: scope.blockId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

export async function getSchool(
  prisma: PrismaClient,
  actor: Actor,
  schoolId: string,
): Promise<SchoolDetail> {
  const row = await prisma.school.findUnique({ where: { id: schoolId }, include: schoolInclude });
  if (!row) throw notFound('School not found');

  // Read access to a school record is scoped like everything else: this throws
  // if the school sits outside the caller's patch.
  resolveScopeFilter(actor, { districtId: row.districtId, blockId: row.blockId, schoolId: row.id });

  const [studentCount, teacherCount, publishedActivityCount] = await Promise.all([
    prisma.classEnrolment.aggregate({ where: { schoolId }, _sum: { enrolled: true } }),
    prisma.user.count({ where: { schoolId, status: 'ACTIVE' } }),
    prisma.activity.count({ where: { schoolId, status: 'PUBLISHED' } }),
  ]);

  return {
    ...toSummary(row),
    latitude: row.latitude,
    longitude: row.longitude,
    contactPhone: row.contactPhone,
    studentCount: studentCount._sum.enrolled ?? 0,
    teacherCount,
    publishedActivityCount,
  };
}

/**
 * Unauthenticated lookup used during registration.
 *
 * Returns only what a teacher needs to confirm they typed their own school's
 * code — never contact details or roll numbers — because it is reachable
 * without signing in.
 */
export async function lookupSchoolByUdise(
  prisma: PrismaClient,
  udiseCode: string,
): Promise<SchoolLookup> {
  const row = await prisma.school.findUnique({
    where: { udiseCode },
    select: {
      udiseCode: true,
      nameHi: true,
      nameEn: true,
      isActive: true,
      block: { select: { nameHi: true } },
      district: { select: { nameHi: true } },
      _count: { select: { users: true } },
    },
  });
  if (!row || !row.isActive) {
    throw notFound('No school found with that UDISE code');
  }
  return {
    udiseCode: row.udiseCode,
    nameHi: row.nameHi,
    nameEn: row.nameEn,
    blockName: row.block.nameHi,
    districtName: row.district.nameHi,
    isRegistered: row._count.users > 0,
  };
}

export async function createSchool(
  prisma: PrismaClient,
  actor: Actor,
  input: CreateSchoolInput,
  audit: AuditContext,
): Promise<SchoolSummary> {
  const block = await prisma.block.findUnique({
    where: { id: input.blockId },
    select: { id: true, districtId: true },
  });
  if (!block) throw notFound('Block not found');

  // The block decides the district; a caller cannot place a school in a district
  // they administer by naming a block from somewhere else.
  resolveScopeFilter(actor, { districtId: block.districtId, blockId: block.id });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          udiseCode: input.udiseCode,
          nameHi: input.nameHi,
          nameEn: input.nameEn ?? null,
          type: input.type,
          blockId: block.id,
          districtId: block.districtId,
          villageOrWard: input.villageOrWard ?? null,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          contactPhone: input.contactPhone ?? null,
        },
        include: schoolInclude,
      });
      await recordAudit(tx, audit, {
        action: 'SCHOOL_CREATED',
        entityType: 'School',
        entityId: school.id,
        schoolId: school.id,
        blockId: school.blockId,
        districtId: school.districtId,
        metadata: { udiseCode: school.udiseCode },
      });
      return school;
    });
    return toSummary(created);
  } catch (error) {
    if (isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) {
      throw conflict('A school with that UDISE code already exists');
    }
    throw error;
  }
}

export async function updateSchool(
  prisma: PrismaClient,
  actor: Actor,
  schoolId: string,
  input: UpdateSchoolInput,
  audit: AuditContext,
): Promise<SchoolSummary> {
  const existing = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!existing) throw notFound('School not found');

  resolveScopeFilter(actor, {
    districtId: existing.districtId,
    blockId: existing.blockId,
    schoolId: existing.id,
  });

  // A head teacher may correct their own school's details but may not
  // deactivate it; that is an administrative decision.
  const data: Prisma.SchoolUpdateInput = {
    ...(input.nameHi !== undefined ? { nameHi: input.nameHi } : {}),
    ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.villageOrWard !== undefined ? { villageOrWard: input.villageOrWard } : {}),
    ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
    ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
    ...(input.isActive !== undefined && actor.role !== 'PRINCIPAL' && actor.role !== 'TEACHER'
      ? { isActive: input.isActive }
      : {}),
  };

  const updated = await prisma.$transaction(async (tx) => {
    const school = await tx.school.update({
      where: { id: schoolId },
      data,
      include: schoolInclude,
    });
    await recordAudit(tx, audit, {
      action: 'SCHOOL_UPDATED',
      entityType: 'School',
      entityId: school.id,
      schoolId: school.id,
      blockId: school.blockId,
      districtId: school.districtId,
      metadata: { changed: Object.keys(data) },
    });
    return school;
  });

  return toSummary(updated);
}
