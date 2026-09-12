import { z } from 'zod';

/**
 * Indian mobile numbers, always stored and transmitted in E.164 form.
 *
 * Teachers type ten digits; {@link normalisePhone} accepts the shapes they
 * actually produce (spaces, leading zero, +91, 0091) and yields one canonical
 * value so that a number can serve as a unique account identifier.
 */
export const PHONE_REGEX = /^\+91[6-9]\d{9}$/;

export function normalisePhone(input: string): string | null {
  let digits = input.replace(/[^\d]/g, '');

  // Peel the prefixes people actually type, in the order they nest:
  // an international access code, then a country code, then the trunk zero.
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

  if (digits.length !== 10) return null;
  const first = digits[0];
  if (first === undefined || first < '6' || first > '9') return null;
  return `+91${digits}`;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (normalised === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid 10-digit Indian mobile number',
      });
      return z.NEVER;
    }
    return normalised;
  });

/** UDISE+ school code: 11 digits, nationally unique, printed on every board. */
export const UDISE_REGEX = /^\d{11}$/;
export const udiseSchema = z
  .string()
  .trim()
  .regex(UDISE_REGEX, 'UDISE code must be exactly 11 digits');

export const idSchema = z.string().trim().min(1).max(64);

/**
 * Strips characters that are never legitimately typed by a teacher: C0/C1
 * control codes, zero-width joiners used to smuggle look-alike text, and the
 * bidirectional overrides behind "Trojan Source" style display spoofing.
 */
export function sanitiseText(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const isC0 = code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    const isDelete = code === 0x7f;
    const isC1 = code >= 0x80 && code <= 0x9f;
    const isBidiOverride = code >= 0x202a && code <= 0x202e;
    const isBidiIsolate = code >= 0x2066 && code <= 0x2069;
    const isZeroWidth = code === 0x200b || code === 0x200c || code === 0x200d || code === 0xfeff;
    if (isC0 || isDelete || isC1 || isBidiOverride || isBidiIsolate || isZeroWidth) continue;
    out += char;
  }
  return out;
}

/** Single-line free text written by teachers: titles, names, captions. */
export const cleanText = (min: number, max: number) =>
  z
    .string()
    .transform((value) => sanitiseText(value).replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min, `Enter at least ${min} characters`).max(max));

/** Multi-line free text. Paragraph breaks survive; runs of blank lines do not. */
export const cleanMultilineText = (min: number, max: number) =>
  z
    .string()
    .transform((value) =>
      sanitiseText(value)
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    )
    .pipe(z.string().min(min, `Enter at least ${min} characters`).max(max));

/** A calendar date with no time component, e.g. `2026-02-14`. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a real calendar date');

/** A date that cannot be in the future — an activity has to have happened. */
export const pastOrTodaySchema = dateOnlySchema.refine((value) => {
  const today = new Date().toISOString().slice(0, 10);
  return value <= today;
}, 'The date cannot be in the future');

export const paginationSchema = z.object({
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .refine((value) => /[a-z]/.test(value), 'Include a lower-case letter')
  .refine((value) => /[A-Z]/.test(value), 'Include an upper-case letter')
  .refine((value) => /\d/.test(value), 'Include a digit');

export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits');
