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
  validActivityPayload,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * Getting on the platform, and earning the right to leave the school.
 *
 * The rule under test throughout is the one a head teacher and a teacher in a
 * three-teacher school cannot satisfy between themselves: work does not become
 * visible outside its own school on the say-so of two colleagues who share an
 * incentive. See docs/integrity.md.
 */
describe('school onboarding and the escalation gate', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
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
      fullName: 'Ram Prasad',
    });
    head = await createUser(app, {
      role: 'PRINCIPAL',
      schoolId: geo.schoolA1,
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'Sunita Devi',
    });
    blockOfficer = await createUser(app, {
      role: 'BLOCK_ADMIN',
      blockId: geo.blockA1,
      districtId: geo.districtA,
      fullName: 'Block Officer',
    });
    districtOfficer = await createUser(app, {
      role: 'DISTRICT_ADMIN',
      districtId: geo.districtA,
      fullName: 'District Officer',
    });
  });

  // -------------------------------------------------------------------------
  // Getting on the platform
  // -------------------------------------------------------------------------

  describe('claiming a school', () => {
    async function raiseClaim(overrides: Record<string, unknown> = {}) {
      const phone = (overrides.phone as string) ?? '+919812300011';
      const otp = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone, purpose: 'REGISTRATION' },
      });
      const { devCode } = otp.json() as { devCode: string };
      return app.inject({
        method: 'POST',
        url: '/v1/school-claims',
        payload: {
          phone,
          code: devCode,
          udiseCode: '10000000055',
          blockId: geo.blockA1,
          proposedNameHi: 'प्राथमिक विद्यालय नयागाँव',
          claimantName: 'Kamla Devi',
          claimantDesignation: 'Head Teacher',
          ...overrides,
        },
      });
    }

    it('raises a claim that creates nothing until an officer acts', async () => {
      const response = await raiseClaim();
      expect(response.statusCode).toBe(201);
      expect((response.json() as { status: string }).status).toBe('PENDING');

      // No school, and no account: a claim on its own grants nothing at all.
      expect(await prisma().school.findUnique({ where: { udiseCode: '10000000055' } })).toBeNull();
      expect(await prisma().user.findUnique({ where: { phone: '+919812300011' } })).toBeNull();
    });

    it('tells a second claimant the school is taken, without naming them fully', async () => {
      await raiseClaim();
      const second = await raiseClaim({ phone: '+919812300012', claimantName: 'Someone Else' });

      expect(second.statusCode).toBe(200);
      const body = second.json() as { status: string; existingClaimantHint: string };
      expect(body.status).toBe('ALREADY_CLAIMED');
      // Enough to sort out an honest collision inside the school...
      expect(body.existingClaimantHint).toContain('Kamla');
      // ...and not a directory of who works where.
      expect(body.existingClaimantHint).not.toContain('Devi');
      expect(second.body).not.toContain('+9198123');
    });

    it('creates the school and appoints the head teacher when the block verifies it', async () => {
      await raiseClaim();
      const list = await app.inject({
        method: 'GET',
        url: '/v1/school-claims',
        headers: auth(blockOfficer),
      });
      expect(list.statusCode).toBe(200);
      const claim = (list.json() as { items: Array<{ id: string; matchesRegister: boolean }> })
        .items[0]!;
      expect(claim.matchesRegister).toBe(false);

      const decided = await app.inject({
        method: 'POST',
        url: `/v1/school-claims/${claim.id}/decide`,
        headers: auth(blockOfficer),
        payload: { decision: 'VERIFY' },
      });
      expect(decided.statusCode).toBe(200);

      const school = await prisma().school.findUniqueOrThrow({
        where: { udiseCode: '10000000055' },
      });
      expect(school.status).toBe('ACTIVE');
      expect(school.blockId).toBe(geo.blockA1);
      // A brand-new school gets full oversight until it has a record.
      expect(school.trustTier).toBe('NEW');

      const appointed = await prisma().user.findUniqueOrThrow({
        where: { phone: '+919812300011' },
      });
      expect(appointed.role).toBe('PRINCIPAL');
      expect(appointed.status).toBe('ACTIVE');
      expect(appointed.schoolId).toBe(school.id);
    });

    it('frees the code again when a claim is rejected, and demands a reason', async () => {
      await raiseClaim();
      const list = await app.inject({
        method: 'GET',
        url: '/v1/school-claims',
        headers: auth(blockOfficer),
      });
      const claimId = (list.json() as { items: Array<{ id: string }> }).items[0]!.id;

      const noReason = await app.inject({
        method: 'POST',
        url: `/v1/school-claims/${claimId}/decide`,
        headers: auth(blockOfficer),
        payload: { decision: 'REJECT' },
      });
      expect(noReason.statusCode).toBe(400);

      const rejected = await app.inject({
        method: 'POST',
        url: `/v1/school-claims/${claimId}/decide`,
        headers: auth(blockOfficer),
        payload: { decision: 'REJECT', note: 'No such school in this block.' },
      });
      expect(rejected.statusCode).toBe(200);

      // The partial unique index only covers PENDING, so the code is claimable again.
      const again = await raiseClaim({ phone: '+919812300013' });
      expect(again.statusCode).toBe(201);
    });

    it('does not let a block officer decide a claim from another block', async () => {
      await raiseClaim();
      const otherBlockOfficer = await createUser(app, {
        role: 'BLOCK_ADMIN',
        blockId: geo.blockA2,
        districtId: geo.districtA,
      });
      const list = await app.inject({
        method: 'GET',
        url: '/v1/school-claims',
        headers: auth(blockOfficer),
      });
      const claimId = (list.json() as { items: Array<{ id: string }> }).items[0]!.id;

      const response = await app.inject({
        method: 'POST',
        url: `/v1/school-claims/${claimId}/decide`,
        headers: auth(otherBlockOfficer),
        payload: { decision: 'VERIFY' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('sends a teacher at an already-live school to registration instead', async () => {
      const response = await raiseClaim({ udiseCode: '10000000001' });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { message: string } }).error.message).toContain(
        'register as a teacher',
      );
    });

    it('holds nothing at a school the block has not confirmed', async () => {
      const pendingSchool = await prisma().school.create({
        data: {
          udiseCode: '10000000077',
          nameHi: 'अपुष्ट विद्यालय',
          blockId: geo.blockA1,
          districtId: geo.districtA,
          status: 'PENDING_VERIFICATION',
        },
      });
      const staff = await createUser(app, {
        role: 'TEACHER',
        schoolId: pendingSchool.id,
        blockId: geo.blockA1,
        districtId: geo.districtA,
      });

      const student = await app.inject({
        method: 'POST',
        url: '/v1/students',
        headers: auth(staff),
        payload: {
          fullName: 'Test Child',
          classLevel: '3',
          gender: 'MALE',
          guardianName: 'Someone',
        },
      });
      expect(student.statusCode).toBe(409);

      const activity = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(staff),
        payload: validActivityPayload,
      });
      expect(activity.statusCode).toBe(409);
    });
  });

  // -------------------------------------------------------------------------
  // Leaving the school
  // -------------------------------------------------------------------------

  describe('the gate out of the school', () => {
    async function submitted(overrides: Record<string, unknown> = {}, requested = 'BLOCK') {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: { ...validActivityPayload, ...overrides },
      });
      expect(created.statusCode).toBe(201);
      const id = (created.json() as { id: string }).id;
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: requested },
      });
      return id;
    }

    it('publishes inside the school with no gate at all', async () => {
      const id = await submitted({}, 'SCHOOL');
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'SCHOOL' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { visibility: string; clearance: string };
      expect(body.visibility).toBe('SCHOOL');
      expect(body.clearance).toBe('NOT_REQUIRED');
    });

    it('refuses to send work beyond the school without the head teacher attesting', async () => {
      const id = await submitted();
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK' },
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { message: string } }).error.message).toContain(
        'confirm the attestation',
      );
    });

    it('records the attestation against the head teacher by name', async () => {
      const id = await submitted();
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: {
          decision: 'PUBLISH',
          visibility: 'BLOCK',
          attestation: { confirmed: true, note: 'I was present at the reading session.' },
        },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { attestedByName: string; attestationNote: string };
      expect(body.attestedByName).toBe('Sunita Devi');
      expect(body.attestationNote).toContain('present');

      const stored = await prisma().activity.findUniqueOrThrow({ where: { id } });
      expect(stored.attestedById).toBe(head.id);
      expect(stored.attestedAt).not.toBeNull();
    });

    it('does not let the author attest their own work, even as head teacher', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(head),
        payload: validActivityPayload,
      });
      const id = (created.json() as { id: string }).id;
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(head),
        payload: { requestedVisibility: 'BLOCK' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });
      expect(response.statusCode).toBe(403);
    });

    it('holds a new school’s work at school visibility until the block clears it', async () => {
      const id = await submitted();
      const attested = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });
      expect(attested.statusCode).toBe(200);

      const body = attested.json() as { visibility: string; clearance: string };
      // A NEW school is reviewed at 100%, so nothing auto-clears.
      expect(body.clearance).toBe('AWAITING_BLOCK');
      // And crucially: it is not yet visible at block level.
      expect(body.visibility).toBe('SCHOOL');
    });

    it('raises visibility only when the block officer actually clears it', async () => {
      const id = await submitted();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });

      const queue = await app.inject({
        method: 'GET',
        url: '/v1/clearance-queue',
        headers: auth(blockOfficer),
      });
      expect(queue.statusCode).toBe(200);
      const items = (queue.json() as { items: Array<{ activityId: string; reason: string }> })
        .items;
      expect(items.map((item) => item.activityId)).toContain(id);

      const cleared = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/clearance`,
        headers: auth(blockOfficer),
        payload: { decision: 'CLEAR' },
      });
      expect(cleared.statusCode).toBe(200);
      expect((cleared.json() as { visibility: string }).visibility).toBe('BLOCK');

      const stored = await prisma().activity.findUniqueOrThrow({ where: { id } });
      expect(stored.visibility).toBe('BLOCK');
      expect(stored.clearedById).toBe(blockOfficer.id);
    });

    it('sends work back with a reason, and puts the school on watch', async () => {
      const id = await submitted();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });

      const noNote = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/clearance`,
        headers: auth(blockOfficer),
        payload: { decision: 'RETURN' },
      });
      expect(noNote.statusCode).toBe(400);

      const returned = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/clearance`,
        headers: auth(blockOfficer),
        payload: { decision: 'RETURN', note: 'The photograph does not match the description.' },
      });
      expect(returned.statusCode).toBe(200);
      expect((returned.json() as { trustTier: string }).trustTier).toBe('WATCH');

      const school = await prisma().school.findUniqueOrThrow({ where: { id: geo.schoolA1 } });
      expect(school.trustTier).toBe('WATCH');
      expect(school.returnedCount).toBe(1);

      const stored = await prisma().activity.findUniqueOrThrow({ where: { id } });
      expect(stored.visibility).toBe('SCHOOL');
      expect(stored.status).toBe('REJECTED');
    });

    it('does not let the attesting head teacher also clear it', async () => {
      const id = await submitted();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });

      // A head teacher holds no clearance permission at all — the whole chain
      // must not sit inside one school.
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/clearance`,
        headers: auth(head),
        payload: { decision: 'CLEAR' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('does not let a block officer clear an activity they attested themselves', async () => {
      const id = await submitted();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(blockOfficer),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/clearance`,
        headers: auth(blockOfficer),
        payload: { decision: 'CLEAR' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('keeps the block queue inside the officer’s own block', async () => {
      const id = await submitted();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });

      const otherBlockOfficer = await createUser(app, {
        role: 'BLOCK_ADMIN',
        blockId: geo.blockA2,
        districtId: geo.districtA,
      });
      const queue = await app.inject({
        method: 'GET',
        url: '/v1/clearance-queue',
        headers: auth(otherBlockOfficer),
      });
      expect((queue.json() as { items: unknown[] }).items).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // The open web
  // -------------------------------------------------------------------------

  describe('the open web', () => {
    it('refuses a public publish that no block officer has cleared', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: validActivityPayload,
      });
      const id = (created.json() as { id: string }).id;
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'PUBLIC' },
      });

      // A district officer has the authority for PUBLIC, but the activity has
      // not been through the block, so it cannot skip that step.
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(districtOfficer),
        payload: { decision: 'PUBLISH', visibility: 'PUBLIC', attestation: { confirmed: true } },
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { message: string } }).error.message).toContain(
        'block officer',
      );
    });

    it('allows it once the block has cleared it and consent is on file', async () => {
      const studentId = await createStudent(geo.schoolA1);
      await app.inject({
        method: 'POST',
        url: `/v1/students/${studentId}/consent`,
        headers: auth(teacher),
        payload: { status: 'GRANTED', method: 'PAPER_FORM', guardianName: 'Ram Kumar' },
      });

      const created = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: { ...validActivityPayload, studentIds: [studentId] },
      });
      const id = (created.json() as { id: string }).id;
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'PUBLIC' },
      });
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

      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(districtOfficer),
        payload: { decision: 'PUBLISH', visibility: 'PUBLIC' },
      });
      expect(response.statusCode).toBe(200);
      expect((response.json() as { visibility: string }).visibility).toBe('PUBLIC');
    });
  });

  // -------------------------------------------------------------------------
  // Risk
  // -------------------------------------------------------------------------

  describe('risk assessment', () => {
    async function escalate(overrides: Record<string, unknown>) {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: { ...validActivityPayload, ...overrides },
      });
      expect(created.statusCode).toBe(201);
      const id = (created.json() as { id: string }).id;
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(head),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
      });
      return prisma().activity.findUniqueOrThrow({ where: { id } });
    }

    it('flags a first submission and a missing photograph', async () => {
      const activity = await escalate({});
      expect(activity.riskFlags).toContain('FIRST_SUBMISSION');
      expect(activity.riskFlags).toContain('NO_EVIDENCE');
      expect(activity.riskScore).toBeGreaterThan(0);
    });

    it('flags more participants than the school has children', async () => {
      await createStudent(geo.schoolA1, { rollNumber: '1' });
      await createStudent(geo.schoolA1, { rollNumber: '2', fullName: 'Second Child' });
      const activity = await escalate({ participantCount: 400 });
      expect(activity.riskFlags).toContain('COUNT_EXCEEDS_ROSTER');
    });

    it('flags a Sunday', async () => {
      // 2026-09-06 is a Sunday.
      const activity = await escalate({ occurredOn: '2026-09-06' });
      expect(activity.riskFlags).toContain('NON_WORKING_DAY');
    });

    it('flags a description recycled from another activity at the same school', async () => {
      await escalate({ title: 'First write up of the reading corner' });
      const second = await escalate({ title: 'Second write up of the reading corner' });
      expect(second.riskFlags).toContain('TEXT_REUSED');
    });

    it('flags a photograph already used by another school', async () => {
      const hash = 'f0e1d2c3b4a59687';

      // Another school's photograph, already attached to something.
      const otherTeacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA2,
        blockId: geo.blockA2,
        districtId: geo.districtA,
      });
      await prisma().mediaAsset.create({
        data: {
          storageKey: 'activity/other/2026/07/aaaaaaaa-1111-2222-3333-444444444444.jpg',
          kind: 'IMAGE',
          contentType: 'image/jpeg',
          sizeBytes: 1000,
          uploadedById: otherTeacher.id,
          schoolId: geo.schoolA2,
          perceptualHash: hash,
          attachedAt: new Date(),
        },
      });

      // The same image, near enough, arriving at this school.
      const ticket = await app.inject({
        method: 'POST',
        url: '/v1/uploads',
        headers: auth(teacher),
        payload: {
          fileName: 'classroom.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          // One bit different: re-compression, not a different photograph.
          perceptualHash: 'f0e1d2c3b4a59686',
        },
      });
      expect(ticket.statusCode).toBe(201);
      const key = (ticket.json() as { key: string }).key;

      const activity = await escalate({ mediaKeys: [key] });
      expect(activity.riskFlags).toContain('PHOTO_REUSED_OTHER_SCHOOL');
      // The strongest single signal available, so it should dominate the queue.
      expect(activity.riskScore).toBeGreaterThanOrEqual(50);
    });

    it('never auto-clears a flagged activity, whatever the school’s standing', async () => {
      // A school with a long clean record would normally be sampled at 10%.
      await prisma().school.update({
        where: { id: geo.schoolA1 },
        data: { trustTier: 'TRUSTED', clearedCount: 50 },
      });
      const activity = await escalate({ occurredOn: '2026-09-06' });
      expect(activity.riskFlags.length).toBeGreaterThan(0);
      expect(activity.clearance).toBe('AWAITING_BLOCK');
    });

    it('orders the block queue by risk rather than by arrival', async () => {
      await escalate({ title: 'A quiet ordinary activity in the classroom' });
      await escalate({
        title: 'An activity with far too many children counted',
        participantCount: 900,
      });

      const queue = await app.inject({
        method: 'GET',
        url: '/v1/clearance-queue',
        headers: auth(blockOfficer),
      });
      const items = (queue.json() as { items: Array<{ title: string; riskScore: number }> }).items;
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0]!.riskScore).toBeGreaterThanOrEqual(items[1]!.riskScore);
      expect(items[0]!.title).toContain('too many children');
    });

    it('explains to the officer why each item is in the queue', async () => {
      // The roster check only fires when there is a roster to check against:
      // a school that has not entered its children yet is not evidence of
      // anything, and flagging every such school would flood the queue.
      await createStudent(geo.schoolA1, { rollNumber: '1' });
      await escalate({ participantCount: 900 });
      const queue = await app.inject({
        method: 'GET',
        url: '/v1/clearance-queue',
        headers: auth(blockOfficer),
      });
      const item = (queue.json() as { items: Array<{ riskNotes: string[]; reason: string }> })
        .items[0]!;
      expect(item.reason).toBe('FLAGGED');
      expect(item.riskNotes.join(' ')).toMatch(/roster|children/i);
    });
  });

  // -------------------------------------------------------------------------
  // Trust
  // -------------------------------------------------------------------------

  describe('trust', () => {
    it('reports a school’s standing and how much of its work is reviewed', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/schools/${geo.schoolA1}/trust`,
        headers: auth(head),
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { tier: string; sampleRate: number };
      expect(body.tier).toBe('NEW');
      expect(body.sampleRate).toBe(1);
    });

    it('does not show one school its neighbour’s standing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/schools/${geo.schoolA2}/trust`,
        headers: auth(head),
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
