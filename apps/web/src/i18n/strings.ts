/**
 * The string tables.
 *
 * Hindi ships with the first load; English is fetched only when somebody asks
 * for it. The two used to be one object, on the reasoning that "the whole
 * string table is a few kilobytes". That stopped being true — at 909 lines the
 * pair cost about 16 KB gzipped of a 97 KB budget, and every feature added to
 * both languages at once. Shipping the language the reader is actually using
 * halves that and halves the growth.
 *
 * Completeness is still checked at compile time: `en` is typed as a complete
 * record of Hindi's keys, so a string added to one and forgotten in the other
 * fails the build rather than rendering `undefined` on a teacher's screen.
 */
export { hi, type TranslationKey } from './tables/hi.js';
