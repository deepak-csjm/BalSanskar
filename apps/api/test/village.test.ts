import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  createTestApp,
  createUser,
  prisma,
  publishThroughGate,
  resetDatabase,
  seedGeography,
  teardown,
  validActivityPayload,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * The village's side of the school.
 *
 * The rule under test throughout: a page anybody in the world can open must
 * carry nothing that could harm anybody, and must still be worth opening. Those
 * pull in opposite directions, which is why it is tested rather than asserted.
 */
describe('the village and the school', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
  let head: TestUser;
  let blockOfficer: TestUser;
  let udise: string;

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
    head = await createUser(app, {
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
    const school = await prisma().school.findUniqueOrThrow({ where: { id: geo.schoolA1 } });
    udise = school.udiseCode;
  });

  // -------------------------------------------------------------------------

  describe('the page on the school wall', () => {
    it('opens without an account, because a parent will not make one', async () => {
      const response = await app.inject({ method: 'GET', url: `/v1/village/schools/${udise}` });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { schoolName: string; udiseCode: string };
      expect(body.udiseCode).toBe(udise);
      expect(body.schoolName).toBeTruthy();
    });

    it('is addressed by the code painted on the building', async () => {
      // A villager who cannot scan the code can read eleven digits off the wall.
      // An internal identifier would make that impossible.
      expect(udise).toMatch(/^\d{11}$/);
    });

    it('does not exist for a school the block office has not confirmed', async () => {
      // An unverified school with a village-facing noticeboard is exactly the
      // shape a fake school would want.
      const pending = await prisma().school.create({
        data: {
          udiseCode: '10000000123',
          nameHi: 'अपुष्ट विद्यालय',
          blockId: geo.blockA1,
          districtId: geo.districtA,
          status: 'PENDING_VERIFICATION',
        },
      });
      const response = await app.inject({
        method: 'GET',
        url: `/v1/village/schools/${pending.udiseCode}`,
      });
      expect(response.statusCode).toBe(404);
    });

    it('shows only work the block office has cleared', async () => {
      const draft = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: { ...validActivityPayload, title: 'Something still under review' },
      });
      const hidden = (draft.json() as { id: string }).id;

      const shown = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: { ...validActivityPayload, title: 'Something the block has cleared' },
      });
      await publishThroughGate(app, {
        activityId: (shown.json() as { id: string }).id,
        author: teacher,
        head,
        blockOfficer,
        visibility: 'BLOCK',
      });

      const response = await app.inject({ method: 'GET', url: `/v1/village/schools/${udise}` });
      const titles = (response.json() as { recentWork: { title: string }[] }).recentWork.map(
        (row) => row.title,
      );
      expect(titles).toContain('Something the block has cleared');
      expect(titles).not.toContain('Something still under review');
      expect(response.body).not.toContain(hidden);
    });

    it('carries nothing that identifies anybody', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/needs',
        headers: auth(head),
        payload: { kind: 'REPAIR', title: 'The hand pump by the gate needs a new washer' },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/surveys',
        headers: auth(head),
        payload: {
          habitationName: 'Rampur tola',
          surveyedOn: '2026-09-01',
          householdsVisited: 40,
          childrenFound: 6,
          childrenEnrolled: 4,
          surveyedBy: 'Anganwadi worker and two volunteers',
        },
      });

      const response = await app.inject({ method: 'GET', url: `/v1/village/schools/${udise}` });
      const raw = response.body;

      // No teacher's phone, no child, no guardian, no household.
      expect(raw).not.toContain(teacher.phone);
      expect(raw).not.toContain(head.phone);
      for (const field of ['guardian', 'studentId', 'rollNumber', 'childName', 'household"']) {
        expect(raw).not.toContain(field);
      }
    });

    it('is cheap to serve, because a village reads it all at once', async () => {
      const response = await app.inject({ method: 'GET', url: `/v1/village/schools/${udise}` });
      expect(response.headers['cache-control']).toContain('max-age');
    });
  });

  // -------------------------------------------------------------------------

  describe('what the school needs', () => {
    it('lets the head teacher ask the village for something', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/needs',
        headers: auth(head),
        payload: {
          kind: 'VOLUNTEER_TIME',
          title: 'Somebody to read with class 2 on Saturdays',
          detail: 'An hour a week. The children can decode but do not read fluently yet.',
          classLevels: ['2'],
        },
      });
      expect(created.statusCode).toBe(201);
      expect((created.json() as { status: string }).status).toBe('OPEN');

      const page = await app.inject({ method: 'GET', url: `/v1/village/schools/${udise}` });
      expect(page.body).toContain('Saturdays');
    });

    it('records who helped, as they chose to be named', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/needs',
        headers: auth(head),
        payload: { kind: 'MATERIAL', title: 'Twenty story books for the reading corner' },
      });
      const id = (created.json() as { id: string }).id;

      const met = await app.inject({
        method: 'POST',
        url: `/v1/needs/${id}/resolve`,
        headers: auth(head),
        payload: { status: 'MET', helperCredit: 'राम प्रसाद जी, रामपुर', metOn: '2026-09-05' },
      });
      expect(met.statusCode).toBe(200);
      const body = met.json() as { status: string; helperCredit: string };
      expect(body.status).toBe('MET');
      // Free text the head teacher typed after a conversation — not an account,
      // and never a contact detail. The platform is not a directory of villagers.
      expect(body.helperCredit).toContain('राम प्रसाद');
    });

    it('will not let one school resolve another school’s need', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/needs',
        headers: auth(head),
        payload: { kind: 'REPAIR', title: 'A fan for the class 5 room' },
      });
      const id = (created.json() as { id: string }).id;

      const stranger = await createUser(app, {
        role: 'PRINCIPAL',
        schoolId: geo.schoolB1,
        blockId: geo.blockB1,
        districtId: geo.districtB,
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/needs/${id}/resolve`,
        headers: auth(stranger),
        payload: { status: 'MET', metOn: '2026-09-05' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('refuses to mark a need met without saying when', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/needs',
        headers: auth(head),
        payload: { kind: 'OTHER', title: 'Chalk and dusters for the term' },
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/needs/${(created.json() as { id: string }).id}/resolve`,
        headers: auth(head),
        payload: { status: 'MET' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------

  describe('the School Management Committee', () => {
    it('records that the committee met and what it decided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/smc-meetings',
        headers: auth(head),
        payload: {
          heldOn: '2026-09-01',
          membersPresent: 11,
          parentsPresent: 9,
          womenPresent: 6,
          decisions:
            'Agreed to repair the boundary wall from the composite grant and to ask the panchayat for a hand pump.',
          raisedWithBlock: 'One classroom has no fan and summer is coming.',
        },
      });
      expect(response.statusCode).toBe(201);

      // A parent scanning the code can see the committee actually met.
      const page = await app.inject({ method: 'GET', url: `/v1/village/schools/${udise}` });
      const body = page.json() as { lastSmcMeeting: { parentsPresent: number } | null };
      expect(body.lastSmcMeeting?.parentsPresent).toBe(9);
    });

    it('catches arithmetic somebody got wrong in a hurry', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/smc-meetings',
        headers: auth(head),
        payload: {
          heldOn: '2026-09-01',
          membersPresent: 5,
          parentsPresent: 9,
          womenPresent: 2,
          decisions: 'More parents present than members present, which cannot be.',
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------

  describe('children who are not in school', () => {
    it('counts a hamlet without recording a single child', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/surveys',
        headers: auth(head),
        payload: {
          habitationName: 'ईंट भट्ठा बस्ती',
          kind: 'WORKSITE',
          surveyedOn: '2026-09-02',
          householdsVisited: 34,
          childrenFound: 11,
          childrenEnrolled: 3,
          surveyedBy: 'शिक्षा मित्र सुनीता एवं दो स्वयंसेवक',
          note: 'परिवार मार्च तक रहेंगे। शेष बच्चों के लिए पुनः जाना होगा।',
        },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json() as { stillOut: number; childrenFound: number };
      // The number the whole exercise is about.
      expect(body.stillOut).toBe(8);
    });

    it('replaces a repeat visit rather than double counting it', async () => {
      const payload = {
        habitationName: 'Rampur tola',
        surveyedOn: '2026-09-02',
        householdsVisited: 20,
        childrenFound: 5,
        childrenEnrolled: 1,
        surveyedBy: 'First volunteer',
      };
      await app.inject({ method: 'POST', url: '/v1/surveys', headers: auth(head), payload });
      await app.inject({
        method: 'POST',
        url: '/v1/surveys',
        headers: auth(head),
        payload: { ...payload, childrenEnrolled: 4, surveyedBy: 'Second volunteer' },
      });

      const listed = await app.inject({ method: 'GET', url: '/v1/surveys', headers: auth(head) });
      const body = listed.json() as {
        items: unknown[];
        summary: { childrenFound: number; stillOut: number };
      };
      // Two people walking the same hamlet on the same day is a duplicate, not
      // twice the children.
      expect(body.items).toHaveLength(1);
      expect(body.summary.childrenFound).toBe(5);
      expect(body.summary.stillOut).toBe(1);
    });

    it('refuses to enrol more children than were found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/surveys',
        headers: auth(head),
        payload: {
          habitationName: 'Nowhere',
          surveyedOn: '2026-09-02',
          householdsVisited: 10,
          childrenFound: 2,
          childrenEnrolled: 9,
          surveyedBy: 'Somebody optimistic',
        },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rolls up for the block officer, who is the one who can send help', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/surveys',
        headers: auth(head),
        payload: {
          habitationName: 'Tola one',
          surveyedOn: '2026-09-02',
          householdsVisited: 20,
          childrenFound: 6,
          childrenEnrolled: 2,
          surveyedBy: 'A volunteer',
        },
      });
      const response = await app.inject({
        method: 'GET',
        url: '/v1/surveys',
        headers: auth(blockOfficer),
      });
      expect(response.statusCode).toBe(200);
      const summary = (response.json() as { summary: { stillOut: number } }).summary;
      expect(summary.stillOut).toBe(4);
    });

    it('holds no column that could name a child', async () => {
      // The same guarantee the rest of the platform makes, asserted against the
      // new tables rather than assumed to extend to them.
      const columns = await prisma().$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('habitation_surveys', 'school_needs', 'smc_meetings')
          AND (
            column_name ILIKE '%child%name%'
            OR column_name ILIKE '%student%'
            OR column_name ILIKE '%guardian%'
            OR column_name ILIKE '%parent%name%'
          )
      `;
      expect(columns).toEqual([]);
    });
  });
});
