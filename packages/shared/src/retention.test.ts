import { describe, expect, it } from 'vitest';
import {
  AUDIT_RETENTION_DAYS,
  MAX_MEDIA_PER_ACTIVITY,
  MAX_MEDIA_PER_SCHOOL_PER_MONTH,
  MEDIA_RETENTION_DAYS,
  ORPHAN_UPLOAD_HOURS,
  EXPECTED_PHOTOS_PER_SCHOOL_PER_MONTH,
  steadyStateGb,
  worstCaseSteadyStateGb,
} from './index.js';

/**
 * These numbers decide whether the platform's bill is predictable, and whether
 * a photograph outlives its purpose. Both are the kind of constant somebody
 * raises "just for now" during a rollout, so the relationships between them are
 * asserted rather than left to a comment.
 */

describe('retention', () => {
  it('sweeps an abandoned upload within a day', () => {
    // The child-safety one: a form somebody started and left must not leave a
    // photograph in a bucket that no interface will ever show anyone.
    expect(ORPHAN_UPLOAD_HOURS).toBeLessThanOrEqual(24);
  });

  it('keeps a photograph long enough to review last year, and no longer', () => {
    expect(MEDIA_RETENTION_DAYS).toBeGreaterThan(365);
    expect(MEDIA_RETENTION_DAYS).toBeLessThan(2 * 365);
  });

  it('keeps the accountability trail far longer than the pictures', () => {
    // It names officers rather than children, and it is the cheapest thing in
    // the system to store.
    expect(AUDIT_RETENTION_DAYS).toBeGreaterThan(MEDIA_RETENTION_DAYS * 4);
  });
});

describe('quotas', () => {
  it('leaves an active school far below its monthly ceiling', () => {
    // A school filing something every week with photographs each time. The cap
    // is there to stop a runaway script, not to ration honest work.
    const busySchool = 4 * MAX_MEDIA_PER_ACTIVITY * 2;
    expect(busySchool).toBeLessThan(MAX_MEDIA_PER_SCHOOL_PER_MONTH);
  });

  it('keeps one write-up from becoming an album', () => {
    expect(MAX_MEDIA_PER_ACTIVITY).toBeLessThanOrEqual(10);
  });
});

describe('the storage bill', () => {
  /**
   * The figures somebody has to be able to pay. Asserted here so that raising a
   * cap or a retention window during a rollout shows up as a failing number
   * rather than as an invoice six months later.
   */
  it('is affordable for a pilot district', () => {
    // A thousand schools should cost roughly nothing to host.
    expect(steadyStateGb(1_000)).toBeLessThan(50);
  });

  it('stays in the low terabytes across the whole state', () => {
    expect(steadyStateGb(130_000)).toBeLessThan(3_000);
  });

  it('is survivable even if every school pushed against the cap', () => {
    // The pathological case: not something to plan for, but not something that
    // should be able to arrive without warning either.
    expect(worstCaseSteadyStateGb(130_000)).toBeLessThan(20_000);
  });

  it('plateaus rather than compounding', () => {
    // The property the whole retention design exists for. Doubling the time a
    // deployment has been running must not double the storage: after one
    // retention window, expiry cancels upload.
    // Rounded to whole gigabytes, so allow a gigabyte of slack.
    expect(Math.abs(steadyStateGb(20_000) - steadyStateGb(10_000) * 2)).toBeLessThanOrEqual(1);
  });

  it('leaves the cap comfortably above real use', () => {
    expect(MAX_MEDIA_PER_SCHOOL_PER_MONTH).toBeGreaterThan(
      EXPECTED_PHOTOS_PER_SCHOOL_PER_MONTH * 4,
    );
  });
});
