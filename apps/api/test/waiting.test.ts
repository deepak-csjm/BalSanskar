import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { RESPONSE_EXPECTATION_DAYS, type WaitingBoard } from '@balsanskar/shared';
import {
  auth,
  createTestApp,
  createUser,
  prisma,
  resetDatabase,
  seedGeography,
  teardown,
  validActivityPayload,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * The reciprocal half of the gate.
 *
 * Every other suite here checks that a school cannot get away with something.
 * This one checks that the offices above the school cannot either — that a
 * teacher can see who is sitting on their work and for how long, and that the
 * same screen shows an officer their own backlog before anybody else's.
 *
 * The reason it matters enough to test is documented rather than assumed: when
 * UP made digital attendance compulsory in July 2024, roughly 2 per cent of
 * teachers complied on day one, and the objection the unions put first was that
 * the instrument was aimed at teachers alone.
 */
describe('who is holding this', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
  let head: TestUser;
  let blockOfficer: TestUser;
  let districtOfficer: TestUser;
  let otherBlockOfficer: TestUser;

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
      fullName: 'सुनीता देवी',
    });
    head = await createUser(app, {
      role: 'PRINCIPAL',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'राम प्रसाद',
    });
    blockOfficer = await createUser(app, {
      role: 'BLOCK_ADMIN',
      blockId: geo.blockA1,
      districtId: geo.districtA,
    });
    otherBlockOfficer = await createUser(app, {
      role: 'BLOCK_ADMIN',
      blockId: geo.blockA2,
      districtId: geo.districtA,
    });
    districtOfficer = await createUser(app, { role: 'DISTRICT_ADMIN', districtId: geo.districtA });
  });

  async function board(user: TestUser): Promise<WaitingBoard> {
    const response = await app.inject({ method: 'GET', url: '/v1/waiting', headers: auth(user) });
    expect(response.statusCode).toBe(200);
    return response.json() as WaitingBoard;
  }

  async function submitActivity(requestedVisibility: 'SCHOOL' | 'DISTRICT'): Promise<string> {
    const created = await app.inject({
      method: 'POST',
      url: '/v1/activities',
      headers: auth(teacher),
      payload: validActivityPayload,
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };
    const submitted = await app.inject({
      method: 'POST',
      url: `/v1/activities/${id}/submit`,
      headers: auth(teacher),
      payload: { requestedVisibility },
    });
    expect(submitted.statusCode).toBe(200);
    return id;
  }

  it('shows a teacher that their own school is holding their work', async () => {
    const id = await submitActivity('SCHOOL');
    const seen = await board(teacher);

    expect(seen.total).toBe(1);
    expect(seen.items[0]).toMatchObject({
      id,
      kind: 'ACTIVITY',
      stage: 'HEAD_TEACHER',
      holder: 'विद्यालय ए१',
    });
    // A teacher owes nothing in this chain, and the screen has to say so or it
    // becomes one more thing measuring them.
    expect(seen.owedByYou).toBe(0);
  });

  it('moves the debt to the block office once the head teacher has attested', async () => {
    const id = await submitActivity('DISTRICT');
    const attested = await app.inject({
      method: 'POST',
      url: `/v1/activities/${id}/moderate`,
      headers: auth(head),
      payload: { decision: 'PUBLISH', visibility: 'DISTRICT', attestation: { confirmed: true } },
    });
    expect(attested.statusCode).toBe(200);

    const teacherSees = await board(teacher);
    expect(teacherSees.items[0]).toMatchObject({ stage: 'BLOCK_OFFICE', holder: 'ब्लॉक ११' });

    // The same item, on the officer's own screen, counted against them.
    const officerSees = await board(blockOfficer);
    expect(officerSees.owedByYou).toBe(1);
  });

  it('counts the head teacher’s own backlog against the head teacher', async () => {
    await submitActivity('SCHOOL');
    const headSees = await board(head);
    expect(headSees.owedByYou).toBe(1);
  });

  it('hands the debt to the district only when the open web is what is being asked for', async () => {
    const id = await submitActivity('DISTRICT');
    await app.inject({
      method: 'POST',
      url: `/v1/activities/${id}/moderate`,
      headers: auth(head),
      payload: { decision: 'PUBLISH', visibility: 'DISTRICT', attestation: { confirmed: true } },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/activities/${id}/clearance`,
      headers: auth(blockOfficer),
      payload: { decision: 'CLEAR' },
    });

    // Cleared and aiming at DISTRICT, not PUBLIC: nobody owes anything now.
    const afterClearance = await board(districtOfficer);
    expect(afterClearance.total).toBe(0);
    expect(afterClearance.owedByYou).toBe(0);
  });

  it('puts an ignored item at the top, however recently other things arrived', async () => {
    const older = await submitActivity('SCHOOL');
    const newer = await submitActivity('SCHOOL');
    // Backdate the first one by three weeks.
    await prisma().activity.update({
      where: { id: older },
      data: { submittedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000) },
    });

    const seen = await board(teacher);
    expect(seen.items.map((item) => item.id)).toEqual([older, newer]);
    expect(seen.oldestDays).toBe(21);
    expect(seen.items[0]?.overdue).toBe(true);
    expect(seen.items[1]?.overdue).toBe(false);
  });

  it('marks overdue against the stage’s own expectation, not one global number', () => {
    // Written as an assertion rather than a comment because the three numbers
    // are deliberately different: a head teacher is in the building, a block
    // officer covers dozens of schools, and pretending otherwise would make
    // the whole board read as an accusation.
    expect(RESPONSE_EXPECTATION_DAYS.HEAD_TEACHER).toBeLessThan(
      RESPONSE_EXPECTATION_DAYS.BLOCK_OFFICE,
    );
    expect(RESPONSE_EXPECTATION_DAYS.BLOCK_OFFICE).toBeLessThan(
      RESPONSE_EXPECTATION_DAYS.DISTRICT_OFFICE,
    );
  });

  it('keeps one block’s backlog out of the next block’s screen', async () => {
    const id = await submitActivity('DISTRICT');
    await app.inject({
      method: 'POST',
      url: `/v1/activities/${id}/moderate`,
      headers: auth(head),
      payload: { decision: 'PUBLISH', visibility: 'DISTRICT', attestation: { confirmed: true } },
    });

    const neighbour = await board(otherBlockOfficer);
    expect(neighbour.total).toBe(0);
    expect(neighbour.owedByYou).toBe(0);
  });

  it('never names an individual officer, only the office', async () => {
    const id = await submitActivity('DISTRICT');
    await app.inject({
      method: 'POST',
      url: `/v1/activities/${id}/moderate`,
      headers: auth(head),
      payload: { decision: 'PUBLISH', visibility: 'DISTRICT', attestation: { confirmed: true } },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/waiting',
      headers: auth(teacher),
    });
    // The same rule that protects the teacher protects the officer: an officer
    // measured by name starts clearing work without reading it.
    expect(response.body).not.toContain('BLOCK_ADMIN user');
    expect(response.body).toContain('ब्लॉक ११');
  });
});

describe('what the committee asked the block for', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let head: TestUser;
  let blockOfficer: TestUser;
  let otherBlockOfficer: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardown(app);
  });

  beforeEach(async () => {
    await resetDatabase();
    geo = await seedGeography();
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
      fullName: 'खंड शिक्षा अधिकारी',
    });
    otherBlockOfficer = await createUser(app, {
      role: 'BLOCK_ADMIN',
      blockId: geo.blockA2,
      districtId: geo.districtA,
    });
  });

  async function recordMeeting(raisedWithBlock?: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/smc-meetings',
      headers: auth(head),
      payload: {
        heldOn: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        membersPresent: 11,
        parentsPresent: 9,
        womenPresent: 6,
        decisions: 'हैंडपंप की मरम्मत के लिए खंड कार्यालय से अनुरोध करने का निर्णय हुआ।',
        ...(raisedWithBlock ? { raisedWithBlock } : {}),
      },
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  it('leaves an unanswered request on the block office’s board with its age', async () => {
    await recordMeeting('विद्यालय का हैंडपंप छह महीने से बंद है, मरम्मत करवाई जाए।');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/waiting',
      headers: auth(blockOfficer),
    });
    const seen = response.json() as WaitingBoard;
    const request = seen.items.find((item) => item.kind === 'SMC_REQUEST');
    expect(request).toBeDefined();
    expect(request?.stage).toBe('BLOCK_OFFICE');
    expect(request?.waitingDays).toBe(30);
    expect(request?.overdue).toBe(true);
    expect(seen.owedByYou).toBe(1);
  });

  it('stops the clock when the office answers in writing', async () => {
    const id = await recordMeeting('चारदीवारी टूटी है, मवेशी परिसर में आ जाते हैं।');
    const answered = await app.inject({
      method: 'POST',
      url: `/v1/smc-meetings/${id}/answer`,
      headers: auth(blockOfficer),
      payload: { answer: 'कायाकल्प के अगले चरण में चारदीवारी स्वीकृत कर दी गई है।' },
    });
    expect(answered.statusCode).toBe(200);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/waiting',
      headers: auth(blockOfficer),
    });
    const seen = response.json() as WaitingBoard;
    expect(seen.items.filter((item) => item.kind === 'SMC_REQUEST')).toEqual([]);
  });

  it('refuses an answer that says nothing', async () => {
    const id = await recordMeeting('शिक्षकों के दो पद रिक्त हैं।');
    const tooShort = await app.inject({
      method: 'POST',
      url: `/v1/smc-meetings/${id}/answer`,
      headers: auth(blockOfficer),
      payload: { answer: 'ठीक' },
    });
    expect(tooShort.statusCode).toBe(400);
  });

  it('does not let a head teacher answer their own committee', async () => {
    const id = await recordMeeting('शौचालय की सफ़ाई की व्यवस्था नहीं है।');
    const response = await app.inject({
      method: 'POST',
      url: `/v1/smc-meetings/${id}/answer`,
      headers: auth(head),
      payload: { answer: 'हमने स्वयं व्यवस्था कर ली है, कोई कार्रवाई आवश्यक नहीं।' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('does not let a neighbouring block answer', async () => {
    const id = await recordMeeting('पेयजल की व्यवस्था नहीं है।');
    const response = await app.inject({
      method: 'POST',
      url: `/v1/smc-meetings/${id}/answer`,
      headers: auth(otherBlockOfficer),
      payload: { answer: 'यह हमारे क्षेत्र का विद्यालय नहीं है।' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('does not put a meeting that asked for nothing on anybody’s board', async () => {
    await recordMeeting();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/waiting',
      headers: auth(blockOfficer),
    });
    const seen = response.json() as WaitingBoard;
    expect(seen.items.filter((item) => item.kind === 'SMC_REQUEST')).toEqual([]);
  });
});
