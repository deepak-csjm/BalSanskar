/**
 * Domain enumerations shared by the API and the web client.
 *
 * These mirror the Prisma enums one-for-one. They are declared here (rather than
 * imported from the generated Prisma client) so that the browser bundle never has
 * to pull in server-only code.
 */

export const USER_ROLES = [
  'SUPER_ADMIN',
  'STATE_ADMIN',
  'DISTRICT_ADMIN',
  'BLOCK_ADMIN',
  'PRINCIPAL',
  'TEACHER',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Ordered from widest scope to narrowest. Used for "at least this role" checks
 * and for deciding who may approve or moderate whose work.
 */
export const ROLE_RANK: Record<UserRole, number> = {
  SUPER_ADMIN: 60,
  STATE_ADMIN: 50,
  DISTRICT_ADMIN: 40,
  BLOCK_ADMIN: 30,
  PRINCIPAL: 20,
  TEACHER: 10,
};

export const USER_STATUSES = ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SCHOOL_TYPES = [
  'PRIMARY',
  'UPPER_PRIMARY',
  'COMPOSITE',
  'KASTURBA_GANDHI',
  'OTHER',
] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

/**
 * Class labels used by UP Basic Shiksha Parishad schools: Balvatika (pre-primary)
 * through class 8.
 */
export const CLASS_LEVELS = ['BALVATIKA', '1', '2', '3', '4', '5', '6', '7', '8'] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export const ACTIVITY_CATEGORIES = [
  'CLASSROOM_INNOVATION',
  'LEARNING_OUTCOME',
  'SPORTS',
  'ARTS_AND_CULTURE',
  'SCIENCE_AND_MATH',
  'READING_AND_LIBRARY',
  'COMMUNITY_ENGAGEMENT',
  'INFRASTRUCTURE_IMPROVEMENT',
  'HEALTH_AND_NUTRITION',
  'DIGITAL_LEARNING',
  'TEACHER_DEVELOPMENT',
  'ENROLMENT_DRIVE',
  'OTHER',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ACTIVITY_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

/**
 * How far a published activity travels. PUBLIC is the only value visible outside
 * the authenticated platform and it carries extra consent requirements.
 */
export const VISIBILITY_LEVELS = ['SCHOOL', 'BLOCK', 'DISTRICT', 'STATE', 'PUBLIC'] as const;
export type VisibilityLevel = (typeof VISIBILITY_LEVELS)[number];

export const VISIBILITY_RANK: Record<VisibilityLevel, number> = {
  SCHOOL: 10,
  BLOCK: 20,
  DISTRICT: 30,
  STATE: 40,
  PUBLIC: 50,
};

export const ACHIEVEMENT_CATEGORIES = [
  'ACADEMIC',
  'SPORTS',
  'ARTS',
  'SCIENCE',
  'LITERATURE',
  'SOCIAL_SERVICE',
  'ATTENDANCE',
  'OTHER',
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_LEVELS = [
  'SCHOOL',
  'CLUSTER',
  'BLOCK',
  'DISTRICT',
  'STATE',
  'NATIONAL',
] as const;
export type AchievementLevel = (typeof ACHIEVEMENT_LEVELS)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const MEDIA_KINDS = ['IMAGE', 'DOCUMENT'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const OTP_PURPOSES = ['LOGIN', 'REGISTRATION', 'PHONE_CHANGE'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const AUDIT_ACTIONS = [
  'USER_REGISTERED',
  'USER_APPROVED',
  'USER_REJECTED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'USER_ROLE_CHANGED',
  'USER_LOGGED_IN',
  'USER_LOGGED_OUT',
  'SCHOOL_CREATED',
  'SCHOOL_UPDATED',
  'SCHOOL_CLAIM_RAISED',
  'SCHOOL_CLAIM_VERIFIED',
  'SCHOOL_CLAIM_REJECTED',
  'SCHOOL_TRUST_CHANGED',
  'ENROLMENT_RECORDED',
  'NEED_POSTED',
  'NEED_RESOLVED',
  'SMC_MEETING_RECORDED',
  'SMC_REQUEST_ANSWERED',
  'SURVEY_RECORDED',
  'DIRECTIVE_PUBLISHED',
  'DIRECTIVE_WITHDRAWN',
  'DIRECTIVE_ANSWERED',
  'DUTY_RECORDED',
  'DUTY_ATTESTED',
  'ACTIVITY_CREATED',
  'ACTIVITY_UPDATED',
  'ACTIVITY_SUBMITTED',
  'ACTIVITY_ATTESTED',
  'ACTIVITY_CLEARED',
  'ACTIVITY_RETURNED',
  'ACTIVITY_PUBLISHED',
  'ACTIVITY_REJECTED',
  'ACTIVITY_ARCHIVED',
  'ACHIEVEMENT_CREATED',
  'ACHIEVEMENT_VERIFIED',
  'ACHIEVEMENT_REJECTED',
  'MEDIA_UPLOADED',
  'MEDIA_DELETED',
  'APPRECIATION_GIVEN',
  'REPORT_EXPORTED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const SUPPORTED_LOCALES = ['hi', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'hi';
