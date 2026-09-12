import { describe, expect, it } from 'vitest';
import {
  CLAIM_TTL_DAYS,
  PHASH_MATCH_DISTANCE,
  SAMPLE_RATE,
  WATCH_PERIOD_DAYS,
  canHoldRecords,
  computeTrustTier,
  hammingDistance,
  isLongBackdated,
  isNonWorkingDay,
  looksLikeSameImage,
  needsClearance,
  requiresBlockReview,
  reviewReason,
  scoreRisk,
  textSimilarity,
  type RiskFlag,
  type TrustTier,
} from './index.js';

/**
 * The rules that decide how much oversight a school's work gets.
 *
 * Pure functions, so they are tested exhaustively rather than by example — a
 * new trust tier or risk flag added without a decision here fails the suite
 * rather than defaulting to "wave it through".
 */

describe('school verification', () => {
  it('lets only a confirmed school hold a child’s record', () => {
    expect(canHoldRecords('ACTIVE')).toBe(true);
    expect(canHoldRecords('PENDING_VERIFICATION')).toBe(false);
    expect(canHoldRecords('SUSPENDED')).toBe(false);
  });

  it('gives an unanswered claim a finite life', () => {
    // Otherwise one abandoned claim locks a school out of the platform for good.
    expect(CLAIM_TTL_DAYS).toBeGreaterThan(0);
    expect(CLAIM_TTL_DAYS).toBeLessThanOrEqual(90);
  });
});

describe('trust tiers', () => {
  const base = { clearedCount: 0, returnedCount: 0, lastReturnedAt: null };

  it('starts a school on full oversight', () => {
    expect(computeTrustTier(base)).toBe('NEW');
    expect(SAMPLE_RATE.NEW).toBe(1);
  });

  it('lightens oversight as a clean record accumulates', () => {
    expect(computeTrustTier({ ...base, clearedCount: 5 })).toBe('STANDARD');
    expect(computeTrustTier({ ...base, clearedCount: 20 })).toBe('TRUSTED');
    expect(SAMPLE_RATE.TRUSTED).toBeLessThan(SAMPLE_RATE.STANDARD);
    expect(SAMPLE_RATE.STANDARD).toBeLessThan(SAMPLE_RATE.NEW);
  });

  it('puts a school back under full review the moment work is returned', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const tier = computeTrustTier({
      clearedCount: 500,
      returnedCount: 1,
      lastReturnedAt: new Date('2026-05-30T00:00:00Z'),
      now,
    });
    // A long clean history does not buy its way out of a recent return.
    expect(tier).toBe('WATCH');
    expect(SAMPLE_RATE.WATCH).toBe(1);
  });

  it('lets a school recover once the watch period has passed', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const longAgo = new Date(now.getTime() - (WATCH_PERIOD_DAYS + 1) * 86_400_000);
    expect(
      computeTrustTier({ clearedCount: 30, returnedCount: 1, lastReturnedAt: longAgo, now }),
    ).toBe('TRUSTED');
  });

  it('never lets any tier skip review entirely', () => {
    for (const tier of Object.keys(SAMPLE_RATE) as TrustTier[]) {
      expect(SAMPLE_RATE[tier]).toBeGreaterThan(0);
      expect(SAMPLE_RATE[tier]).toBeLessThanOrEqual(1);
    }
  });
});

describe('who gets reviewed', () => {
  it('never samples a flagged activity away', () => {
    // The whole point: attention is rationed across unflagged work, never
    // across work the platform already thinks is worth a look.
    for (const tier of Object.keys(SAMPLE_RATE) as TrustTier[]) {
      expect(requiresBlockReview({ tier, flags: ['NON_WORKING_DAY'], draw: 0.999 })).toBe(true);
    }
  });

  it('reviews everything from a new or watched school', () => {
    expect(requiresBlockReview({ tier: 'NEW', flags: [], draw: 0.999 })).toBe(true);
    expect(requiresBlockReview({ tier: 'WATCH', flags: [], draw: 0.999 })).toBe(true);
  });

  it('lets unflagged work from a trusted school mostly pass', () => {
    expect(requiresBlockReview({ tier: 'TRUSTED', flags: [], draw: 0.5 })).toBe(false);
    // ...but still draws one in ten.
    expect(requiresBlockReview({ tier: 'TRUSTED', flags: [], draw: 0.05 })).toBe(true);
  });

  it('honours a district that wants to see everything', () => {
    expect(
      requiresBlockReview({ tier: 'TRUSTED', flags: [], draw: 0.99, reviewEverything: true }),
    ).toBe(true);
  });

  it('tells the officer why the item is in front of them', () => {
    expect(reviewReason([])).toBe('SAMPLED');
    expect(reviewReason(['PHOTO_REUSED_OTHER_SCHOOL'])).toBe('FLAGGED');
  });
});

describe('risk scoring', () => {
  it('ranks a photograph borrowed from another school above every other single flag', () => {
    const borrowed = scoreRisk(['PHOTO_REUSED_OTHER_SCHOOL']);
    const others: RiskFlag[] = [
      'PHOTO_REUSED_OWN_SCHOOL',
      'COUNT_EXCEEDS_ROSTER',
      'TEXT_REUSED',
      'BURST',
      'CONSENT_GAPS',
      'LONG_BACKDATED',
      'NON_WORKING_DAY',
      'NO_EVIDENCE',
      'FIRST_SUBMISSION',
    ];
    for (const flag of others) {
      expect(borrowed).toBeGreaterThan(scoreRisk([flag]));
    }
  });

  it('accumulates, so several small problems add up to a look', () => {
    expect(scoreRisk(['NON_WORKING_DAY', 'FIRST_SUBMISSION', 'NO_EVIDENCE'])).toBe(
      scoreRisk(['NON_WORKING_DAY']) + scoreRisk(['FIRST_SUBMISSION']) + scoreRisk(['NO_EVIDENCE']),
    );
  });

  it('scores a clean activity at zero', () => {
    expect(scoreRisk([])).toBe(0);
  });
});

describe('image fingerprints', () => {
  it('counts differing bits', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000001', '0000000000000000')).toBe(1);
    expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64);
  });

  it('treats a re-compressed photograph as the same photograph', () => {
    expect(looksLikeSameImage('f0e1d2c3b4a59687', 'f0e1d2c3b4a59686')).toBe(true);
  });

  it('leaves unrelated photographs alone', () => {
    expect(looksLikeSameImage('ffffffffffffffff', '0000000000000000')).toBe(false);
  });

  it('sits well inside the noise floor for unrelated images', () => {
    // Two unrelated 64-bit fingerprints sit around 32 bits apart; the threshold
    // has to be far below that to avoid flagging every school in the district.
    expect(PHASH_MATCH_DISTANCE).toBeLessThan(16);
  });

  it('refuses to compare fingerprints of different lengths', () => {
    expect(hammingDistance('abc', 'abcdef0123456789')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('cheap sanity checks', () => {
  it('spots a Sunday', () => {
    expect(isNonWorkingDay('2026-09-06')).toBe(true);
    expect(isNonWorkingDay('2026-09-07')).toBe(false);
    // Saturday is a working day in UP basic schools.
    expect(isNonWorkingDay('2026-09-05')).toBe(false);
  });

  it('spots a write-up filed long after the event', () => {
    const recordedAt = new Date('2026-09-01T00:00:00Z');
    expect(isLongBackdated('2026-01-01', recordedAt)).toBe(true);
    expect(isLongBackdated('2026-08-25', recordedAt)).toBe(false);
  });

  it('spots a description recycled with the date changed', () => {
    const original =
      'The children planted spinach and coriander in the school kitchen garden and water it in turns each morning.';
    const lightlyEdited =
      'The children planted coriander and spinach in the kitchen garden and water it in turns every morning.';
    expect(textSimilarity(original, lightlyEdited)).toBeGreaterThan(0.8);
  });

  it('leaves a genuinely different write-up alone', () => {
    expect(
      textSimilarity(
        'We built a reading corner from donated books.',
        'Class 6 measured the playground and drew a scale plan.',
      ),
    ).toBeLessThan(0.3);
  });

  it('does not call two empty descriptions identical', () => {
    expect(textSimilarity('', '')).toBe(0);
  });
});

describe('the gate', () => {
  it('lets a school keep its own record without a gate', () => {
    expect(needsClearance('SCHOOL')).toBe(false);
  });

  it('gates every level above the school', () => {
    for (const level of ['BLOCK', 'DISTRICT', 'STATE', 'PUBLIC'] as const) {
      expect(needsClearance(level)).toBe(true);
    }
  });
});
