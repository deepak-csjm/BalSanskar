import { ERROR_CODES, type ErrorCode } from '@balsanskar/shared';

/**
 * The only error type route handlers should throw.
 *
 * Anything else that escapes a handler is treated as a bug: it is logged with a
 * stack trace and returned to the caller as an opaque 500, so that a database
 * error message never becomes part of an HTTP response.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string[]>;
  /** Extra context for the log line only. Never serialised to the client. */
  readonly context?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    options?: {
      fields?: Record<string, string[]>;
      context?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (options?.fields) this.fields = options.fields;
    if (options?.context) this.context = options.context;
  }
}

export const badRequest = (message: string, fields?: Record<string, string[]>) =>
  new AppError(400, ERROR_CODES.VALIDATION_FAILED, message, fields ? { fields } : undefined);

export const unauthenticated = (message = 'Sign in to continue') =>
  new AppError(401, ERROR_CODES.UNAUTHENTICATED, message);

export const forbidden = (
  message = 'You do not have access to this',
  context?: Record<string, unknown>,
) => new AppError(403, ERROR_CODES.FORBIDDEN, message, context ? { context } : undefined);

export const notFound = (message = 'Not found') =>
  new AppError(404, ERROR_CODES.NOT_FOUND, message);

export const conflict = (message: string, code: ErrorCode = ERROR_CODES.CONFLICT) =>
  new AppError(409, code, message);

export const invalidState = (message: string) =>
  new AppError(409, ERROR_CODES.INVALID_STATE_TRANSITION, message);

export const tooManyRequests = (message = 'Too many attempts. Please wait and try again.') =>
  new AppError(429, ERROR_CODES.RATE_LIMITED, message);

export { ERROR_CODES };
