import { z } from 'zod';
import { SCHOOL_TYPES } from '../enums.js';
import {
  cleanText,
  idSchema,
  otpCodeSchema,
  paginationSchema,
  phoneSchema,
  udiseSchema,
} from '../primitives.js';
import {
  CLAIM_STATUSES,
  CLEARANCE_STATES,
  RISK_FLAGS,
  SCHOOL_STATUSES,
  TRUST_TIERS,
} from '../integrity.js';

/**
 * Getting a school onto the platform, and getting its work off it.
 *
 * Both halves of docs/integrity.md: the claim a head teacher raises against a
 * UDISE code, and the clearance an activity needs before it is visible outside
 * the school that produced it.
 */

// ---------------------------------------------------------------------------
// Claiming a school
// ---------------------------------------------------------------------------

/**
 * Raised by a head teacher who has verified their phone by one-time code.
 *
 * The claim carries the UDISE code, where they say the school is, and enough
 * about themselves for the block officer to recognise them. The officer decides;
 * nothing here creates a school on its own.
 */
export const createSchoolClaimSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
  udiseCode: udiseSchema,
  blockId: idSchema,
  proposedNameHi: cleanText(3, 160),
  proposedNameEn: cleanText(3, 160).optional(),
  proposedType: z.enum(SCHOOL_TYPES).default('PRIMARY'),
  villageOrWard: cleanText(1, 120).optional(),
  claimantName: cleanText(2, 120),
  claimantDesignation: cleanText(2, 80).optional(),
  claimantEmployeeCode: cleanText(2, 40).optional(),
  /**
   * Storage key of a photograph of the school board, which carries the name and
   * the code. Optional, because a head teacher standing in their own school can
   * produce one in a minute and someone who has never been there cannot.
   */
  evidenceKey: z.string().trim().min(1).max(300).optional(),
});
export type CreateSchoolClaimInput = z.infer<typeof createSchoolClaimSchema>;

export const schoolClaimSchema = z.object({
  id: z.string(),
  udiseCode: z.string(),
  status: z.enum(CLAIM_STATUSES),
  blockId: z.string(),
  blockName: z.string(),
  districtName: z.string(),
  proposedNameHi: z.string(),
  proposedNameEn: z.string().nullable(),
  proposedType: z.enum(SCHOOL_TYPES),
  villageOrWard: z.string().nullable(),
  claimantName: z.string(),
  claimantPhone: z.string(),
  claimantDesignation: z.string().nullable(),
  claimantEmployeeCode: z.string().nullable(),
  evidenceUrl: z.string().nullable(),
  /** True when the code already exists in the register, so this is recognition rather than creation. */
  matchesRegister: z.boolean(),
  registeredNameHi: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type SchoolClaim = z.infer<typeof schoolClaimSchema>;

/**
 * What a claimant is told after raising a claim, and what a second claimant on
 * the same code is told: enough to sort out an honest collision inside the
 * school, never enough to be a directory of who works where.
 */
export const claimReceiptSchema = z.object({
  status: z.enum(['PENDING', 'ALREADY_CLAIMED']),
  claimId: z.string().nullable(),
  blockName: z.string(),
  /** Given name and designation of the existing claimant, when there is one. */
  existingClaimantHint: z.string().nullable(),
  expiresAt: z.string().nullable(),
});
export type ClaimReceipt = z.infer<typeof claimReceiptSchema>;

export const listClaimsQuerySchema = paginationSchema.extend({
  status: z.enum(CLAIM_STATUSES).optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
});
export type ListClaimsQuery = z.infer<typeof listClaimsQuerySchema>;

export const decideClaimSchema = z.object({
  decision: z.enum(['VERIFY', 'REJECT']),
  /** Required on rejection so the claimant learns what to correct. */
  note: cleanText(3, 300).optional(),
  /** The officer may correct the name before confirming it into the register. */
  correctedNameHi: cleanText(3, 160).optional(),
  correctedNameEn: cleanText(3, 160).optional(),
});
export type DecideClaimInput = z.infer<typeof decideClaimSchema>;

// ---------------------------------------------------------------------------
// Leaving the school
// ---------------------------------------------------------------------------

/**
 * The head teacher's attestation.
 *
 * The client shows the full statement from `ATTESTATION_TEXT` and the head
 * teacher agrees to it explicitly. `confirmed` being false is not an error and
 * not a silent no-op: it means the activity stays inside the school, which is a
 * legitimate outcome.
 */
export const attestActivitySchema = z.object({
  confirmed: z.literal(true, {
    errorMap: () => ({ message: 'Read the statement and confirm it before sending this on' }),
  }),
  /** Anything the head teacher wants the block officer to know. */
  note: cleanText(1, 500).optional(),
});
export type AttestActivityInput = z.infer<typeof attestActivitySchema>;

export const riskFlagSchema = z.enum(RISK_FLAGS);

export const clearanceSummarySchema = z.object({
  state: z.enum(CLEARANCE_STATES),
  target: z.string().nullable(),
  reason: z.enum(['FLAGGED', 'SAMPLED']).nullable(),
  riskScore: z.number().int(),
  riskFlags: z.array(riskFlagSchema),
  /** Plain sentences an officer can act on, one per flag. */
  riskNotes: z.array(z.string()),
  attestedByName: z.string().nullable(),
  attestedAt: z.string().nullable(),
  attestationNote: z.string().nullable(),
  clearedByName: z.string().nullable(),
  clearedAt: z.string().nullable(),
  clearanceNote: z.string().nullable(),
  schoolTrustTier: z.enum(TRUST_TIERS),
});
export type ClearanceSummary = z.infer<typeof clearanceSummarySchema>;

export const clearanceQueueItemSchema = z.object({
  activityId: z.string(),
  title: z.string(),
  occurredOn: z.string(),
  schoolId: z.string(),
  schoolName: z.string(),
  schoolTrustTier: z.enum(TRUST_TIERS),
  authorName: z.string(),
  attestedByName: z.string().nullable(),
  attestedAt: z.string().nullable(),
  target: z.string(),
  riskScore: z.number().int(),
  riskFlags: z.array(riskFlagSchema),
  riskNotes: z.array(z.string()),
  reason: z.enum(['FLAGGED', 'SAMPLED']),
  coverUrl: z.string().nullable(),
  submittedAt: z.string().nullable(),
});
export type ClearanceQueueItem = z.infer<typeof clearanceQueueItemSchema>;

export const listClearanceQuerySchema = paginationSchema.extend({
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
  schoolId: idSchema.optional(),
  /** Only items carrying a flag, for an officer with ten minutes. */
  flaggedOnly: z.coerce.boolean().default(false),
});
export type ListClearanceQuery = z.infer<typeof listClearanceQuerySchema>;

export const decideClearanceSchema = z.object({
  decision: z.enum(['CLEAR', 'RETURN']),
  /** Required on a return: work sent back without a reason loses a school. */
  note: cleanText(3, 500).optional(),
});
export type DecideClearanceInput = z.infer<typeof decideClearanceSchema>;

/**
 * Sent with an upload so the server can fingerprint the image without ever
 * receiving the bytes. Computed in the browser; the server treats it as a hint
 * from an untrusted client, which is acceptable because a forged hash only ever
 * costs the sender a flag they would otherwise have avoided.
 */
export const perceptualHashSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{16}$/, 'A fingerprint is 16 hexadecimal characters');

export const schoolTrustSchema = z.object({
  schoolId: z.string(),
  schoolName: z.string(),
  tier: z.enum(TRUST_TIERS),
  clearedCount: z.number().int(),
  returnedCount: z.number().int(),
  lastReturnedAt: z.string().nullable(),
  /** The share of unflagged escalations this school's work is reviewed at. */
  sampleRate: z.number(),
  status: z.enum(SCHOOL_STATUSES),
});
export type SchoolTrust = z.infer<typeof schoolTrustSchema>;
