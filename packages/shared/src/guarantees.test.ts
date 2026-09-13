import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_FEATURES,
  GUARANTEE_HEADLINE,
  GUARANTEE_STATEMENTS,
  PLATFORM_GUARANTEES,
  RECOGNITION_RULES,
  leaderboardQuerySchema,
  type Guarantee,
} from './index.js';

/**
 * The promises are only worth something if they cannot quietly lapse.
 *
 * A guarantee that lives in a doc comment survives exactly until the first
 * officer asks for teacher-wise data and somebody reasonable says "only for
 * monitoring". These tests are what makes that conversation happen in a pull
 * request review instead of after the fact.
 */

describe('platform guarantees', () => {
  it('holds every promise true — none may be switched off to make a feature work', () => {
    for (const [name, held] of Object.entries(PLATFORM_GUARANTEES)) {
      expect(held, `${name} must remain true`).toBe(true);
    }
  });

  it('says each promise to a teacher exactly once', () => {
    // Not decoration. Written first as a duplicated entry and a missing one,
    // both of which this caught: a promise list that silently drops a promise
    // is worse than none, because the screen still looks complete.
    const said = GUARANTEE_STATEMENTS.map((s) => s.id);
    const declared = Object.keys(PLATFORM_GUARANTEES) as Guarantee[];

    expect([...said].sort()).toEqual([...declared].sort());
    expect(new Set(said).size, 'a promise is stated twice').toBe(said.length);
  });

  it('writes the promises in words a teacher would use, not in ours', () => {
    for (const { id, statement, because } of GUARANTEE_STATEMENTS) {
      expect(statement.length, `${id} statement is too terse to reassure anyone`).toBeGreaterThan(
        25,
      );
      expect(statement.length, `${id} statement is too long to read on a phone`).toBeLessThan(110);
      expect(because.length, `${id} needs a reason, not just an assertion`).toBeGreaterThan(40);
      // A promise phrased in the platform's vocabulary reassures nobody.
      expect(statement.toLowerCase()).not.toContain('data fiduciary');
      expect(statement.toLowerCase()).not.toContain('audit');
    }
  });

  it('names the plausible request behind every forbidden feature', () => {
    // The failure mode is never an obviously bad proposal. It is a reasonable
    // one whose second-order effect is a surveillance instrument, so each entry
    // has to be recognisable on the way in.
    for (const entry of FORBIDDEN_FEATURES) {
      expect(Object.keys(PLATFORM_GUARANTEES)).toContain(entry.guarantee);
      expect(
        entry.arrivesAs.length,
        `${entry.feature} needs the sentence it arrives as`,
      ).toBeGreaterThan(20);
      expect(entry.why.length).toBeGreaterThan(40);
    }
  });

  it('forbids the specific instrument that was withdrawn in 2024', () => {
    const forbidden = FORBIDDEN_FEATURES.map((f) =>
      `${f.feature} ${f.arrivesAs} ${f.why}`.toLowerCase(),
    );
    expect(forbidden.some((f) => f.includes('attendance'))).toBe(true);
    expect(forbidden.some((f) => f.includes('geotag'))).toBe(true);
    expect(forbidden.some((f) => f.includes('leaderboard'))).toBe(true);
  });

  it('says the headline the same way everywhere it is quoted', () => {
    expect(GUARANTEE_HEADLINE).toContain('measures systems, never people');
  });
});

describe('the guarantees bind the rest of the code', () => {
  it('keeps the recognition rules consistent with the promises', () => {
    // Two constants describing one commitment will drift. This is the joint.
    expect(RECOGNITION_RULES.rankTeachers).toBe(!PLATFORM_GUARANTEES.noTeacherRanking);
    expect(RECOGNITION_RULES.publicActivityCounts).toBe(
      !PLATFORM_GUARANTEES.noIndividualTeacherMetricsAboveSchool,
    );
    expect(RECOGNITION_RULES.portfolioExportable).toBe(PLATFORM_GUARANTEES.teacherOwnsTheirRecord);
    expect(RECOGNITION_RULES.appreciationRequiresNamedOfficer).toBe(
      PLATFORM_GUARANTEES.recognitionIsNamedAndHuman,
    );
  });

  it('gives the league table no way to group by teacher', () => {
    // The single most likely violation, and the cheapest to prevent: an enum
    // that never learns the word. Officers order schools; nobody orders people.
    const parsed = leaderboardQuerySchema.safeParse({ groupBy: 'TEACHER' });
    expect(parsed.success).toBe(false);

    for (const allowed of ['DISTRICT', 'BLOCK', 'SCHOOL']) {
      expect(leaderboardQuerySchema.safeParse({ groupBy: allowed }).success).toBe(true);
    }
  });
});
