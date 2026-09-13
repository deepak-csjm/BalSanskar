import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../enums.js';

/**
 * The single error envelope every failing API response uses.
 *
 * `code` is stable and machine-readable; `message` is English text for logs and
 * developers. Clients render `code` through their own translation table so that
 * a teacher in Shravasti sees Hindi even when the server speaks English.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Field-level validation problems, keyed by dotted path. */
    fields: z.record(z.string(), z.array(z.string())).optional(),
    requestId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_PENDING: 'ACCOUNT_PENDING',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ATTEMPTS_EXCEEDED: 'OTP_ATTEMPTS_EXCEEDED',
  /** A photograph nobody has confirmed is free of an identifiable child. */
  CHILD_VISIBLE_CHECK_MISSING: 'CHILD_VISIBLE_CHECK_MISSING',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const localeSchema = z.enum(SUPPORTED_LOCALES);

/**
 * Every user-visible name in the system is bilingual. Hindi is required because
 * it is the working language of the schools; English is optional and used for
 * departmental correspondence and exports.
 */
export const bilingualNameSchema = z.object({
  hi: z.string().min(1).max(160),
  en: z.string().min(1).max(160).nullable(),
});
export type BilingualName = z.infer<typeof bilingualNameSchema>;

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}
