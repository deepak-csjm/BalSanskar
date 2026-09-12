/**
 * Earning the right to leave the school.
 *
 * A head teacher's sign-off is not an independent check on a teacher's work:
 * in a three-teacher school they share a room and an inspection, and in a
 * two-teacher school the head teacher is often the author. That is fine for a
 * record the school keeps for itself. It is not sufficient for work shown to
 * the block, the district, or the open web.
 *
 * These functions decide what has to happen before an activity is visible
 * outside its own school. The reasoning, and an honest account of what this
 * does not catch, is in docs/integrity.md.
 */

import { VISIBILITY_RANK, type VisibilityLevel } from './enums.js';

// ---------------------------------------------------------------------------
// School verification
// ---------------------------------------------------------------------------

export const SCHOOL_STATUSES = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'] as const;
export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];

export const CLAIM_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** A claim nobody acts on frees the UDISE code again rather than locking a school out. */
export const CLAIM_TTL_DAYS = 30;

/** Only a school the block office has confirmed may hold children's records. */
export function canHoldRecords(status: SchoolStatus): boolean {
  return status === 'ACTIVE';
}

// ---------------------------------------------------------------------------
// Trust, and how much oversight a school gets
// ---------------------------------------------------------------------------

export const TRUST_TIERS = ['NEW', 'STANDARD', 'TRUSTED', 'WATCH'] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

/**
 * The share of *unflagged* escalations a block officer sees, by tier.
 *
 * A Block Education Officer with two hundred schools cannot review everything,
 * and a design that assumes they will is a design that gets abandoned in month
 * two. So attention is rationed by what the platform knows about the school: a
 * clean record earns lighter oversight, and anything returned costs it.
 *
 * Flagged work is never sampled away — see `requiresBlockReview`.
 */
export const SAMPLE_RATE: Record<TrustTier, number> = {
  NEW: 1.0,
  STANDARD: 0.3,
  TRUSTED: 0.1,
  WATCH: 1.0,
};

export interface TrustInputs {
  clearedCount: number;
  returnedCount: number;
  lastReturnedAt: Date | null;
  now?: Date;
}

/** A school stays on WATCH for six months after work is returned. */
export const WATCH_PERIOD_DAYS = 180;

export function computeTrustTier(input: TrustInputs): TrustTier {
  const now = input.now ?? new Date();
  if (input.lastReturnedAt) {
    const days = (now.getTime() - input.lastReturnedAt.getTime()) / 86_400_000;
    if (days < WATCH_PERIOD_DAYS) return 'WATCH';
  }
  if (input.clearedCount >= 20) return 'TRUSTED';
  if (input.clearedCount >= 5) return 'STANDARD';
  return 'NEW';
}

// ---------------------------------------------------------------------------
// Risk flags
// ---------------------------------------------------------------------------

/**
 * Reasons a human should look at an activity before it leaves the school.
 *
 * None of these is proof of anything. A Sunday activity is often a genuine
 * community event and a reused photograph is often an honest mistake. Each is a
 * reason to look, and the ranked queue is how a limited amount of attention
 * gets pointed at the items most likely to deserve it.
 */
export const RISK_FLAGS = [
  /** The same photograph, or near enough, already exists on this platform. */
  'PHOTO_REUSED_OWN_SCHOOL',
  'PHOTO_REUSED_OTHER_SCHOOL',
  /** More participants than the school has children on its roster. */
  'COUNT_EXCEEDS_ROSTER',
  /** More participants than the named classes hold. */
  'COUNT_EXCEEDS_CLASSES',
  /** Dated on a Sunday. */
  'NON_WORKING_DAY',
  /** Recorded long after it is said to have happened. */
  'LONG_BACKDATED',
  /** The description closely repeats another recent activity from this school. */
  'TEXT_REUSED',
  /** More submitted in a day than this school usually manages in a month. */
  'BURST',
  /** The school's first escalation. */
  'FIRST_SUBMISSION',
  /** Named children whose consent is not currently granted. */
  'CONSENT_GAPS',
  /** No photograph at all on something being sent up the line. */
  'NO_EVIDENCE',
] as const;
export type RiskFlag = (typeof RISK_FLAGS)[number];

/**
 * How much each flag contributes to the queue ordering.
 *
 * Weights are ordered by how strongly the flag suggests something is actually
 * wrong, not by how easy it was to compute. A photograph that belongs to
 * another school is the strongest single signal available, because it is the
 * cheap fraud and it has no innocent explanation that does not still need
 * looking at.
 */
export const RISK_WEIGHT: Record<RiskFlag, number> = {
  PHOTO_REUSED_OTHER_SCHOOL: 50,
  PHOTO_REUSED_OWN_SCHOOL: 25,
  COUNT_EXCEEDS_ROSTER: 30,
  COUNT_EXCEEDS_CLASSES: 15,
  TEXT_REUSED: 20,
  BURST: 15,
  CONSENT_GAPS: 15,
  LONG_BACKDATED: 10,
  NON_WORKING_DAY: 5,
  NO_EVIDENCE: 10,
  FIRST_SUBMISSION: 5,
};

export function scoreRisk(flags: RiskFlag[]): number {
  return flags.reduce((total, flag) => total + (RISK_WEIGHT[flag] ?? 0), 0);
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

export const CLEARANCE_STATES = [
  'NOT_REQUIRED',
  'AWAITING_ATTESTATION',
  'AWAITING_BLOCK',
  'AUTO_CLEARED',
  'CLEARED',
  'RETURNED',
] as const;
export type ClearanceState = (typeof CLEARANCE_STATES)[number];

/** Work that stays inside the school passes through no gate at all. */
export function needsClearance(target: VisibilityLevel): boolean {
  return VISIBILITY_RANK[target] > VISIBILITY_RANK.SCHOOL;
}

/**
 * Whether this particular escalation needs a block officer, or may pass on the
 * school's record alone.
 *
 * Two independent reasons to review, and either is sufficient:
 *   - the activity carries a risk flag, which is never sampled away; or
 *   - it was drawn in the sample for the school's tier.
 *
 * `draw` is a number in [0, 1) supplied by the caller so the decision is
 * testable and reproducible rather than hidden inside a call to `Math.random`.
 */
export function requiresBlockReview(input: {
  tier: TrustTier;
  flags: RiskFlag[];
  draw: number;
  /** A district may switch sampling off and review everything. */
  reviewEverything?: boolean;
}): boolean {
  if (input.reviewEverything) return true;
  if (input.flags.length > 0) return true;
  return input.draw < SAMPLE_RATE[input.tier];
}

/** The reason an item is in the queue, for the officer reading it. */
export function reviewReason(flags: RiskFlag[]): 'FLAGGED' | 'SAMPLED' {
  return flags.length > 0 ? 'FLAGGED' : 'SAMPLED';
}

/**
 * The statement a head teacher signs before work leaves the school.
 *
 * Deliberately specific, and deliberately in the first person. "Publish" is a
 * button; this is a claim a named government employee has made, and people
 * treat the two differently. It is stored, attributed, and shown to the block
 * officer alongside the activity.
 */
export const ATTESTATION_TEXT = {
  hi: 'मैं प्रमाणित करता/करती हूँ कि यह गतिविधि उपरोक्त तिथि को इसी विद्यालय में हुई, मैंने इसे स्वयं देखा है अथवा संबंधित शिक्षक से इसकी पुष्टि की है, और इसमें नामित प्रत्येक बच्चे की हस्ताक्षरित सहमति पर्ची विद्यालय के अभिलेख में उपलब्ध है।',
  en: 'I confirm that this activity took place at this school on the date stated, that I have seen it myself or verified it with the teacher concerned, and that a signed consent slip is on file for every child named.',
} as const;

// ---------------------------------------------------------------------------
// Perceptual hashing
// ---------------------------------------------------------------------------

/**
 * How different two image fingerprints may be and still count as the same
 * photograph.
 *
 * A 64-bit difference hash of two unrelated images sits around 32 bits apart.
 * Ten is comfortably inside the noise floor for re-compression, resizing and
 * light cropping, while still leaving unrelated photographs alone. It will
 * occasionally match two genuine photographs of the same blank classroom wall,
 * which is why a match flags for a human and never rejects on its own.
 */
export const PHASH_MATCH_DISTANCE = 10;

/** Bits differing between two 16-character hex fingerprints. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    // Four bits per hex character; the table is faster than parsing the whole
    // 64-bit value and avoids BigInt.
    const diff = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    distance += NIBBLE_BITS[diff] ?? 0;
  }
  return distance;
}

const NIBBLE_BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

export function looksLikeSameImage(a: string, b: string): boolean {
  return hammingDistance(a, b) <= PHASH_MATCH_DISTANCE;
}

// ---------------------------------------------------------------------------
// Cheap sanity checks
// ---------------------------------------------------------------------------

/** Sunday. UP basic schools work a six-day week. */
export function isNonWorkingDay(isoDate: string): boolean {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return date.getUTCDay() === 0;
}

export const LONG_BACKDATE_DAYS = 90;

export function isLongBackdated(occurredOn: string, recordedAt: Date = new Date()): boolean {
  const occurred = new Date(`${occurredOn}T00:00:00.000Z`).getTime();
  return (recordedAt.getTime() - occurred) / 86_400_000 > LONG_BACKDATE_DAYS;
}

/**
 * A crude similarity measure over two descriptions, used to catch a teacher
 * pasting last month's write-up with the date changed.
 *
 * Word-set overlap rather than an edit distance: it is cheap, it ignores word
 * order, and it survives the small rewrites someone doing this would make. It
 * is also easily defeated by a genuine rewrite, which is fine — at that point
 * they have written something new.
 */
export function textSimilarity(a: string, b: string): number {
  const words = (text: string) =>
    new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
        .filter((word) => word.length > 2),
    );
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

export const TEXT_REUSE_THRESHOLD = 0.8;
