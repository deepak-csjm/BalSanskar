import { z } from 'zod';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_STATUSES,
  CLASS_LEVELS,
  MEDIA_KINDS,
  VISIBILITY_LEVELS,
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
 * An activity is the unit of work the platform exists to capture: something a
 * teacher did with their class, recorded once, in a structured form, and
 * reusable for school records, block review and departmental reporting.
 *
 * It is explicitly not a social media post. There is no feed ranking, no
 * follower count, and no public reaction — only structured facts, a moderation
 * trail, and aggregate reporting.
 */
export const createActivitySchema = z.object({
  title: cleanText(5, 160),
  description: cleanMultilineText(20, 5000),
  category: z.enum(ACTIVITY_CATEGORIES),
  occurredOn: pastOrTodaySchema,
  /** Which classes took part. Empty means the whole school. */
  classLevels: z.array(z.enum(CLASS_LEVELS)).max(CLASS_LEVELS.length).default([]),
  participantCount: z.number().int().min(0).max(5000).optional(),
  /** Students being recognised by name. Each one needs media consent before the activity can go public. */
  studentIds: z.array(idSchema).max(200).default([]),
  /** Storage keys returned by the upload endpoint, in display order. */
  mediaKeys: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  tags: z.array(cleanText(2, 30)).max(8).default([]),
  learningOutcome: cleanMultilineText(0, 1000).optional(),
});
export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const updateActivitySchema = createActivitySchema.partial();
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

export const submitActivitySchema = z.object({
  /** What the author is asking for. A moderator may approve at or below this. */
  requestedVisibility: z.enum(VISIBILITY_LEVELS).default('BLOCK'),
  note: cleanText(1, 300).optional(),
});
export type SubmitActivityInput = z.infer<typeof submitActivitySchema>;

export const moderateActivitySchema = z.object({
  decision: z.enum(['PUBLISH', 'REJECT']),
  visibility: z.enum(VISIBILITY_LEVELS).optional(),
  /** Required on rejection: a teacher who is told "no" without a reason stops using the platform. */
  reason: cleanText(3, 500).optional(),
});
export type ModerateActivityInput = z.infer<typeof moderateActivitySchema>;

export const activityMediaSchema = z.object({
  id: z.string(),
  kind: z.enum(MEDIA_KINDS),
  /** Short-lived signed URL. Never a permanent public link. */
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  caption: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  order: z.number().int(),
  /** A moderator has confirmed every child in this frame is covered by a consent slip. */
  consentVerified: z.boolean(),
});
export type ActivityMedia = z.infer<typeof activityMediaSchema>;

export const activitySummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(ACTIVITY_CATEGORIES),
  status: z.enum(ACTIVITY_STATUSES),
  visibility: z.enum(VISIBILITY_LEVELS),
  occurredOn: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  blockName: z.string(),
  districtName: z.string(),
  authorName: z.string(),
  participantCount: z.number().int().nullable(),
  mediaCount: z.number().int(),
  coverUrl: z.string().nullable(),
  appreciationCount: z.number().int(),
  createdAt: z.string(),
});
export type ActivitySummary = z.infer<typeof activitySummarySchema>;

export const activityDetailSchema = activitySummarySchema.extend({
  description: z.string(),
  learningOutcome: z.string().nullable(),
  classLevels: z.array(z.enum(CLASS_LEVELS)),
  tags: z.array(z.string()),
  media: z.array(activityMediaSchema),
  recognisedStudents: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      classLevel: z.enum(CLASS_LEVELS),
      hasMediaConsent: z.boolean(),
    }),
  ),
  authorId: z.string(),
  requestedVisibility: z.enum(VISIBILITY_LEVELS).nullable(),
  submittedAt: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  /** Populated for moderators: everything blocking a publish decision. */
  publishBlockers: z.array(z.string()).optional(),
});
export type ActivityDetail = z.infer<typeof activityDetailSchema>;

export const listActivitiesQuerySchema = paginationSchema.extend({
  status: z.enum(ACTIVITY_STATUSES).optional(),
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
  authorId: idSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  search: cleanText(1, 80).optional(),
  /** Restricts to items the caller is empowered to act on. */
  awaitingMyReview: z.coerce.boolean().default(false),
});
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

/**
 * The public showcase view.
 *
 * A separate type rather than a filtered {@link ActivityDetail}, so that adding
 * a field to the internal record can never accidentally leak it to the open web.
 */
export const publicActivitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(ACTIVITY_CATEGORIES),
  occurredOn: z.string(),
  schoolName: z.string(),
  blockName: z.string(),
  districtName: z.string(),
  classLevels: z.array(z.enum(CLASS_LEVELS)),
  participantCount: z.number().int().nullable(),
  media: z.array(
    z.object({
      url: z.string(),
      caption: z.string().nullable(),
      width: z.number().int().nullable(),
      height: z.number().int().nullable(),
    }),
  ),
  /**
   * Children being celebrated, by given name and class only. Never a surname,
   * a section or a roll number: enough for a village to recognise its own
   * child, not enough for a stranger to find them.
   */
  recognisedStudents: z.array(
    z.object({
      displayName: z.string(),
      classLevel: z.enum(CLASS_LEVELS),
    }),
  ),
  publishedAt: z.string(),
});
export type PublicActivity = z.infer<typeof publicActivitySchema>;

/**
 * Recognition from the block or district office to a school.
 *
 * The deliberate alternative to a "like": it can only be given by someone with
 * oversight, it is attributed, it is counted in the school's record, and there
 * is no way for the public to vote.
 */
export const giveAppreciationSchema = z.object({
  message: cleanText(3, 300).optional(),
});
export type GiveAppreciationInput = z.infer<typeof giveAppreciationSchema>;

export const appreciationSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  byName: z.string(),
  byRole: z.string(),
  message: z.string().nullable(),
  createdAt: z.string(),
});
export type Appreciation = z.infer<typeof appreciationSchema>;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'] as const;

export const requestUploadSchema = z.object({
  fileName: cleanText(1, 200),
  contentType: z.enum([...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  purpose: z.enum(['ACTIVITY_MEDIA', 'CONSENT_DOCUMENT']).default('ACTIVITY_MEDIA'),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

export const uploadTicketSchema = z.object({
  /** Opaque storage key to pass back when attaching the file to a record. */
  key: z.string(),
  /** Where to PUT the bytes. */
  uploadUrl: z.string(),
  method: z.enum(['PUT', 'POST']),
  headers: z.record(z.string(), z.string()),
  expiresInSeconds: z.number().int().positive(),
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;
