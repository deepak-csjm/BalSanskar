import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ACHIEVEMENT_LEVELS,
  ACTIVITY_CATEGORIES,
  type Leaderboard,
  type LeaderboardQuery,
  type OverviewReport,
  type ReportQuery,
} from '@balsanskar/shared';
import { describeScopeLevel, resolveScopeFilter, type ScopeFilter } from '../../lib/scope.js';
import type { Actor } from '../../plugins/auth.js';
import { notFound } from '../../lib/errors.js';

/**
 * Reporting.
 *
 * Two properties matter more than anything else here:
 *
 *   1. Only moderated work counts. Activities must be PUBLISHED and achievements
 *      VERIFIED. A dashboard that counts drafts is a dashboard that rewards
 *      typing rather than teaching.
 *   2. The denominator is always the real one. "Active schools" is counted
 *      against every school on the register in scope, not against the schools
 *      that happen to have signed up — otherwise participation reads as 100%
 *      from the first day and tells the department nothing.
 */

const DEFAULT_WINDOW_DAYS = 90;

interface Window {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
}

function resolveWindow(query: ReportQuery): Window {
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date();
  const from = query.from
    ? new Date(`${query.from}T00:00:00.000Z`)
    : new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);
  return {
    from,
    to,
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

function schoolWhere(scope: ScopeFilter): Prisma.SchoolWhereInput {
  if (scope.schoolId) return { id: scope.schoolId };
  if (scope.blockId) return { blockId: scope.blockId };
  if (scope.districtId) return { districtId: scope.districtId };
  return {};
}

function activityWhere(scope: ScopeFilter, window: Window): Prisma.ActivityWhereInput {
  return {
    status: 'PUBLISHED',
    publishedAt: { gte: window.from, lte: window.to },
    ...(scope.schoolId
      ? { schoolId: scope.schoolId }
      : scope.blockId
        ? { blockId: scope.blockId }
        : scope.districtId
          ? { districtId: scope.districtId }
          : {}),
  };
}

function achievementWhere(scope: ScopeFilter, window: Window): Prisma.AchievementWhereInput {
  return {
    status: 'VERIFIED',
    awardedOn: { gte: window.from, lte: window.to },
    ...(scope.schoolId
      ? { schoolId: scope.schoolId }
      : scope.blockId
        ? { blockId: scope.blockId }
        : scope.districtId
          ? { districtId: scope.districtId }
          : {}),
  };
}

export async function buildOverview(
  prisma: PrismaClient,
  actor: Actor,
  query: ReportQuery,
): Promise<OverviewReport> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const window = resolveWindow(query);
  const schools = schoolWhere(scope);
  const activities = activityWhere(scope, window);
  const achievements = achievementWhere(scope, window);

  const [
    schoolCount,
    teacherCount,
    studentCount,
    publishedActivities,
    verifiedAchievements,
    activeSchoolGroups,
    activeTeacherGroups,
    recognisedStudents,
    byCategoryRaw,
    byLevelRaw,
  ] = await Promise.all([
    prisma.school.count({ where: { ...schools, isActive: true } }),
    prisma.user.count({ where: { status: 'ACTIVE', school: schools } }),
    prisma.student.count({ where: { isActive: true, school: schools } }),
    prisma.activity.count({ where: activities }),
    prisma.achievement.count({ where: achievements }),
    prisma.activity.groupBy({ by: ['schoolId'], where: activities, _count: { _all: true } }),
    prisma.activity.groupBy({ by: ['authorId'], where: activities, _count: { _all: true } }),
    prisma.activityStudent.findMany({
      where: { activity: activities },
      select: { studentId: true },
      distinct: ['studentId'],
    }),
    prisma.activity.groupBy({ by: ['category'], where: activities, _count: { _all: true } }),
    prisma.achievement.groupBy({ by: ['level'], where: achievements, _count: { _all: true } }),
  ]);

  const byCategoryMap = new Map(byCategoryRaw.map((row) => [row.category, row._count._all]));
  const byLevelMap = new Map(byLevelRaw.map((row) => [row.level, row._count._all]));

  return {
    scope: {
      level: describeScopeLevel(scope),
      name: await describeScopeName(prisma, scope),
      from: window.fromIso,
      to: window.toIso,
    },
    totals: {
      schools: schoolCount,
      activeSchools: activeSchoolGroups.length,
      teachers: teacherCount,
      activeTeachers: activeTeacherGroups.length,
      students: studentCount,
      publishedActivities,
      verifiedAchievements,
      studentsRecognised: recognisedStudents.length,
    },
    participationRate: {
      schools: schoolCount === 0 ? 0 : round2(activeSchoolGroups.length / schoolCount),
      teachers: teacherCount === 0 ? 0 : round2(activeTeacherGroups.length / teacherCount),
    },
    byCategory: ACTIVITY_CATEGORIES.map((category) => ({
      category,
      count: byCategoryMap.get(category) ?? 0,
    })).filter((row) => row.count > 0),
    byMonth: await monthlySeries(prisma, scope, window),
    achievementsByLevel: ACHIEVEMENT_LEVELS.map((level) => ({
      level,
      count: byLevelMap.get(level) ?? 0,
    })).filter((row) => row.count > 0),
  };
}

function round2(value: number): number {
  return Math.round(value * 10000) / 10000;
}

async function describeScopeName(prisma: PrismaClient, scope: ScopeFilter): Promise<string> {
  if (scope.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: scope.schoolId },
      select: { nameHi: true },
    });
    if (!school) throw notFound('School not found');
    return school.nameHi;
  }
  if (scope.blockId) {
    const block = await prisma.block.findUnique({
      where: { id: scope.blockId },
      select: { nameHi: true },
    });
    if (!block) throw notFound('Block not found');
    return block.nameHi;
  }
  if (scope.districtId) {
    const district = await prisma.district.findUnique({
      where: { id: scope.districtId },
      select: { nameHi: true },
    });
    if (!district) throw notFound('District not found');
    return district.nameHi;
  }
  return 'Uttar Pradesh';
}

/**
 * Month-by-month counts.
 *
 * Written as raw SQL because `GROUP BY date_trunc(...)` has no Prisma
 * equivalent, and pulling every row into Node to bucket it in JavaScript would
 * not survive a state-level query. Every interpolated value goes through a
 * parameter, never string concatenation.
 */
async function monthlySeries(
  prisma: PrismaClient,
  scope: ScopeFilter,
  window: Window,
): Promise<Array<{ month: string; activities: number; achievements: number }>> {
  const scopeColumn = scope.schoolId
    ? Prisma.sql`"schoolId"`
    : scope.blockId
      ? Prisma.sql`"blockId"`
      : scope.districtId
        ? Prisma.sql`"districtId"`
        : null;
  const scopeValue = scope.schoolId ?? scope.blockId ?? scope.districtId ?? null;

  const activityScope =
    scopeColumn && scopeValue ? Prisma.sql`AND ${scopeColumn} = ${scopeValue}` : Prisma.empty;

  const activityRows = await prisma.$queryRaw<Array<{ month: Date; count: bigint }>>(Prisma.sql`
    SELECT date_trunc('month', "publishedAt") AS month, count(*)::bigint AS count
    FROM "activities"
    WHERE "status" = 'PUBLISHED'
      AND "publishedAt" BETWEEN ${window.from} AND ${window.to}
      ${activityScope}
    GROUP BY 1
    ORDER BY 1
  `);

  const achievementRows = await prisma.$queryRaw<Array<{ month: Date; count: bigint }>>(Prisma.sql`
    SELECT date_trunc('month', "awardedOn") AS month, count(*)::bigint AS count
    FROM "achievements"
    WHERE "status" = 'VERIFIED'
      AND "awardedOn" BETWEEN ${window.from} AND ${window.to}
      ${activityScope}
    GROUP BY 1
    ORDER BY 1
  `);

  const months = new Map<string, { activities: number; achievements: number }>();
  const keyOf = (date: Date) => date.toISOString().slice(0, 7);
  for (const row of activityRows) {
    const key = keyOf(row.month);
    months.set(key, { activities: Number(row.count), achievements: 0 });
  }
  for (const row of achievementRows) {
    const key = keyOf(row.month);
    const existing = months.get(key) ?? { activities: 0, achievements: 0 };
    existing.achievements = Number(row.count);
    months.set(key, existing);
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));
}

/**
 * The league table.
 *
 * `LEAST_ACTIVE` is the ordering that matters operationally: it is the list of
 * schools a block officer should visit this month. `MOST_ACTIVE` exists because
 * recognition is what makes teachers use the platform at all.
 */
export async function buildLeaderboard(
  prisma: PrismaClient,
  actor: Actor,
  query: LeaderboardQuery,
): Promise<Leaderboard> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const window = resolveWindow(query);

  if (query.groupBy === 'SCHOOL') {
    const schools = await prisma.school.findMany({
      where: { ...schoolWhere(scope), isActive: true },
      select: {
        id: true,
        nameHi: true,
        block: { select: { nameHi: true } },
      },
      take: 2000,
    });
    const schoolIds = schools.map((row) => row.id);
    const [activityCounts, achievementCounts, recognised, lastActivity] = await Promise.all([
      prisma.activity.groupBy({
        by: ['schoolId'],
        where: { ...activityWhere(scope, window), schoolId: { in: schoolIds } },
        _count: { _all: true },
      }),
      prisma.achievement.groupBy({
        by: ['schoolId'],
        where: { ...achievementWhere(scope, window), schoolId: { in: schoolIds } },
        _count: { _all: true },
      }),
      countRecognisedStudentsBySchool(prisma, scope, window),
      prisma.activity.groupBy({
        by: ['schoolId'],
        where: { ...activityWhere(scope, window), schoolId: { in: schoolIds } },
        _max: { publishedAt: true },
      }),
    ]);

    const activityMap = new Map(activityCounts.map((row) => [row.schoolId, row._count._all]));
    const achievementMap = new Map(achievementCounts.map((row) => [row.schoolId, row._count._all]));
    const lastMap = new Map(lastActivity.map((row) => [row.schoolId, row._max.publishedAt]));

    const rows = schools.map((school) => ({
      id: school.id,
      name: school.nameHi,
      parentName: school.block.nameHi,
      schools: null,
      activeSchools: null,
      publishedActivities: activityMap.get(school.id) ?? 0,
      verifiedAchievements: achievementMap.get(school.id) ?? 0,
      studentsRecognised: recognised.get(school.id) ?? 0,
      lastActivityAt: lastMap.get(school.id)?.toISOString() ?? null,
    }));

    return { groupBy: 'SCHOOL', rows: orderRows(rows, query.order).slice(0, query.limit) };
  }

  const groupField = query.groupBy === 'BLOCK' ? 'blockId' : 'districtId';

  const units =
    query.groupBy === 'BLOCK'
      ? await prisma.block.findMany({
          where: scope.districtId ? { districtId: scope.districtId } : scope.blockId ? { id: scope.blockId } : {},
          select: { id: true, nameHi: true, district: { select: { nameHi: true } } },
        })
      : await prisma.district.findMany({
          where: scope.districtId ? { id: scope.districtId } : {},
          select: { id: true, nameHi: true },
        });

  const unitIds = units.map((unit) => unit.id);

  const [schoolTotals, activityCounts, achievementCounts, activeSchools, lastActivity] =
    await Promise.all([
      prisma.school.groupBy({
        by: [groupField],
        where: { isActive: true, [groupField]: { in: unitIds } },
        _count: { _all: true },
      }),
      prisma.activity.groupBy({
        by: [groupField],
        where: { ...activityWhere(scope, window), [groupField]: { in: unitIds } },
        _count: { _all: true },
      }),
      prisma.achievement.groupBy({
        by: [groupField],
        where: { ...achievementWhere(scope, window), [groupField]: { in: unitIds } },
        _count: { _all: true },
      }),
      prisma.activity.groupBy({
        by: [groupField, 'schoolId'],
        where: { ...activityWhere(scope, window), [groupField]: { in: unitIds } },
      }),
      prisma.activity.groupBy({
        by: [groupField],
        where: { ...activityWhere(scope, window), [groupField]: { in: unitIds } },
        _max: { publishedAt: true },
      }),
    ]);

  const totalMap = new Map(schoolTotals.map((row) => [row[groupField] as string, row._count._all]));
  const activityMap = new Map(
    activityCounts.map((row) => [row[groupField] as string, row._count._all]),
  );
  const achievementMap = new Map(
    achievementCounts.map((row) => [row[groupField] as string, row._count._all]),
  );
  const lastMap = new Map(lastActivity.map((row) => [row[groupField] as string, row._max.publishedAt]));
  const activeMap = new Map<string, number>();
  for (const row of activeSchools) {
    const key = row[groupField] as string;
    activeMap.set(key, (activeMap.get(key) ?? 0) + 1);
  }

  const rows = units.map((unit) => ({
    id: unit.id,
    name: unit.nameHi,
    parentName: hasDistrict(unit) ? unit.district.nameHi : null,
    schools: totalMap.get(unit.id) ?? 0,
    activeSchools: activeMap.get(unit.id) ?? 0,
    publishedActivities: activityMap.get(unit.id) ?? 0,
    verifiedAchievements: achievementMap.get(unit.id) ?? 0,
    studentsRecognised: 0,
    lastActivityAt: lastMap.get(unit.id)?.toISOString() ?? null,
  }));

  return { groupBy: query.groupBy, rows: orderRows(rows, query.order).slice(0, query.limit) };
}

function hasDistrict(unit: unknown): unit is { district: { nameHi: string } } {
  return typeof unit === 'object' && unit !== null && 'district' in unit;
}

function orderRows<T extends { publishedActivities: number; verifiedAchievements: number }>(
  rows: T[],
  order: 'MOST_ACTIVE' | 'LEAST_ACTIVE',
): T[] {
  const score = (row: T) => row.publishedActivities * 2 + row.verifiedAchievements;
  return [...rows].sort((a, b) => (order === 'MOST_ACTIVE' ? score(b) - score(a) : score(a) - score(b)));
}

async function countRecognisedStudentsBySchool(
  prisma: PrismaClient,
  scope: ScopeFilter,
  window: Window,
): Promise<Map<string, number>> {
  const links = await prisma.activityStudent.findMany({
    where: { activity: activityWhere(scope, window) },
    select: { studentId: true, activity: { select: { schoolId: true } } },
    distinct: ['studentId'],
  });
  const counts = new Map<string, number>();
  for (const link of links) {
    const schoolId = link.activity.schoolId;
    counts.set(schoolId, (counts.get(schoolId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Schools that published nothing in the window.
 *
 * The operationally useful report: this is the outreach list, and it is the one
 * a district officer should look at before the leaderboard.
 */
export async function findDormantSchools(
  prisma: PrismaClient,
  actor: Actor,
  query: ReportQuery & { limit: number },
): Promise<Array<{ id: string; name: string; blockName: string; lastActivityAt: string | null }>> {
  const scope = resolveScopeFilter(actor, {
    schoolId: query.schoolId,
    blockId: query.blockId,
    districtId: query.districtId,
  });
  const window = resolveWindow(query);

  const rows = await prisma.school.findMany({
    where: {
      ...schoolWhere(scope),
      isActive: true,
      activities: {
        none: { status: 'PUBLISHED', publishedAt: { gte: window.from, lte: window.to } },
      },
    },
    select: {
      id: true,
      nameHi: true,
      block: { select: { nameHi: true } },
      activities: {
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        select: { publishedAt: true },
      },
    },
    take: query.limit,
    orderBy: { nameHi: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.nameHi,
    blockName: row.block.nameHi,
    lastActivityAt: row.activities[0]?.publishedAt?.toISOString() ?? null,
  }));
}

/**
 * CSV export.
 *
 * Deliberately built by hand rather than pulled in as a dependency, so that the
 * escaping rules are visible: every field is quoted, embedded quotes are
 * doubled, and any value that could be read as a formula by a spreadsheet is
 * prefixed — a CSV injection in a file that lands on a government officer's
 * machine is a real attack, not a theoretical one.
 */
export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const escape = (value: string | number | null): string => {
    if (value === null) return '""';
    const text = String(value);
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))];
  // A BOM so that Excel on a Windows machine reads the Hindi column names correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}
