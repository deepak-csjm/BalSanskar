import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError, ERROR_CODES } from './errors.js';

/**
 * Parses a request payload, turning a Zod failure into the API's error envelope.
 *
 * Every route parses its own body, query and params through this helper. Nothing
 * reaches a service function as `unknown` or as an unchecked cast; that is the
 * whole reason the shared contracts package exists.
 */
export function parseOrThrow<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  try {
    return schema.parse(value) as z.infer<T>;
  } catch (error) {
    if (error instanceof ZodError) {
      const fields: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join('.') || '_';
        (fields[path] ??= []).push(issue.message);
      }
      throw new AppError(400, ERROR_CODES.VALIDATION_FAILED, 'Please check the highlighted fields', {
        fields,
      });
    }
    throw error;
  }
}

/**
 * Cursor pagination over an opaque, ordered key.
 *
 * Offsets are avoided on purpose: activity lists are appended to constantly, and
 * an offset-paginated moderation queue silently skips items as new ones arrive.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return decoded.length > 0 && decoded.length <= 200 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Trims a fetched page of `limit + 1` rows down to `limit`, returning the cursor
 * for the next page. Fetching one extra row is how the API knows whether more
 * exist without a second count query.
 */
export function paginate<T>(rows: T[], limit: number, cursorOf: (row: T) => string) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}
