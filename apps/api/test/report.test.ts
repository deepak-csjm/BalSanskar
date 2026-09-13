import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  setEnrolled,
  createTestApp,
  createUser,
  prisma,
  resetDatabase,
  publishThroughGate,
  seedGeography,
  teardown,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * Reporting and the public showcase.
 *
 * Two questions are being answered:
 *   - do the numbers a district officer sees reflect only moderated work, and
 *   - can anything a child could be identified by reach an unauthenticated
 *     request?
 */
describe('reporting and the public showcase', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
  let principal: TestUser;
  let districtAdmin: TestUser;
  let districtAdminB: TestUser;
  let stateAdmin: TestUser;
  let blockOfficer: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardown(app);
  });

  beforeEach(async () => {
    await resetDatabase();
    geo = await seedGeography();
    teacher = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
    });
    principal = await createUser(app, {
      role: 'PRINCIPAL',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
    });
    blockOfficer = await createUser(app, {
      role: 'BLOCK_ADMIN',
      blockId: geo.blockA1,
      districtId: geo.districtA,
    });
    districtAdmin = await createUser(app, { role: 'DISTRICT_ADMIN', districtId: geo.districtA });
    districtAdminB = await createUser(app, { role: 'DISTRICT_ADMIN', districtId: geo.districtB });
    stateAdmin = await createUser(app, { role: 'STATE_ADMIN' });
  });

  async function publishActivity(options: {
    visibility: 'SCHOOL' | 'BLOCK' | 'DISTRICT' | 'PUBLIC';
    title?: string;
    schemes?: string[];
  }): Promise<string> {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/activities',
      headers: auth(teacher),
      payload: {
        title: options.title ?? 'Kitchen garden planted with class 4',
        description:
          'The children planted spinach and coriander in the school kitchen garden and now water it in turns each morning.',
        category: 'COMMUNITY_ENGAGEMENT',
        occurredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        classLevels: ['4'],
        participantCount: 28,
        schemes: options.schemes ?? [],
      },
    });
    const id = (created.json() as { id: string }).id;
    await publishThroughGate(app, {
      activityId: id,
      author: teacher,
      head: principal,
      blockOfficer,
      districtOfficer: districtAdmin,
      visibility: options.visibility,
    });
    return id;
  }

  describe('overview', () => {
    it('counts only published activities', async () => {
      await publishActivity({ visibility: 'DISTRICT' });
      // A draft that never went through review.
      await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: {
          title: 'An unfinished draft that should never be counted',
          description: 'This has not been reviewed and must not appear in any departmental figure.',
          category: 'OTHER',
          occurredOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/overview',
        headers: auth(districtAdmin),
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { totals: { publishedActivities: number } };
      expect(body.totals.publishedActivities).toBe(1);
    });

    it('counts only verified achievements', async () => {
      await setEnrolled(geo.schoolA1);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/achievements',
        headers: auth(teacher),
        payload: {
          classLevel: '5',
          category: 'SPORTS',
          level: 'BLOCK',
          title: 'First place, block athletics meet',
          awardedOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
          position: 1,
        },
      });
      expect(created.statusCode).toBe(201);

      const beforeVerification = await app.inject({
        method: 'GET',
        url: '/v1/reports/overview',
        headers: auth(districtAdmin),
      });
      expect(
        (beforeVerification.json() as { totals: { verifiedAchievements: number } }).totals
          .verifiedAchievements,
      ).toBe(0);

      const achievementId = (created.json() as { id: string }).id;
      const verified = await app.inject({
        method: 'POST',
        url: `/v1/achievements/${achievementId}/verify`,
        headers: auth(districtAdmin),
        payload: { decision: 'VERIFIED' },
      });
      expect(verified.statusCode).toBe(200);

      const after = await app.inject({
        method: 'GET',
        url: '/v1/reports/overview',
        headers: auth(districtAdmin),
      });
      expect(
        (after.json() as { totals: { verifiedAchievements: number } }).totals.verifiedAchievements,
      ).toBe(1);
    });

    it('measures participation against every school on the register, not only the signed-up ones', async () => {
      await publishActivity({ visibility: 'DISTRICT' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/overview',
        headers: auth(districtAdmin),
      });
      const body = response.json() as {
        totals: { schools: number; activeSchools: number };
        participationRate: { schools: number };
      };
      // District A has two schools on the register; one of them published.
      expect(body.totals.schools).toBe(2);
      expect(body.totals.activeSchools).toBe(1);
      expect(body.participationRate.schools).toBe(0.5);
    });

    it('shows a district officer nothing from another district', async () => {
      await publishActivity({ visibility: 'DISTRICT' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/overview',
        headers: auth(districtAdminB),
      });
      const body = response.json() as { totals: { publishedActivities: number } };
      expect(body.totals.publishedActivities).toBe(0);
    });

    it('refuses a scope the caller does not administer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/reports/overview?districtId=${geo.districtB}`,
        headers: auth(districtAdmin),
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('dormant schools', () => {
    it('lists the schools that published nothing in the window', async () => {
      await publishActivity({ visibility: 'DISTRICT' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/dormant-schools',
        headers: auth(districtAdmin),
      });
      const body = response.json() as { items: Array<{ id: string }> };
      expect(body.items.map((row) => row.id)).toEqual([geo.schoolA2]);
    });
  });

  describe('CSV export', () => {
    it('is refused to a teacher and audited for an officer', async () => {
      const refused = await app.inject({
        method: 'GET',
        url: '/v1/reports/leaderboard.csv',
        headers: auth(teacher),
      });
      expect(refused.statusCode).toBe(403);

      const exported = await app.inject({
        method: 'GET',
        url: '/v1/reports/leaderboard.csv?groupBy=SCHOOL',
        headers: auth(districtAdmin),
      });
      expect(exported.statusCode).toBe(200);
      expect(exported.headers['content-type']).toContain('text/csv');

      const audited = await prisma().auditEvent.count({ where: { action: 'REPORT_EXPORTED' } });
      expect(audited).toBe(1);
    });

    it('neutralises a value a spreadsheet would run as a formula', async () => {
      await prisma().school.update({
        where: { id: geo.schoolA1 },
        data: { nameHi: '=HYPERLINK("http://evil.example","click")' },
      });
      const exported = await app.inject({
        method: 'GET',
        url: '/v1/reports/leaderboard.csv?groupBy=SCHOOL',
        headers: auth(districtAdmin),
      });
      expect(exported.body).toContain(`"'=HYPERLINK`);
    });
  });

  describe('public showcase', () => {
    it('shows only work published to PUBLIC', async () => {
      await publishActivity({ visibility: 'DISTRICT', title: 'Only for the department to see' });
      const response = await app.inject({ method: 'GET', url: '/v1/public/activities' });
      expect(response.statusCode).toBe(200);
      expect((response.json() as { items: unknown[] }).items).toHaveLength(0);
    });

    it('carries nothing about any child at all', async () => {
      /**
       * This used to assert that the showcase printed a given name and dropped
       * the surname. It now asserts something much stronger and much easier to
       * keep true: there is no child in the response, because there is no child
       * in the platform. See docs/data-protection.md.
       */
      const id = await publishActivity({ visibility: 'PUBLIC' });

      const response = await app.inject({ method: 'GET', url: `/v1/public/activities/${id}` });
      expect(response.statusCode).toBe(200);
      const raw = response.body;

      for (const field of [
        'studentId',
        'students',
        'recognisedStudents',
        'displayName',
        'guardian',
        'rollNumber',
        'fullName',
      ]) {
        expect(raw).not.toContain(field);
      }
      expect(raw).not.toContain(teacher.phone);

      // What it does carry: the school, the work, and how many took part.
      const body = response.json() as Record<string, unknown>;
      expect(body.schoolName).toBeTruthy();
      expect(body.participantCount).toBe(28);
      expect(body.classLevels).toEqual(['4']);
    });

    it('reports aggregate statistics without naming a school', async () => {
      await publishActivity({ visibility: 'PUBLIC' });
      const response = await app.inject({ method: 'GET', url: '/v1/public/statistics' });
      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, number>;
      expect(body.publishedActivities).toBeGreaterThanOrEqual(1);
      expect(response.body).not.toContain('विद्यालय ए१');
    });
  });

  describe('achievement verification', () => {
    it('refuses verification by the person who recorded it', async () => {
      await setEnrolled(geo.schoolA1);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/achievements',
        headers: auth(principal),
        payload: {
          classLevel: '5',
          category: 'ACADEMIC',
          level: 'SCHOOL',
          title: 'Top of the class in the term assessment',
          awardedOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        },
      });
      const id = (created.json() as { id: string }).id;

      const selfVerified = await app.inject({
        method: 'POST',
        url: `/v1/achievements/${id}/verify`,
        headers: auth(principal),
        payload: { decision: 'VERIFIED' },
      });
      expect(selfVerified.statusCode).toBe(403);
    });

    it('requires district sign-off for a state-level claim', async () => {
      await setEnrolled(geo.schoolA1);
      const created = await app.inject({
        method: 'POST',
        url: '/v1/achievements',
        headers: auth(teacher),
        payload: {
          classLevel: '5',
          category: 'SCIENCE',
          level: 'STATE',
          title: 'State science exhibition winner',
          awardedOn: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
        },
      });
      const id = (created.json() as { id: string }).id;

      const byPrincipal = await app.inject({
        method: 'POST',
        url: `/v1/achievements/${id}/verify`,
        headers: auth(principal),
        payload: { decision: 'VERIFIED' },
      });
      expect(byPrincipal.statusCode).toBe(403);
      expect((byPrincipal.json() as { error: { message: string } }).error.message).toContain(
        'district office',
      );

      const byDistrict = await app.inject({
        method: 'POST',
        url: `/v1/achievements/${id}/verify`,
        headers: auth(districtAdmin),
        payload: { decision: 'VERIFIED' },
      });
      expect(byDistrict.statusCode).toBe(200);
    });
  });

  describe('leaderboard', () => {
    it('can be ordered to surface the schools that need support', async () => {
      await publishActivity({ visibility: 'DISTRICT' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/leaderboard?groupBy=SCHOOL&order=LEAST_ACTIVE',
        headers: auth(stateAdmin),
      });
      const rows = (response.json() as { rows: Array<{ id: string; publishedActivities: number }> })
        .rows;
      expect(rows[0]?.publishedActivities).toBe(0);
      expect(rows[rows.length - 1]?.id).toBe(geo.schoolA1);
    });
  });

  describe('the scheme-wise return', () => {
    /**
     * The adoption argument, tested. An officer compiles this by hand every
     * month; if a teacher's three taps on the activity form do not produce it,
     * the officer has no reason to want the platform used and the whole thing
     * stays a showcase nobody opens twice.
     */
    it('turns the tags teachers apply into the report an officer files', async () => {
      await publishActivity({
        visibility: 'BLOCK',
        schemes: ['NIPUN_BHARAT'],
        title: 'Reading drill',
      });
      await publishActivity({
        visibility: 'BLOCK',
        schemes: ['NIPUN_BHARAT', 'PM_POSHAN'],
        title: 'Garden lesson',
      });
      await publishActivity({
        visibility: 'BLOCK',
        schemes: ['KAYAKALP'],
        title: 'Classroom repaired',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/schemes',
        headers: auth(districtAdmin),
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as {
        rows: Array<{ scheme: string; activities: number; childParticipations: number }>;
      };

      const nipun = body.rows.find((row) => row.scheme === 'NIPUN_BHARAT');
      expect(nipun?.activities).toBe(2);
      // 28 children on each of the two, summed rather than deduplicated.
      expect(nipun?.childParticipations).toBe(56);

      // Busiest programme first, because that is the officer's summary line.
      expect(body.rows[0]?.scheme).toBe('NIPUN_BHARAT');
      expect(body.rows.map((row) => row.scheme)).toContain('KAYAKALP');
    });

    it('counts untagged work under NONE rather than dropping it', async () => {
      // An officer who notices the scheme report disagreeing with the totals on
      // the overview screen stops trusting both.
      await publishActivity({ visibility: 'BLOCK', title: 'An untagged write-up' });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/schemes',
        headers: auth(districtAdmin),
      });
      const rows = (response.json() as { rows: Array<{ scheme: string; activities: number }> })
        .rows;
      expect(rows.find((row) => row.scheme === 'NONE')?.activities).toBe(1);
    });

    it('hands the officer a CSV, which is what actually gets forwarded', async () => {
      await publishActivity({ visibility: 'BLOCK', schemes: ['MISSION_SHAKTI'] });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/reports/schemes.csv',
        headers: auth(districtAdmin),
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.body).toContain('MISSION_SHAKTI');
      expect(response.body).toContain('Programme');
    });
  });
});
