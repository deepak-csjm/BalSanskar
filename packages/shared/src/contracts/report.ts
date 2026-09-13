import { z } from 'zod';
import { ACTIVITY_CATEGORIES, ACHIEVEMENT_LEVELS } from '../enums.js';
import { dateOnlySchema, idSchema } from '../primitives.js';

/**
 * Reporting exists for one purpose: to let a block, district or state officer
 * answer "what is actually happening in these schools" with numbers that trace
 * back to individual, moderated records.
 *
 * Every figure here is derived from published activities and verified
 * achievements. Nothing is self-declared and unreviewed.
 */
export const reportQuerySchema = z
  .object({
    districtId: idSchema.optional(),
    blockId: idSchema.optional(),
    schoolId: idSchema.optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'The start date must not be after the end date',
    path: ['from'],
  });
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const overviewReportSchema = z.object({
  scope: z.object({
    level: z.enum(['STATE', 'DISTRICT', 'BLOCK', 'SCHOOL']),
    name: z.string(),
    from: z.string(),
    to: z.string(),
  }),
  totals: z.object({
    schools: z.number().int(),
    /** Schools that published at least one activity in the window. */
    activeSchools: z.number().int(),
    teachers: z.number().int(),
    activeTeachers: z.number().int(),
    students: z.number().int(),
    publishedActivities: z.number().int(),
    verifiedAchievements: z.number().int(),
    /**
     * Children reached, summed from what each activity reported taking part.
     * Not distinct children — no child is named anywhere in this platform, so
     * one who joined two activities counts twice. An honest over-count beats a
     * precise number that would need a register of children to produce.
     */
    childParticipations: z.number().int(),
  }),
  participationRate: z.object({
    /** activeSchools / schools, 0..1. The headline number for the department. */
    schools: z.number(),
    teachers: z.number(),
  }),
  byCategory: z.array(
    z.object({
      category: z.enum(ACTIVITY_CATEGORIES),
      count: z.number().int(),
    }),
  ),
  byMonth: z.array(
    z.object({
      month: z.string(),
      activities: z.number().int(),
      achievements: z.number().int(),
    }),
  ),
  achievementsByLevel: z.array(
    z.object({
      level: z.enum(ACHIEVEMENT_LEVELS),
      count: z.number().int(),
    }),
  ),
});
export type OverviewReport = z.infer<typeof overviewReportSchema>;

/**
 * The league-table view, used by block and district offices to see which
 * schools need support — read bottom-up, not top-down.
 */
export const leaderboardRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentName: z.string().nullable(),
  schools: z.number().int().nullable(),
  activeSchools: z.number().int().nullable(),
  publishedActivities: z.number().int(),
  verifiedAchievements: z.number().int(),
  childParticipations: z.number().int(),
  lastActivityAt: z.string().nullable(),
});
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;

export const leaderboardQuerySchema = reportQuerySchema.and(
  z.object({
    groupBy: z.enum(['DISTRICT', 'BLOCK', 'SCHOOL']).default('DISTRICT'),
    order: z.enum(['MOST_ACTIVE', 'LEAST_ACTIVE']).default('MOST_ACTIVE'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),
);
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const leaderboardSchema = z.object({
  groupBy: z.enum(['DISTRICT', 'BLOCK', 'SCHOOL']),
  rows: z.array(leaderboardRowSchema),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

/** Schools with no published work in the window: the list that drives outreach. */
export const dormantSchoolsQuerySchema = reportQuerySchema.and(
  z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }),
);
export type DormantSchoolsQuery = z.infer<typeof dormantSchoolsQuerySchema>;
