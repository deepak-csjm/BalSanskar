import { z } from 'zod';
import { SCHOOL_TYPES, USER_ROLES, USER_STATUSES } from '../enums.js';
import { cleanText, idSchema, paginationSchema, phoneSchema, udiseSchema } from '../primitives.js';

export const districtSchema = z.object({
  id: z.string(),
  code: z.string(),
  nameHi: z.string(),
  nameEn: z.string(),
  division: z.string().nullable(),
});
export type District = z.infer<typeof districtSchema>;

export const blockSchema = z.object({
  id: z.string(),
  districtId: z.string(),
  code: z.string(),
  nameHi: z.string(),
  nameEn: z.string(),
});
export type Block = z.infer<typeof blockSchema>;

export const schoolSummarySchema = z.object({
  id: z.string(),
  udiseCode: z.string(),
  nameHi: z.string(),
  nameEn: z.string().nullable(),
  type: z.enum(SCHOOL_TYPES),
  districtId: z.string(),
  districtName: z.string(),
  blockId: z.string(),
  blockName: z.string(),
  villageOrWard: z.string().nullable(),
  isActive: z.boolean(),
});
export type SchoolSummary = z.infer<typeof schoolSummarySchema>;

export const schoolDetailSchema = schoolSummarySchema.extend({
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  contactPhone: z.string().nullable(),
  studentCount: z.number().int().nonnegative(),
  teacherCount: z.number().int().nonnegative(),
  publishedActivityCount: z.number().int().nonnegative(),
});
export type SchoolDetail = z.infer<typeof schoolDetailSchema>;

export const createSchoolSchema = z.object({
  udiseCode: udiseSchema,
  nameHi: cleanText(3, 160),
  nameEn: cleanText(3, 160).optional(),
  type: z.enum(SCHOOL_TYPES),
  blockId: idSchema,
  villageOrWard: cleanText(1, 120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  contactPhone: phoneSchema.optional(),
});
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

export const updateSchoolSchema = createSchoolSchema
  .omit({ udiseCode: true, blockId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

export const listSchoolsQuerySchema = paginationSchema.extend({
  districtId: idSchema.optional(),
  blockId: idSchema.optional(),
  search: cleanText(1, 80).optional(),
  type: z.enum(SCHOOL_TYPES).optional(),
});
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;

/** Public lookup used during registration: enough to confirm "yes, this is my school". */
export const schoolLookupSchema = z.object({
  udiseCode: z.string(),
  nameHi: z.string(),
  nameEn: z.string().nullable(),
  blockName: z.string(),
  districtName: z.string(),
  isRegistered: z.boolean(),
});
export type SchoolLookup = z.infer<typeof schoolLookupSchema>;

export const userSummarySchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  designation: z.string().nullable(),
  employeeCode: z.string().nullable(),
  schoolId: z.string().nullable(),
  schoolName: z.string().nullable(),
  blockId: z.string().nullable(),
  blockName: z.string().nullable(),
  districtId: z.string().nullable(),
  districtName: z.string().nullable(),
  createdAt: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const listUsersQuerySchema = paginationSchema.extend({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
  search: cleanText(1, 80).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const approveUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  note: cleanText(1, 300).optional(),
});
export type ApproveUserInput = z.infer<typeof approveUserSchema>;

export const rejectUserSchema = z.object({
  reason: cleanText(3, 300),
});
export type RejectUserInput = z.infer<typeof rejectUserSchema>;

/**
 * Direct account creation by an administrator, for head teachers and office
 * staff who should not have to wait in the self-registration queue.
 */
export const inviteUserSchema = z.object({
  phone: phoneSchema,
  fullName: cleanText(2, 120),
  role: z.enum(USER_ROLES),
  designation: cleanText(2, 80).optional(),
  employeeCode: cleanText(2, 40).optional(),
  email: z.string().trim().email().max(160).optional(),
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
