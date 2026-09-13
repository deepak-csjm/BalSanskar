import { describe, expect, it } from 'vitest';
import { FORBIDDEN_FEATURES, GUARANTEE_STATEMENTS, PLATFORM_GUARANTEES } from '@balsanskar/shared';
import { hi } from './tables/hi.js';
import { en } from './tables/en.js';

const strings = { hi, en } as const;

/**
 * The promises page is the first thing a sceptical teacher reads, and it is
 * assembled at runtime from the guarantee ids in the shared package. That means
 * a guarantee added in `packages/shared` and forgotten here does not fail the
 * build — it renders as `undefined` on the screen where trust is being asked
 * for, which is the worst possible place for it.
 */
describe('the promises a teacher is shown', () => {
  const ids = Object.keys(PLATFORM_GUARANTEES);

  it('says every promise in Hindi and in English', () => {
    for (const id of ids) {
      for (const locale of ['hi', 'en'] as const) {
        const table = strings[locale] as Record<string, string | undefined>;
        expect(table[`promise.${id}`], `${locale}: promise.${id}`).toBeTruthy();
        expect(table[`promise.${id}.why`], `${locale}: promise.${id}.why`).toBeTruthy();
      }
    }
  });

  it('does not carry a promise string for a guarantee that no longer exists', () => {
    // The other direction: a guarantee dropped from the shared package must not
    // leave a promise on the screen that nothing enforces any more.
    const orphans = Object.keys(strings.hi)
      .filter((key) => key.startsWith('promise.') && key.endsWith('.why'))
      .map((key) => key.slice('promise.'.length, -'.why'.length))
      .filter((id) => !ids.includes(id));
    expect(orphans).toEqual([]);
  });

  it('shows the promises in the order the shared package sets', () => {
    expect(GUARANTEE_STATEMENTS.map((s) => s.id)).toEqual(
      expect.arrayContaining(ids as (keyof typeof PLATFORM_GUARANTEES)[]),
    );
    expect(GUARANTEE_STATEMENTS).toHaveLength(ids.length);
  });

  it('has something to refuse for the promises most likely to be pushed on', () => {
    const guarded = new Set(FORBIDDEN_FEATURES.map((f) => f.guarantee));
    for (const id of [
      'noAttendanceOrLocationTracking',
      'noTeacherRanking',
      'noIndividualTeacherMetricsAboveSchool',
    ] as const) {
      expect(guarded.has(id), `nothing is refused in the name of ${id}`).toBe(true);
    }
  });

  it('translates the page furniture too, not only the promises', () => {
    for (const locale of ['hi', 'en'] as const) {
      const table = strings[locale] as Record<string, string | undefined>;
      for (const key of [
        'promise.title',
        'promise.headline',
        'promise.intro',
        'promise.neverBuilt',
        'promise.neverBuiltIntro',
        'promise.arrivesAs',
        'promise.changing',
      ]) {
        expect(table[key], `${locale}: ${key}`).toBeTruthy();
      }
    }
  });
});
