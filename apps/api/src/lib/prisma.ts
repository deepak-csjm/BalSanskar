import { PrismaClient } from '@prisma/client';
import { getConfig } from '../config.js';

/**
 * A single client per process.
 *
 * Prisma holds its own connection pool; creating more than one client would
 * multiply the pool against a database that, in a state data centre, is likely
 * to have a conservative `max_connections`.
 */
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (client) return client;
  const config = getConfig();
  client = new PrismaClient({
    datasources: { db: { url: config.DATABASE_URL } },
    log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = null;
}

export type { PrismaClient };

/**
 * Postgres error codes the application reacts to by name rather than by parsing
 * driver messages.
 */
export const PG_ERROR = {
  UNIQUE_VIOLATION: 'P2002',
  FOREIGN_KEY_VIOLATION: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
} as const;

export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

/** The columns named in a unique-constraint violation, when Prisma reports them. */
export function uniqueViolationTargets(error: unknown): string[] {
  if (!isPrismaError(error, PG_ERROR.UNIQUE_VIOLATION)) return [];
  const meta = (error as { meta?: { target?: unknown } }).meta;
  const target = meta?.target;
  if (Array.isArray(target))
    return target.filter((entry): entry is string => typeof entry === 'string');
  if (typeof target === 'string') return [target];
  return [];
}
