import { execSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient, UserRole } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { loadConfig, resetConfigCache } from '../src/config.js';
import { hashPassword } from '../src/lib/crypto.js';
import { resetStorage } from '../src/lib/storage.js';
import { disconnectPrisma, getPrisma } from '../src/lib/prisma.js';

let migrated = false;

/**
 * Brings the test database up to the current migration state, once per run.
 *
 * `migrate deploy` rather than `db push`: the suite should exercise the same
 * schema — constraints included — that production will get, since several tests
 * assert on database-level constraints rather than on application checks.
 */
export function ensureMigrated(): void {
  if (migrated) return;
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  migrated = true;
}

export async function createTestApp(): Promise<FastifyInstance> {
  ensureMigrated();
  resetConfigCache();
  resetStorage();
  return buildApp(loadConfig());
}

export function prisma(): PrismaClient {
  return getPrisma();
}

/**
 * Empties every table between test files.
 *
 * TRUNCATE ... CASCADE rather than per-table deletes, so the order of the
 * foreign keys does not have to be maintained by hand as the schema grows.
 */
export async function resetDatabase(): Promise<void> {
  const db = getPrisma();
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_events","appreciations","activity_media","activities",
      "achievements","class_enrolments","media_assets","refresh_tokens",
      "otp_challenges","school_claims","users","schools","blocks","districts"
    RESTART IDENTITY CASCADE
  `);
}

export async function teardown(app: FastifyInstance): Promise<void> {
  await app.close();
  await disconnectPrisma();
  await rm(process.env.STORAGE_LOCAL_DIR ?? './.test-storage', { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface Geography {
  districtA: string;
  districtB: string;
  blockA1: string;
  blockA2: string;
  blockB1: string;
  schoolA1: string;
  schoolA2: string;
  schoolB1: string;
}

/**
 * Two districts, three blocks and three schools.
 *
 * Deliberately shaped so that every scope boundary can be crossed in a test:
 * same district different block, and different district entirely.
 */
export async function seedGeography(): Promise<Geography> {
  const db = getPrisma();
  const districtA = await db.district.create({
    data: { code: 'D1', nameHi: 'जिला एक', nameEn: 'District One', division: 'Test' },
  });
  const districtB = await db.district.create({
    data: { code: 'D2', nameHi: 'जिला दो', nameEn: 'District Two', division: 'Test' },
  });
  const blockA1 = await db.block.create({
    data: { districtId: districtA.id, code: 'B11', nameHi: 'ब्लॉक ११', nameEn: 'Block A1' },
  });
  const blockA2 = await db.block.create({
    data: { districtId: districtA.id, code: 'B12', nameHi: 'ब्लॉक १२', nameEn: 'Block A2' },
  });
  const blockB1 = await db.block.create({
    data: { districtId: districtB.id, code: 'B21', nameHi: 'ब्लॉक २१', nameEn: 'Block B1' },
  });

  const school = async (udise: string, blockId: string, districtId: string, nameHi: string) =>
    (
      await db.school.create({
        data: { udiseCode: udise, nameHi, type: 'PRIMARY', blockId, districtId },
      })
    ).id;

  return {
    districtA: districtA.id,
    districtB: districtB.id,
    blockA1: blockA1.id,
    blockA2: blockA2.id,
    blockB1: blockB1.id,
    schoolA1: await school('10000000001', blockA1.id, districtA.id, 'विद्यालय ए१'),
    schoolA2: await school('10000000002', blockA2.id, districtA.id, 'विद्यालय ए२'),
    schoolB1: await school('10000000003', blockB1.id, districtB.id, 'विद्यालय बी१'),
  };
}

export interface TestUser {
  id: string;
  phone: string;
  role: UserRole;
  token: string;
}

let phoneCounter = 0;
export function nextPhone(): string {
  phoneCounter += 1;
  return `+919${String(700000000 + phoneCounter).padStart(9, '0')}`;
}

/**
 * Creates an active user and signs them in through the real login endpoint, so
 * every test exercises the same token issuance path production uses.
 */
export async function createUser(
  app: FastifyInstance,
  options: {
    role: UserRole;
    schoolId?: string | null;
    blockId?: string | null;
    districtId?: string | null;
    fullName?: string;
    status?: 'ACTIVE' | 'PENDING_APPROVAL' | 'SUSPENDED';
  },
): Promise<TestUser> {
  const db = getPrisma();
  const phone = nextPhone();
  const password = 'TestPassword123';
  const user = await db.user.create({
    data: {
      phone,
      fullName: options.fullName ?? `${options.role} user`,
      role: options.role,
      status: options.status ?? 'ACTIVE',
      passwordHash: await hashPassword(password),
      schoolId: options.schoolId ?? null,
      blockId: options.blockId ?? null,
      districtId: options.districtId ?? null,
    },
  });

  if ((options.status ?? 'ACTIVE') !== 'ACTIVE') {
    return { id: user.id, phone, role: user.role, token: '' };
  }

  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/password/login',
    payload: { identifier: phone, password },
  });
  if (response.statusCode !== 200) {
    throw new Error(`Login failed in fixture: ${response.statusCode} ${response.body}`);
  }
  const body = response.json() as { tokens: { accessToken: string } };
  return { id: user.id, phone, role: user.role, token: body.tokens.accessToken };
}

export function auth(user: TestUser): Record<string, string> {
  return { authorization: `Bearer ${user.token}` };
}

/**
 * Records how many children a school teaches, which is all the platform knows
 * about them. Replaces a helper that created a named child with a guardian and
 * a consent slip; see docs/data-protection.md.
 */
export async function setEnrolled(
  schoolId: string,
  counts: Partial<Record<'CLASS_4' | 'CLASS_5' | 'CLASS_6' | 'CLASS_7', number>> = {
    CLASS_5: 30,
  },
): Promise<void> {
  const db = getPrisma();
  for (const [classLevel, enrolled] of Object.entries(counts)) {
    await db.classEnrolment.upsert({
      where: {
        schoolId_classLevel: { schoolId, classLevel: classLevel as 'CLASS_5' },
      },
      create: { schoolId, classLevel: classLevel as 'CLASS_5', enrolled, asOn: new Date() },
      update: { enrolled },
    });
  }
}

export const validActivityPayload = {
  title: 'Reading corner set up in class 5',
  description:
    'We built a reading corner from donated books and the children now spend twenty minutes reading aloud every afternoon.',
  category: 'READING_AND_LIBRARY' as const,
  occurredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  classLevels: ['5'] as const,
  participantCount: 32,
};

/**
 * Drives an activity all the way through the escalation gate.
 *
 * Work leaving the school now needs the head teacher's attestation and, for a
 * NEW school, a block officer's clearance. Tests that care about something else
 * — consent, reporting, appreciation — should not each re-implement that chain.
 *
 * Returns the activity id.
 */
export async function publishThroughGate(
  app: FastifyInstance,
  options: {
    activityId: string;
    author: TestUser;
    head: TestUser;
    blockOfficer?: TestUser;
    districtOfficer?: TestUser;
    visibility: 'SCHOOL' | 'BLOCK' | 'DISTRICT' | 'PUBLIC';
  },
): Promise<void> {
  const { activityId, head, visibility } = options;

  await app.inject({
    method: 'POST',
    url: `/v1/activities/${activityId}/submit`,
    headers: auth(options.author),
    payload: { requestedVisibility: visibility },
  });

  if (visibility === 'SCHOOL') {
    const published = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/moderate`,
      headers: auth(head),
      payload: { decision: 'PUBLISH', visibility: 'SCHOOL' },
    });
    if (published.statusCode !== 200) {
      throw new Error(`Publish failed: ${published.statusCode} ${published.body}`);
    }
    return;
  }

  // Anything wider than the school: the head teacher attests, and the block
  // clears it into view. PUBLIC additionally needs a district officer to
  // promote it once the block has cleared it.
  const target = visibility === 'PUBLIC' ? 'DISTRICT' : visibility;
  const attested = await app.inject({
    method: 'POST',
    url: `/v1/activities/${activityId}/moderate`,
    headers: auth(head),
    payload: {
      decision: 'PUBLISH',
      visibility: target,
      attestation: { confirmed: true },
    },
  });
  if (attested.statusCode !== 200) {
    throw new Error(`Attestation failed: ${attested.statusCode} ${attested.body}`);
  }

  const officer = options.blockOfficer;
  if (!officer) throw new Error('A block officer is required to clear work beyond the school');
  const cleared = await app.inject({
    method: 'POST',
    url: `/v1/activities/${activityId}/clearance`,
    headers: auth(officer),
    payload: { decision: 'CLEAR' },
  });
  if (cleared.statusCode !== 200) {
    throw new Error(`Clearance failed: ${cleared.statusCode} ${cleared.body}`);
  }

  if (visibility === 'PUBLIC') {
    const district = options.districtOfficer;
    if (!district) throw new Error('A district officer is required to reach the open web');
    const promoted = await app.inject({
      method: 'POST',
      url: `/v1/activities/${activityId}/moderate`,
      headers: auth(district),
      payload: { decision: 'PUBLISH', visibility: 'PUBLIC' },
    });
    if (promoted.statusCode !== 200) {
      throw new Error(`Public publish failed: ${promoted.statusCode} ${promoted.body}`);
    }
  }
}
