import { z } from 'zod';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_LEVELS,
  CLASS_LEVELS,
  CONSENT_METHODS,
  CONSENT_STATUSES,
  GENDERS,
  VERIFICATION_STATUSES,
} from '../enums.js';
import {
  cleanMultilineText,
  cleanText,
  dateOnlySchema,
  idSchema,
  paginationSchema,
  pastOrTodaySchema,
  phoneSchema,
} from '../primitives.js';

/**
 * The child record.
 *
 * Held to the minimum a school actually needs to recognise a pupil's work:
 * name, class, section, roll number and a guardian to contact. No Aadhaar, no
 * caste, no religion, no address, no biometrics — every one of those fields is
 * a liability the platform gains nothing from carrying.
 */
export const createStudentSchema = z.object({
  fullName: cleanText(2, 120),
  classLevel: z.enum(CLASS_LEVELS),
  section: cleanText(1, 8).optional(),
  rollNumber: cleanText(1, 16).optional(),
  gender: z.enum(GENDERS),
  /** Year of birth only — enough to sanity-check the class, not enough to identify a child. */
  birthYear: z
    .number()
    .int()
    .min(new Date().getFullYear() - 25)
    .max(new Date().getFullYear())
    .optional(),
  guardianName: cleanText(2, 120),
  guardianPhone: phoneSchema.optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = createStudentSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const studentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  fullName: z.string(),
  classLevel: z.enum(CLASS_LEVELS),
  section: z.string().nullable(),
  rollNumber: z.string().nullable(),
  gender: z.enum(GENDERS),
  birthYear: z.number().int().nullable(),
  guardianName: z.string(),
  guardianPhone: z.string().nullable(),
  isActive: z.boolean(),
  /** Denormalised for the roster screen so a teacher can see consent at a glance. */
  mediaConsent: z.enum(CONSENT_STATUSES).nullable(),
  createdAt: z.string(),
});
export type Student = z.infer<typeof studentSchema>;

/**
 * How a child appears outside the school's own walls.
 *
 * Given name plus class only, and the surname is dropped. This is the single
 * most important privacy decision in the product: a public showcase must be
 * able to celebrate a child without making them findable.
 */
export const publicStudentSchema = z.object({
  displayName: z.string(),
  classLevel: z.enum(CLASS_LEVELS),
});
export type PublicStudent = z.infer<typeof publicStudentSchema>;

export const listStudentsQuerySchema = paginationSchema.extend({
  schoolId: idSchema.optional(),
  classLevel: z.enum(CLASS_LEVELS).optional(),
  section: cleanText(1, 8).optional(),
  search: cleanText(1, 80).optional(),
  includeInactive: z.coerce.boolean().default(false),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

/**
 * A guardian's decision about their child's photograph being used.
 *
 * Recorded by a teacher, tied to the paper slip the school keeps on file, and
 * revocable at any time. The `documentKey` points at a scan of that slip so an
 * audit can be answered with evidence rather than assurances.
 */
export const recordConsentSchema = z.object({
  status: z.enum(CONSENT_STATUSES).refine((value) => value !== 'REVOKED', {
    message: 'Use the revoke endpoint to withdraw consent',
  }),
  method: z.enum(CONSENT_METHODS),
  guardianName: cleanText(2, 120),
  guardianRelation: cleanText(2, 40).optional(),
  /** Storage key of the scanned or photographed consent slip. */
  documentKey: z.string().trim().min(1).max(300).optional(),
  note: cleanText(1, 300).optional(),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;

export const consentRecordSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  status: z.enum(CONSENT_STATUSES),
  method: z.enum(CONSENT_METHODS),
  guardianName: z.string(),
  guardianRelation: z.string().nullable(),
  hasDocument: z.boolean(),
  note: z.string().nullable(),
  recordedByName: z.string(),
  recordedAt: z.string(),
  revokedAt: z.string().nullable(),
});
export type ConsentRecord = z.infer<typeof consentRecordSchema>;

export const revokeConsentSchema = z.object({
  reason: cleanText(3, 300),
});
export type RevokeConsentInput = z.infer<typeof revokeConsentSchema>;

export const createAchievementSchema = z.object({
  studentId: idSchema,
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
  studentId: z.string(),
  studentName: z.string(),
  classLevel: z.enum(CLASS_LEVELS),
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
  verifiedByName: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Achievement = z.infer<typeof achievementSchema>;

export const listAchievementsQuerySchema = paginationSchema.extend({
  studentId: idSchema.optional(),
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
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
