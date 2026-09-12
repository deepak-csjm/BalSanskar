import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  createStudent,
  createTestApp,
  createUser,
  prisma,
  resetDatabase,
  seedGeography,
  teardown,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * Access-control boundaries.
 *
 * These are the tests that matter most in this codebase. A bug in reporting
 * produces a wrong number; a bug here exposes a child's record to a stranger.
 * Every case is written as "someone real tries something they should not be
 * able to do", against the live HTTP surface rather than the service functions,
 * so that a route registered without its guard fails the suite.
 */
describe('access control', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacherA1: TestUser;
  let teacherA1Colleague: TestUser;
  let principalA1: TestUser;
  let teacherA2: TestUser;
  let blockAdminA1: TestUser;
  let districtAdminA: TestUser;
  let districtAdminB: TestUser;
  let stateAdmin: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardown(app);
  });

  beforeEach(async () => {
    await resetDatabase();
    geo = await seedGeography();

    teacherA1 = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'Teacher A1',
    });
    teacherA1Colleague = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'Colleague A1',
    });
    principalA1 = await createUser(app, {
      role: 'PRINCIPAL',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'Principal A1',
    });
    teacherA2 = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA2,
      blockId: geo.blockA2,
      districtId: geo.districtA,
      fullName: 'Teacher A2',
    });
    blockAdminA1 = await createUser(app, {
      role: 'BLOCK_ADMIN',
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'Block Officer A1',
    });
    districtAdminA = await createUser(app, {
      role: 'DISTRICT_ADMIN',
      districtId: geo.districtA,
      fullName: 'District Officer A',
    });
    districtAdminB = await createUser(app, {
      role: 'DISTRICT_ADMIN',
      districtId: geo.districtB,
      fullName: 'District Officer B',
    });
    stateAdmin = await createUser(app, { role: 'STATE_ADMIN', fullName: 'State Officer' });
  });

  describe('student records', () => {
    it("hides a child's record from a teacher at another school", async () => {
      const studentId = await createStudent(geo.schoolA1);
      const response = await app.inject({
        method: 'GET',
        url: `/v1/students/${studentId}`,
        headers: auth(teacherA2),
      });
      expect(response.statusCode).toBe(403);
    });

    it("hides a child's record from an officer in another district", async () => {
      const studentId = await createStudent(geo.schoolA1);
      const response = await app.inject({
        method: 'GET',
        url: `/v1/students/${studentId}`,
        headers: auth(districtAdminB),
      });
      expect(response.statusCode).toBe(403);
    });

    it('lets the block officer for that block see the record', async () => {
      const studentId = await createStudent(geo.schoolA1);
      const response = await app.inject({
        method: 'GET',
        url: `/v1/students/${studentId}`,
        headers: auth(blockAdminA1),
      });
      expect(response.statusCode).toBe(200);
    });

    it('scopes a roster listing to the caller’s own school', async () => {
      await createStudent(geo.schoolA1, { fullName: 'Child at A1' });
      await createStudent(geo.schoolA2, { fullName: 'Child at A2' });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/students',
        headers: auth(teacherA1),
      });
      const body = response.json() as { items: Array<{ fullName: string }> };
      expect(body.items).toHaveLength(1);
      expect(body.items[0]?.fullName).toBe('Child at A1');
    });

    it('refuses a filter that points outside the caller’s area rather than returning nothing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/students?schoolId=${geo.schoolA2}`,
        headers: auth(teacherA1),
      });
      expect(response.statusCode).toBe(403);
    });

    it('stops a teacher creating a student at another school', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/students',
        headers: auth(teacherA1),
        payload: {
          schoolId: geo.schoolA2,
          fullName: 'Injected Child',
          classLevel: '3',
          gender: 'MALE',
          guardianName: 'Someone',
        },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('role capabilities', () => {
    it('does not let a teacher approve a registration', async () => {
      const pending = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
        status: 'PENDING_APPROVAL',
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/users/${pending.id}/approve`,
        headers: auth(teacherA1),
        payload: {},
      });
      expect(response.statusCode).toBe(403);
    });

    it('lets the head teacher approve a registration at their school', async () => {
      const pending = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
        status: 'PENDING_APPROVAL',
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/users/${pending.id}/approve`,
        headers: auth(principalA1),
        payload: {},
      });
      expect(response.statusCode).toBe(200);
      expect((response.json() as { status: string }).status).toBe('ACTIVE');
    });

    it('does not let a head teacher approve a registration at another school', async () => {
      const pending = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA2,
        blockId: geo.blockA2,
        districtId: geo.districtA,
        status: 'PENDING_APPROVAL',
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/users/${pending.id}/approve`,
        headers: auth(principalA1),
        payload: {},
      });
      expect(response.statusCode).toBe(403);
    });

    it('does not let anyone manage an account at or above their own level', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/users/${districtAdminA.id}/suspend`,
        headers: auth(blockAdminA1),
        payload: { reason: 'attempted escalation' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('does not let a district officer mint a peer or a superior', async () => {
      const target = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      const peer = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target.id}/role`,
        headers: auth(districtAdminA),
        payload: { role: 'DISTRICT_ADMIN' },
      });
      expect(peer.statusCode).toBe(403);

      const superior = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target.id}/role`,
        headers: auth(districtAdminA),
        payload: { role: 'SUPER_ADMIN' },
      });
      expect(superior.statusCode).toBe(403);
    });

    it('ends the affected sessions when a role changes', async () => {
      const target = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      const promoted = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${target.id}/role`,
        headers: auth(districtAdminA),
        payload: { role: 'PRINCIPAL' },
      });
      expect(promoted.statusCode).toBe(200);

      const remaining = await prisma().refreshToken.count({
        where: { userId: target.id, revokedAt: null },
      });
      expect(remaining).toBe(0);
    });

    it('refuses to promote someone whose account lacks the reach the role needs', async () => {
      const floating = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA1,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });
      // Strip the school, as an incomplete import would.
      await prisma().user.update({ where: { id: floating.id }, data: { schoolId: null } });

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${floating.id}/role`,
        headers: auth(districtAdminA),
        payload: { role: 'PRINCIPAL' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('does not let anyone suspend themselves out of an investigation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/users/${blockAdminA1.id}/suspend`,
        headers: auth(blockAdminA1),
        payload: { reason: 'self' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('schools', () => {
    it('does not let a teacher create a school', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/schools',
        headers: auth(teacherA1),
        payload: {
          udiseCode: '10000000009',
          nameHi: 'नया विद्यालय',
          type: 'PRIMARY',
          blockId: geo.blockA1,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it('does not let a district officer create a school in another district', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/schools',
        headers: auth(districtAdminA),
        payload: {
          udiseCode: '10000000010',
          nameHi: 'नया विद्यालय',
          type: 'PRIMARY',
          blockId: geo.blockB1,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it('copies the district from the block rather than trusting the caller', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/schools',
        headers: auth(stateAdmin),
        payload: {
          udiseCode: '10000000011',
          nameHi: 'नया विद्यालय',
          type: 'PRIMARY',
          blockId: geo.blockB1,
        },
      });
      expect(response.statusCode).toBe(201);
      expect((response.json() as { districtId: string }).districtId).toBe(geo.districtB);
    });

    it('rejects a duplicate UDISE code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/schools',
        headers: auth(stateAdmin),
        payload: {
          udiseCode: '10000000001',
          nameHi: 'डुप्लिकेट',
          type: 'PRIMARY',
          blockId: geo.blockA1,
        },
      });
      expect(response.statusCode).toBe(409);
    });
  });

  describe('audit trail', () => {
    it('is not readable by a teacher', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/audit',
        headers: auth(teacherA1),
      });
      expect(response.statusCode).toBe(403);
    });

    it('is narrowed to the reader’s own area', async () => {
      const studentA1 = await createStudent(geo.schoolA1);
      await app.inject({
        method: 'PATCH',
        url: `/v1/students/${studentA1}`,
        headers: auth(teacherA1),
        payload: { section: 'A' },
      });

      const readerB = await app.inject({
        method: 'GET',
        url: '/v1/audit',
        headers: auth(districtAdminB),
      });
      expect(readerB.statusCode).toBe(200);
      expect((readerB.json() as { items: unknown[] }).items).toHaveLength(0);

      const readerA = await app.inject({
        method: 'GET',
        url: '/v1/audit',
        headers: auth(districtAdminA),
      });
      const events = (readerA.json() as { items: Array<{ action: string }> }).items;
      expect(events.some((event) => event.action === 'STUDENT_UPDATED')).toBe(true);
    });
  });

  describe('drafts', () => {
    it('keeps one teacher’s draft out of a colleague’s list', async () => {
      const draft = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacherA1),
        payload: {
          title: 'A half-written note about the science fair',
          description:
            'This is an unfinished draft that should stay private until it is submitted.',
          category: 'SCIENCE_AND_MATH',
          occurredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        },
      });
      expect(draft.statusCode).toBe(201);
      const draftId = (draft.json() as { id: string }).id;

      const colleagueList = await app.inject({
        method: 'GET',
        url: '/v1/activities',
        headers: auth(teacherA1Colleague),
      });
      expect((colleagueList.json() as { items: unknown[] }).items).toHaveLength(0);

      const direct = await app.inject({
        method: 'GET',
        url: `/v1/activities/${draftId}`,
        headers: auth(teacherA1Colleague),
      });
      expect(direct.statusCode).toBe(404);
    });
  });
});
