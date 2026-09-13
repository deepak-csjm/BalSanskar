import { z } from 'zod';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_LEVELS,
  CLASS_LEVELS,
  VERIFICATION_STATUSES,
} from '../enums.js';
import {
  cleanMultilineText,
  cleanText,
  dateOnlySchema,
  idSchema,
  paginationSchema,
  pastOrTodaySchema,
} from '../primitives.js';

/**
 * What a school records about its children: how many there are, and nothing
 * else.
 *
 * There is no child record in this platform. No name, no photograph, no
 * guardian, no roll number, not with consent and not without. The reasoning is
 * in docs/data-protection.md and it is not a detail to be revisited casually —
 * everything downstream of here, including the fact that nobody has to chase a
 * consent slip, depends on it.
 *
 * A class-level count is not personal data about anybody. It is enough to
 * check that a school has not reported more participants than it has children,
 * enough to measure participation across a district, and enough for every
 * report the department actually asks for.
 */

export const classEnrolmentSchema = z.object({
  classLevel: z.enum(CLASS_LEVELS),
  /** Children on the register in this class. A count, never a list. */
  enrolled: z.number().int().min(0).max(1000),
});
export type ClassEnrolment = z.infer<typeof classEnrolmentSchema>;

/**
 * Replaces the whole roster screen with one form a head teacher fills in once a
 * term. The roster it replaces was the single most resented thing in the
 * product: a teacher entering two hundred children by hand, keeping them up to
 * date, and gaining nothing they could see for the effort.
 */
export const setEnrolmentSchema = z.object({
  classes: z.array(classEnrolmentSchema).min(1).max(CLASS_LEVELS.length),
  /** The register this was read off, so an officer can ask about a discrepancy. */
  asOn: pastOrTodaySchema,
});
export type SetEnrolmentInput = z.infer<typeof setEnrolmentSchema>;

export const enrolmentSchema = z.object({
  schoolId: z.string(),
  schoolName: z.string(),
  classes: z.array(classEnrolmentSchema),
  total: z.number().int(),
  asOn: z.string().nullable(),
  updatedByName: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type Enrolment = z.infer<typeof enrolmentSchema>;

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/**
 * Something a school's children won, recorded against the school and the class.
 *
 * Never against a named child. The department already holds the winner's name
 * in its own register, lawfully and for a reason; this platform does not need a
 * second copy in order to say that a class 7 pupil from this school took first
 * place at the district science fair. The school gets the credit, the teacher
 * gets the credit, and no child acquires a public record they did not ask for.
 */
export const createAchievementSchema = z.object({
  classLevel: z.enum(CLASS_LEVELS),
  /** How many children from this school were recognised. Usually one. */
  childrenRecognised: z.number().int().min(1).max(500).default(1),
  category: z.enum(ACHIEVEMENT_CATEGORIES),
  level: z.enum(ACHIEVEMENT_LEVELS),
  title: cleanText(3, 160),
  description: cleanMultilineText(0, 2000).optional(),
  awardedOn: pastOrTodaySchema,
  /** 1 = first place. Left empty for participation and non-ranked recognition. */
  position: z.number().int().min(1).max(100).optional(),
  organiser: cleanText(2, 160).optional(),
});
export type CreateAchievementInput = z.infer<typeof createAchievementSchema>;

export const achievementSchema = z.object({
  id: z.string(),
  classLevel: z.enum(CLASS_LEVELS),
  childrenRecognised: z.number().int(),
  schoolId: z.string(),
  schoolName: z.string(),
  category: z.enum(ACHIEVEMENT_CATEGORIES),
  level: z.enum(ACHIEVEMENT_LEVELS),
  title: z.string(),
  description: z.string().nullable(),
  awardedOn: z.string(),
  position: z.number().int().nullable(),
  organiser: z.string().nullable(),
  status: z.enum(VERIFICATION_STATUSES),
  /** The teacher who guided it, because somebody did. */
  creditedTeacherName: z.string().nullable(),
  verifiedByName: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Achievement = z.infer<typeof achievementSchema>;

export const listAchievementsQuerySchema = paginationSchema.extend({
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
  classLevel: z.enum(CLASS_LEVELS).optional(),
  category: z.enum(ACHIEVEMENT_CATEGORIES).optional(),
  level: z.enum(ACHIEVEMENT_LEVELS).optional(),
  status: z.enum(VERIFICATION_STATUSES).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
export type ListAchievementsQuery = z.infer<typeof listAchievementsQuerySchema>;

export const verifyAchievementSchema = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  reason: cleanText(3, 300).optional(),
});
export type VerifyAchievementInput = z.infer<typeof verifyAchievementSchema>;
