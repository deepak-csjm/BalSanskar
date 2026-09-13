import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { isSection27Purpose, type DutyRecord, type DutySummary } from '@balsanskar/shared';
import {
  auth,
  createTestApp,
  createUser,
  resetDatabase,
  seedGeography,
  teardown,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * The ledger of teaching days the state's own demands consumed.
 *
 * The thing being protected here is narrow and absolute: a record of days a
 * teacher spent away from class is, read from above with a name attached, a
 * record of absence — and Uttar Pradesh enforces deployment by withholding
 * salaries. Inside the school it is exactly what a head teacher needs. Outside
 * it, it must be a school total and nothing else.
 */
describe('non-teaching duty', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
  let colleague: TestUser;
  let head: TestUser;
  let blockOfficer: TestUser;
  let districtOfficer: TestUser;

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
    colleague = await createUser(app, {
      role: 'TEACHER',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'मोहन लाल',
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
    districtOfficer = await createUser(app, { role: 'DISTRICT_ADMIN', districtId: geo.districtA });
  });

  const BLO_DUTY = {
    category: 'ELECTION' as const,
    description: 'SIR बूथ लेवल ऑफिसर, बूथ 142',
    orderReference: 'SEC/SIR/2026/1184',
    fromDate: '2026-01-06',
    toDate: '2026-02-06',
    teachingDaysLost: 24,
    duringSchoolHours: true,
    honorariumDueRupees: 18000,
    honorariumReceivedRupees: 12000,
  };

  async function record(as: TestUser, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/v1/duties',
      headers: auth(as),
      payload: { ...BLO_DUTY, ...payload },
    });
  }

  it('records a duty against the three purposes the Act actually names', async () => {
    const response = await record(teacher);
    expect(response.statusCode).toBe(201);
    const duty = response.json() as DutyRecord;
    expect(duty.category).toBe('ELECTION');
    // Election duty IS one of the three s.27 permits. The platform says so
    // rather than implying every deployment is unlawful, which is the fastest
    // way to be dismissed by an officer who has read the Act.
    expect(duty.section27).toBe(true);
    expect(duty.duringSchoolHours).toBe(true);
    expect(duty.teacherName).toBe('सुनीता देवी');
  });

  it('marks the residue the Act does not list, without calling it anything', async () => {
    const response = await record(teacher, {
      category: 'OTHER',
      description: 'कांवड़ यात्रा सेवा',
      teachingDaysLost: 3,
      fromDate: '2026-07-20',
      toDate: '2026-07-23',
    });
    const duty = response.json() as DutyRecord;
    expect(duty.section27).toBe(false);
    expect(isSection27Purpose('CENSUS')).toBe(true);
    expect(isSection27Purpose('DISASTER_RELIEF')).toBe(true);
    expect(isSection27Purpose('SURVEY')).toBe(false);
    expect(isSection27Purpose('DATA_ENTRY')).toBe(false);
  });

  it('refuses more teaching days than the period contains', async () => {
    const response = await record(teacher, {
      fromDate: '2026-01-06',
      toDate: '2026-01-10',
      teachingDaysLost: 30,
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses a duty that ends before it starts', async () => {
    const response = await record(teacher, { fromDate: '2026-02-06', toDate: '2026-01-06' });
    expect(response.statusCode).toBe(400);
  });

  it('does not let a teacher confirm their own record', async () => {
    const created = await record(teacher);
    const { id } = created.json() as DutyRecord;
    const response = await app.inject({
      method: 'POST',
      url: `/v1/duties/${id}/attest`,
      headers: auth(teacher),
      payload: {},
    });
    expect(response.statusCode).toBe(403);
  });

  it('lets the head teacher confirm it, and records who did', async () => {
    const created = await record(teacher);
    const { id } = created.json() as DutyRecord;
    const response = await app.inject({
      method: 'POST',
      url: `/v1/duties/${id}/attest`,
      headers: auth(head),
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    const duty = response.json() as DutyRecord;
    expect(duty.attestedByName).toBe('राम प्रसाद');
    expect(duty.attestedAt).not.toBeNull();
  });

  it('shows a teacher their own days and not a colleague’s', async () => {
    await record(teacher);
    await record(colleague, { description: 'जनगणना गृह सूचीकरण', category: 'CENSUS' });

    const mine = await app.inject({ method: 'GET', url: '/v1/duties', headers: auth(teacher) });
    const rows = mine.json() as DutyRecord[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.teacherName).toBe('सुनीता देवी');
  });

  it('shows the head teacher how the load is spread inside their own school', async () => {
    await record(teacher);
    await record(colleague, { description: 'जनगणना गृह सूचीकरण', category: 'CENSUS' });

    const response = await app.inject({ method: 'GET', url: '/v1/duties', headers: auth(head) });
    const rows = response.json() as DutyRecord[];
    expect(rows).toHaveLength(2);
    // Districts exempted head teachers from Census 2027 duty, which pushed it
    // onto assistant teachers. This is the view that makes that visible, and
    // it is the one place in the product where a per-teacher figure is right.
    expect(rows.map((row) => row.teacherName).sort()).toEqual(['मोहन लाल', 'सुनीता देवी']);
  });

  it('never lets a name leave the school, for any officer, at any level', async () => {
    await record(teacher);
    await record(colleague, { category: 'CENSUS', description: 'जनगणना' });

    for (const officer of [blockOfficer, districtOfficer]) {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/duties',
        headers: auth(officer),
      });
      expect(response.statusCode).toBe(200);
      // Asserted against the raw body, not the parsed object: a field added to
      // the response type in six months must not be able to smuggle a name out.
      expect(response.body).not.toContain('सुनीता देवी');
      expect(response.body).not.toContain('मोहन लाल');
      expect(response.body).not.toContain('राम प्रसाद');
      for (const row of response.json() as DutyRecord[]) {
        expect(row.teacherName).toBeNull();
        expect(row.attestedByName).toBeNull();
      }
    }
  });

  it('never names anybody in a summary either, including the school’s own', async () => {
    await record(teacher);
    const response = await app.inject({
      method: 'GET',
      url: '/v1/duties/summary',
      headers: auth(head),
    });
    expect(response.body).not.toContain('सुनीता देवी');
  });

  it('separates the days the Act permits from the days it does not list', async () => {
    await record(teacher, { category: 'ELECTION', teachingDaysLost: 24 });
    await record(teacher, {
      category: 'CENSUS',
      description: 'जनगणना',
      fromDate: '2026-05-22',
      toDate: '2026-06-20',
      teachingDaysLost: 18,
    });
    await record(teacher, {
      category: 'DATA_ENTRY',
      description: 'DBT खाता विवरण',
      fromDate: '2026-04-01',
      toDate: '2026-04-06',
      teachingDaysLost: 4,
      duringSchoolHours: true,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/duties/summary',
      headers: auth(blockOfficer),
    });
    const summary = response.json() as DutySummary;
    expect(summary.teachingDaysLost).toBe(46);
    expect(summary.section27Days).toBe(42);
    expect(summary.otherDays).toBe(4);
    expect(summary.schools).toBe(1);
    expect(summary.byCategory[0]).toMatchObject({
      category: 'ELECTION',
      days: 24,
      section27: true,
    });
  });

  it('counts what the honorarium owes and never lets it go negative', async () => {
    await record(teacher, { honorariumDueRupees: 18000, honorariumReceivedRupees: 12000 });
    await record(teacher, {
      category: 'CENSUS',
      description: 'जनगणना',
      fromDate: '2026-05-22',
      toDate: '2026-06-20',
      teachingDaysLost: 18,
      honorariumDueRupees: 5000,
      honorariumReceivedRupees: 9000,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/duties/summary',
      headers: auth(head),
    });
    const summary = response.json() as DutySummary;
    expect(summary.honorarium.dueRupees).toBe(23000);
    expect(summary.honorarium.receivedRupees).toBe(21000);
    // An overpayment is not this platform's business, and a negative number
    // here would read as the teacher owing the department money.
    expect(summary.honorarium.outstandingRupees).toBe(2000);
  });

  it('counts the days that fell inside school hours, which is what courts turn on', async () => {
    await record(teacher, { duringSchoolHours: true, teachingDaysLost: 24 });
    await record(teacher, {
      category: 'TRAINING',
      description: 'निष्ठा प्रशिक्षण',
      fromDate: '2026-06-01',
      toDate: '2026-06-05',
      teachingDaysLost: 5,
      duringSchoolHours: false,
    });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/duties/summary',
      headers: auth(head),
    });
    const summary = response.json() as DutySummary;
    expect(summary.teachingDaysLost).toBe(29);
    expect(summary.duringSchoolHoursDays).toBe(24);
  });

  it('keeps one district’s ledger out of the next district’s reach', async () => {
    await record(teacher);
    const outsider = await createUser(app, { role: 'DISTRICT_ADMIN', districtId: geo.districtB });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/duties/summary',
      headers: auth(outsider),
    });
    const summary = response.json() as DutySummary;
    expect(summary.teachingDaysLost).toBe(0);
  });

  it('holds no column anywhere for the officer who issued the order', async () => {
    // A platform that names the deploying officer is an accusation engine, and
    // the district officer who would have to publish it is personally exposed.
    // The order reference is kept; the signature is not.
    const created = await record(teacher);
    const duty = created.json() as Record<string, unknown>;
    expect(duty.orderReference).toBe('SEC/SIR/2026/1184');
    expect(Object.keys(duty)).not.toContain('issuedBy');
    expect(Object.keys(duty)).not.toContain('deployingOfficer');
  });
});
