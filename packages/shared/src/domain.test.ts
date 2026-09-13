import { describe, expect, it } from 'vitest';
import {
  assignableRoles,
  can,
  canApproveVisibility,
  canEditActivity,
  canTransitionActivity,
  evaluatePublishBlockers,
  PUBLISH_BLOCKERS,
  UNCONDITIONAL_PUBLISH_BLOCKERS,
  hasAtLeastRole,
  isWithinScope,
  maxApprovableVisibility,
  normalisePhone,
  requiredScopeFields,
  sanitiseText,
  USER_ROLES,
  type UserRole,
} from './index.js';

/**
 * These are the rules the whole platform hangs on, and they are pure functions,
 * so they are tested exhaustively rather than by example. Where a rule applies
 * to every role, the test iterates over every role — a new role added to the
 * enum without a decision here will fail the suite rather than default to
 * "allowed".
 */

describe('phone normalisation', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['0091-9876543210', '+919876543210'],
    ['  9876543210  ', '+919876543210'],
  ])('accepts %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([
    ['5876543210', 'a number starting below 6 is not an Indian mobile'],
    ['98765', 'too short'],
    ['98765432101234', 'too long'],
    ['', 'empty'],
    ['abcdefghij', 'not digits'],
  ])('rejects %s (%s)', (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});

// The characters these tests feed in are precisely the ones that must never
// appear literally in a source file: a NUL byte makes the file binary to grep
// and diff, and an embedded right-to-left override reverses how the surrounding
// code reads in an editor — which is the attack `sanitiseText` exists to defuse.
const CH = {
  nul: String.fromCharCode(0x00),
  bell: String.fromCharCode(0x07),
  rlo: String.fromCharCode(0x202e),
  zeroWidthSpace: String.fromCharCode(0x200b),
  zeroWidthJoiner: String.fromCharCode(0x200d),
  bom: String.fromCharCode(0xfeff),
};

describe('text sanitisation', () => {
  it('strips control characters', () => {
    expect(sanitiseText(`hello${CH.nul}${CH.bell}world`)).toBe('helloworld');
  });

  it('strips bidirectional overrides used for display spoofing', () => {
    expect(sanitiseText(`safe${CH.rlo}txet suoregnad`)).not.toContain(CH.rlo);
  });

  it('strips zero-width characters', () => {
    expect(sanitiseText(`a${CH.zeroWidthSpace}b${CH.zeroWidthJoiner}c${CH.bom}`)).toBe('abc');
  });

  it('keeps Devanagari, newlines and tabs', () => {
    expect(sanitiseText('प्राथमिक विद्यालय\nरामपुर\tA')).toBe('प्राथमिक विद्यालय\nरामपुर\tA');
  });
});

describe('capabilities', () => {
  it('gives no teacher the power to moderate, suspend or assign roles', () => {
    expect(can('TEACHER', 'activity:moderate')).toBe(false);
    expect(can('TEACHER', 'user:suspend')).toBe(false);
    expect(can('TEACHER', 'user:assign_role')).toBe(false);
    expect(can('TEACHER', 'audit:read')).toBe(false);
  });

  it('gives a head teacher moderation but not role assignment', () => {
    expect(can('PRINCIPAL', 'activity:moderate')).toBe(true);
    expect(can('PRINCIPAL', 'user:approve')).toBe(true);
    expect(can('PRINCIPAL', 'user:assign_role')).toBe(false);
  });

  it('grows monotonically with rank', () => {
    const ordered: UserRole[] = [
      'TEACHER',
      'PRINCIPAL',
      'BLOCK_ADMIN',
      'DISTRICT_ADMIN',
      'STATE_ADMIN',
      'SUPER_ADMIN',
    ];
    for (let index = 1; index < ordered.length; index += 1) {
      const lower = ordered[index - 1]!;
      const higher = ordered[index]!;
      expect(hasAtLeastRole(higher, lower)).toBe(true);
    }
  });
});

describe('scope', () => {
  const target = { districtId: 'd1', blockId: 'b1', schoolId: 's1' };

  it('lets state-wide roles reach everywhere', () => {
    for (const role of ['SUPER_ADMIN', 'STATE_ADMIN'] as const) {
      expect(isWithinScope({ role, districtId: null, blockId: null, schoolId: null }, target)).toBe(
        true,
      );
    }
  });

  it('confines each role to its own level', () => {
    expect(
      isWithinScope(
        { role: 'DISTRICT_ADMIN', districtId: 'd1', blockId: null, schoolId: null },
        target,
      ),
    ).toBe(true);
    expect(
      isWithinScope(
        { role: 'DISTRICT_ADMIN', districtId: 'd2', blockId: null, schoolId: null },
        target,
      ),
    ).toBe(false);
    expect(
      isWithinScope(
        { role: 'BLOCK_ADMIN', districtId: 'd1', blockId: 'b2', schoolId: null },
        target,
      ),
    ).toBe(false);
    expect(
      isWithinScope({ role: 'TEACHER', districtId: 'd1', blockId: 'b1', schoolId: 's2' }, target),
    ).toBe(false);
  });

  it('treats a null scope on the actor as "nowhere", never as "everywhere"', () => {
    expect(
      isWithinScope(
        { role: 'DISTRICT_ADMIN', districtId: null, blockId: null, schoolId: null },
        target,
      ),
    ).toBe(false);
    expect(
      isWithinScope({ role: 'TEACHER', districtId: null, blockId: null, schoolId: null }, target),
    ).toBe(false);
  });

  it('treats a missing identifier on the target as "elsewhere"', () => {
    expect(
      isWithinScope(
        { role: 'DISTRICT_ADMIN', districtId: 'd1', blockId: null, schoolId: null },
        {},
      ),
    ).toBe(false);
  });

  it('requires every role to carry the identifiers its reach is expressed in', () => {
    expect(requiredScopeFields('SUPER_ADMIN')).toEqual([]);
    expect(requiredScopeFields('DISTRICT_ADMIN')).toEqual(['districtId']);
    expect(requiredScopeFields('BLOCK_ADMIN')).toEqual(['districtId', 'blockId']);
    expect(requiredScopeFields('TEACHER')).toEqual(['districtId', 'blockId', 'schoolId']);
  });
});

describe('role assignment', () => {
  it('never lets a role create a peer or a superior', () => {
    for (const role of USER_ROLES) {
      const assignable = assignableRoles(role);
      expect(assignable).not.toContain(role);
      for (const candidate of assignable) {
        expect(hasAtLeastRole(candidate, role)).toBe(false);
      }
    }
  });

  it('leaves a teacher able to create nobody', () => {
    expect(assignableRoles('TEACHER')).toEqual([]);
  });
});

describe('visibility ceilings', () => {
  it('reserves the open web for district level and above', () => {
    expect(canApproveVisibility('PRINCIPAL', 'PUBLIC')).toBe(false);
    expect(canApproveVisibility('BLOCK_ADMIN', 'PUBLIC')).toBe(false);
    expect(canApproveVisibility('DISTRICT_ADMIN', 'PUBLIC')).toBe(true);
    expect(canApproveVisibility('STATE_ADMIN', 'PUBLIC')).toBe(true);
  });

  it('lets school leadership publish inside the platform', () => {
    expect(canApproveVisibility('PRINCIPAL', 'DISTRICT')).toBe(true);
    expect(canApproveVisibility('PRINCIPAL', 'SCHOOL')).toBe(true);
  });

  it('gives a teacher no publishing power at all', () => {
    expect(maxApprovableVisibility('TEACHER')).toBeNull();
    for (const visibility of ['SCHOOL', 'BLOCK', 'DISTRICT', 'STATE', 'PUBLIC'] as const) {
      expect(canApproveVisibility('TEACHER', visibility)).toBe(false);
    }
  });
});

describe('publish blockers', () => {
  /** A submission with everything in order, including a block officer's clearance. */
  const clean = {
    status: 'PENDING_REVIEW' as const,
    hasMedia: true,
    mediaWithoutChildCheckCount: 0,
    descriptionLength: 400,
    clearance: 'CLEARED' as const,
  };

  it('passes a complete submission', () => {
    expect(evaluatePublishBlockers(clean, 'PUBLIC', 'DISTRICT_ADMIN', 'PUBLIC')).toEqual([]);
  });

  /**
   * Exhaustive rather than by example. A new blocker added without a decision
   * here fails this test rather than defaulting to the wrong side, and the
   * wrong side is not symmetric: a blocker wrongly called unconditional greys
   * out the head teacher's only legal action, while one wrongly called
   * conditional lets the interface offer a publish the API will refuse.
   */
  it('classifies every blocker as either unconditional or a reason not to leave the school', () => {
    const broken = {
      status: 'DRAFT' as const,
      hasMedia: true,
      mediaWithoutChildCheckCount: 2,
      descriptionLength: 1,
      clearance: 'NOT_REQUIRED' as const,
    };
    // Nothing about this submission is in order, yet publishing it as the
    // school's own internal record fails only for reasons that hold anywhere.
    const atSchool = evaluatePublishBlockers(broken, 'SCHOOL', 'PRINCIPAL', 'SCHOOL');
    expect([...atSchool].sort()).toEqual([...UNCONDITIONAL_PUBLISH_BLOCKERS].sort());

    for (const code of Object.values(PUBLISH_BLOCKERS)) {
      const unconditional = UNCONDITIONAL_PUBLISH_BLOCKERS.includes(code);
      expect(atSchool.includes(code)).toBe(unconditional);
    }
  });

  it('stops an unchecked photograph leaving the school at any level', () => {
    // Deliberately not only at PUBLIC, unlike the consent rule this replaced.
    // An identifiable child reaching a district dashboard is the same failure
    // as one reaching the open web, with a smaller audience.
    for (const level of ['BLOCK', 'DISTRICT', 'STATE', 'PUBLIC'] as const) {
      expect(
        evaluatePublishBlockers(
          { ...clean, mediaWithoutChildCheckCount: 1 },
          level,
          'DISTRICT_ADMIN',
          level,
        ),
      ).toContain('CHILD_VISIBLE_CHECK_MISSING');
    }
  });

  it('does not ask about photographs for a record that stays in the school', () => {
    expect(
      evaluatePublishBlockers(
        { ...clean, clearance: 'NOT_REQUIRED', mediaWithoutChildCheckCount: 3 },
        'SCHOOL',
        'PRINCIPAL',
        'SCHOOL',
      ),
    ).toEqual([]);
  });

  it('needs no attestation for work that stays inside the school', () => {
    expect(
      evaluatePublishBlockers(
        { ...clean, clearance: 'NOT_REQUIRED' },
        'SCHOOL',
        'PRINCIPAL',
        'SCHOOL',
      ),
    ).toEqual([]);
  });

  it('demands the head teacher attest before work leaves the school', () => {
    // Two colleagues in one school are not an independent check on each other.
    expect(
      evaluatePublishBlockers(
        { ...clean, clearance: 'NOT_REQUIRED' },
        'BLOCK',
        'PRINCIPAL',
        'BLOCK',
      ),
    ).toContain('ATTESTATION_REQUIRED');
  });

  it('accepts the attestation being supplied in the same request', () => {
    expect(
      evaluatePublishBlockers(
        { ...clean, clearance: 'NOT_REQUIRED', attestingNow: true },
        'BLOCK',
        'PRINCIPAL',
        'BLOCK',
      ),
    ).toEqual([]);
  });

  it('does not ask for the attestation twice', () => {
    expect(
      evaluatePublishBlockers(
        { ...clean, clearance: 'AWAITING_BLOCK' },
        'BLOCK',
        'BLOCK_ADMIN',
        'BLOCK',
      ),
    ).toEqual([]);
  });

  it('requires a block officer to have actually looked before the open web', () => {
    // Auto-clearing on a school's own record is enough to reach other
    // educators. It is not enough to reach everyone.
    expect(
      evaluatePublishBlockers(
        { ...clean, clearance: 'AUTO_CLEARED' },
        'PUBLIC',
        'DISTRICT_ADMIN',
        'PUBLIC',
      ),
    ).toContain('BLOCK_CLEARANCE_REQUIRED');
  });

  it('reports every problem at once rather than one at a time', () => {
    const blockers = evaluatePublishBlockers(
      {
        status: 'DRAFT',
        hasMedia: true,
        mediaWithoutChildCheckCount: 2,
        descriptionLength: 3,
      },
      'PUBLIC',
      'PRINCIPAL',
      'BLOCK',
    );
    expect(blockers).toEqual(
      expect.arrayContaining([
        'NOT_SUBMITTED',
        'DESCRIPTION_TOO_SHORT',
        'VISIBILITY_ABOVE_ROLE',
        'VISIBILITY_ABOVE_REQUEST',
        'ATTESTATION_REQUIRED',
        'BLOCK_CLEARANCE_REQUIRED',
        'CHILD_VISIBLE_CHECK_MISSING',
      ]),
    );
  });
});

describe('activity state machine', () => {
  it('allows only the intended transitions', () => {
    expect(canTransitionActivity('DRAFT', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionActivity('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransitionActivity('PENDING_REVIEW', 'PUBLISHED')).toBe(true);
    expect(canTransitionActivity('ARCHIVED', 'PUBLISHED')).toBe(false);
    expect(canTransitionActivity('REJECTED', 'DRAFT')).toBe(true);
  });

  it('freezes a published record against its author', () => {
    expect(canEditActivity('PUBLISHED', true, 'TEACHER')).toBe(false);
    expect(canEditActivity('PUBLISHED', false, 'PRINCIPAL')).toBe(true);
    expect(canEditActivity('ARCHIVED', false, 'SUPER_ADMIN')).toBe(false);
  });

  it('lets an author edit their own draft', () => {
    expect(canEditActivity('DRAFT', true, 'TEACHER')).toBe(true);
    expect(canEditActivity('DRAFT', false, 'TEACHER')).toBe(false);
  });
});
