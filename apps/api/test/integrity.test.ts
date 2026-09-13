import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  setEnrolled,
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
import { expireStaleClaims } from '../src/modules/org/claim.service.js';
import { sweepOrphanedUploads } from '../src/modules/activity/media.service.js';

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

    it('lets a school be claimed again once an abandoned claim has expired', async () => {
      // The failure this prevents is permanent and silent. One claim nobody
      // follows up — a wrong number, a typo, someone who thought better of it —
      // and the school is locked out of the platform for good, because no
      // journey in the product can clear it and the next head teacher is shown
      // only the given name of a stranger.
      await raiseClaim();
      await prisma().schoolClaim.updateMany({
        where: { udiseCode: '10000000055' },
        data: { expiresAt: new Date(Date.now() - 86_400_000) },
      });

      const second = await raiseClaim({ phone: '+919812300013', claimantName: 'Radha Yadav' });
      expect(second.statusCode).toBe(201);
      expect((second.json() as { status: string }).status).toBe('PENDING');
    });

    it('still refuses a second claim while the first is live', async () => {
      // The other half of the same rule: expiry must not be a way round the
      // collision check for anyone willing to wait less than thirty days.
      await raiseClaim();
      await prisma().schoolClaim.updateMany({
        where: { udiseCode: '10000000055' },
        data: { expiresAt: new Date(Date.now() + 86_400_000) },
      });

      const second = await raiseClaim({ phone: '+919812300014', claimantName: 'Radha Yadav' });
      expect((second.json() as { status: string }).status).toBe('ALREADY_CLAIMED');
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

    it('allows it once the block has cleared it', async () => {
      await setEnrolled(geo.schoolA1);
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
      // Every photograph has to be confirmed free of an identifiable child
      // before the work can leave the school, so the helper does what a head
      // teacher would do rather than skipping the gate under test elsewhere.
      for (const media of await prisma().activityMedia.findMany({ where: { activityId: id } })) {
        await app.inject({
          method: 'POST',
          url: `/v1/activities/${id}/media/${media.id}/consent`,
          headers: auth(head),
          payload: { verified: true },
        });
      }
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
      await setEnrolled(geo.schoolA1);
      await setEnrolled(geo.schoolA1);
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

    it('finds a reused photograph however much has been uploaded since', async () => {
      /**
       * The regression this guards is the one that would never have been
       * noticed. The check used to read a capped page of rows and compare them
       * in the application — with no total order, so an arbitrary page. Past
       * the cap it examined a lottery, and at the scale this platform is for it
       * would have gone on reporting "no duplicates" while looking at a
       * rounding error of the table. An officer who trusts a control that has
       * quietly stopped working is worse off than one who never had it.
       *
       * Six thousand rows is past the old five-thousand cap and cheap to
       * insert; the reused photograph is buried at the far end of it.
       */
      const hash = 'a1b2c3d4e5f60718';
      const otherTeacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA2,
        blockId: geo.blockA2,
        districtId: geo.districtA,
      });

      await prisma().mediaAsset.create({
        data: {
          storageKey: 'activity/other/2026/07/needle.jpg',
          kind: 'IMAGE',
          contentType: 'image/jpeg',
          sizeBytes: 1000,
          uploadedById: otherTeacher.id,
          schoolId: geo.schoolA2,
          perceptualHash: hash,
          attachedAt: new Date(),
        },
      });

      // Unrelated photographs, all far outside matching distance of the needle.
      await prisma().mediaAsset.createMany({
        data: Array.from({ length: 6000 }, (_, index) => ({
          storageKey: `activity/other/2026/07/hay-${index}.jpg`,
          kind: 'IMAGE' as const,
          contentType: 'image/jpeg',
          sizeBytes: 1000,
          uploadedById: otherTeacher.id,
          schoolId: geo.schoolA2,
          // Walks the top 32 bits, leaving every one of these at least 20 bits
          // from the needle and from each other's neighbourhood.
          perceptualHash: (0x0f0f0f0f00000000n + BigInt(index)).toString(16).padStart(16, '0'),
          attachedAt: new Date(),
        })),
      });

      const ticket = await app.inject({
        method: 'POST',
        url: '/v1/uploads',
        headers: auth(teacher),
        payload: {
          fileName: 'classroom.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          perceptualHash: hash,
        },
      });
      const key = (ticket.json() as { key: string }).key;

      const activity = await escalate({ mediaKeys: [key] });
      expect(activity.riskFlags).toContain('PHOTO_REUSED_OTHER_SCHOOL');
    });

    it('reports the earliest reuse, not whichever row came back first', async () => {
      // The note tells the officer when the photograph was first used, so it
      // has to be the first one and not an arbitrary pick among many.
      const hash = 'c0ffee00c0ffee00';
      const otherTeacher = await createUser(app, {
        role: 'TEACHER',
        schoolId: geo.schoolA2,
        blockId: geo.blockA2,
        districtId: geo.districtA,
      });
      for (const [index, day] of ['2026-03-04', '2026-01-02', '2026-05-06'].entries()) {
        await prisma().mediaAsset.create({
          data: {
            storageKey: `activity/other/2026/copy-${index}.jpg`,
            kind: 'IMAGE',
            contentType: 'image/jpeg',
            sizeBytes: 1000,
            uploadedById: otherTeacher.id,
            schoolId: geo.schoolA2,
            perceptualHash: hash,
            attachedAt: new Date(`${day}T00:00:00Z`),
            createdAt: new Date(`${day}T00:00:00Z`),
          },
        });
      }

      const ticket = await app.inject({
        method: 'POST',
        url: '/v1/uploads',
        headers: auth(teacher),
        payload: {
          fileName: 'classroom.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 2048,
          perceptualHash: hash,
        },
      });
      const activity = await escalate({ mediaKeys: [(ticket.json() as { key: string }).key] });
      const note = activity.riskFlags.includes('PHOTO_REUSED_OTHER_SCHOOL');
      expect(note).toBe(true);

      const queue = await app.inject({
        method: 'GET',
        url: '/v1/clearance-queue',
        headers: auth(blockOfficer),
      });
      const item = (
        queue.json() as { items: { activityId: string; riskNotes: string[] }[] }
      ).items.find((row) => row.activityId === activity.id);
      expect(item?.riskNotes.join(' ')).toContain('2026-01-02');
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
      await setEnrolled(geo.schoolA1);
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

  // -------------------------------------------------------------------------
  // The line the platform does not cross
  // -------------------------------------------------------------------------

  describe('children', () => {
    /**
     * The guarantee everything else rests on, asserted against the database
     * rather than against any one endpoint. If a child's name can be persuaded
     * into this platform through any route, the reasoning in
     * docs/data-protection.md stops holding and the DPDP exposure comes back.
     */
    it('has nowhere to put a child', async () => {
      const columns = await prisma().$queryRaw<{ table_name: string; column_name: string }[]>`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            column_name ILIKE '%guardian%'
            OR column_name ILIKE '%student%'
            OR column_name ILIKE '%consent%'
            OR column_name = 'gender'
            OR column_name = 'birthYear'
            OR column_name = 'rollNumber'
          )
      `;
      expect(columns).toEqual([]);

      const tables = await prisma().$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('students', 'media_consents', 'activity_students')
      `;
      expect(tables).toEqual([]);
    });

    it('refuses the endpoints that used to hold one', async () => {
      for (const url of ['/v1/students', '/v1/students/anything/consent']) {
        const response = await app.inject({
          method: 'POST',
          url,
          headers: auth(head),
          payload: {},
        });
        expect(response.statusCode).toBe(404);
      }
    });

    it('records how many children there are without recording any of them', async () => {
      const saved = await app.inject({
        method: 'PUT',
        url: `/v1/schools/${geo.schoolA1}/enrolment`,
        headers: auth(head),
        payload: {
          classes: [
            { classLevel: '4', enrolled: 31 },
            { classLevel: '5', enrolled: 28 },
          ],
          asOn: '2026-09-01',
        },
      });
      expect(saved.statusCode).toBe(200);
      const body = saved.json() as { total: number; classes: unknown[] };
      expect(body.total).toBe(59);
      expect(body.classes).toHaveLength(2);
    });

    it('still catches a school claiming more participants than it teaches', async () => {
      // The one thing the roster was actually load-bearing for. It works the
      // same against counts, which is why the roster was not worth its risk.
      await app.inject({
        method: 'PUT',
        url: `/v1/schools/${geo.schoolA1}/enrolment`,
        headers: auth(head),
        payload: { classes: [{ classLevel: '5', enrolled: 12 }], asOn: '2026-09-01' },
      });
      const created = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: { ...validActivityPayload, participantCount: 400 },
      });
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

      const activity = await prisma().activity.findUniqueOrThrow({ where: { id } });
      expect(activity.riskFlags).toContain('COUNT_EXCEEDS_ROSTER');
      expect(activity.riskNotes.join(' ')).toContain('12 children');
    });
  });

  // -------------------------------------------------------------------------
  // Housekeeping
  // -------------------------------------------------------------------------

  describe('the maintenance sweep', () => {
    it('deletes a photograph that was uploaded and then abandoned', async () => {
      /**
       * The one job here that is a child-safety matter rather than tidiness.
       * Every form someone starts and does not finish leaves an image in the
       * bucket, attached to nothing and visible in no interface that would let
       * anyone notice it is there. Without the sweep, a photograph of a child
       * taken for an activity that was never submitted stays for the life of
       * the deployment.
       */
      const orphan = await prisma().mediaAsset.create({
        data: {
          storageKey: 'activity/abandoned/2026/01/orphan.jpg',
          kind: 'IMAGE',
          contentType: 'image/jpeg',
          sizeBytes: 1000,
          uploadedById: teacher.id,
          schoolId: geo.schoolA1,
          attachedAt: null,
          createdAt: new Date(Date.now() - 48 * 3_600_000),
        },
      });
      const recent = await prisma().mediaAsset.create({
        data: {
          storageKey: 'activity/inflight/2026/01/recent.jpg',
          kind: 'IMAGE',
          contentType: 'image/jpeg',
          sizeBytes: 1000,
          uploadedById: teacher.id,
          schoolId: geo.schoolA1,
          attachedAt: null,
        },
      });

      const result = await sweepOrphanedUploads(prisma());
      expect(result.deleted).toBeGreaterThanOrEqual(1);

      expect(await prisma().mediaAsset.findUnique({ where: { id: orphan.id } })).toBeNull();
      // Someone may still be filling in the form this belongs to.
      expect(await prisma().mediaAsset.findUnique({ where: { id: recent.id } })).not.toBeNull();
    });

    it('leaves an attached photograph alone however old it is', async () => {
      const attached = await prisma().mediaAsset.create({
        data: {
          storageKey: 'activity/kept/2020/01/attached.jpg',
          kind: 'IMAGE',
          contentType: 'image/jpeg',
          sizeBytes: 1000,
          uploadedById: teacher.id,
          schoolId: geo.schoolA1,
          attachedAt: new Date('2020-01-01T00:00:00Z'),
          createdAt: new Date('2020-01-01T00:00:00Z'),
        },
      });
      await sweepOrphanedUploads(prisma());
      expect(await prisma().mediaAsset.findUnique({ where: { id: attached.id } })).not.toBeNull();
    });

    it('takes an unanswered claim out of the officer’s queue', async () => {
      const otp = await app.inject({
        method: 'POST',
        url: '/v1/auth/otp/request',
        payload: { phone: '+919812300077', purpose: 'REGISTRATION' },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/school-claims',
        payload: {
          phone: '+919812300077',
          code: (otp.json() as { devCode: string }).devCode,
          udiseCode: '10000000099',
          blockId: geo.blockA1,
          proposedNameHi: 'प्राथमिक विद्यालय पुराना',
          claimantName: 'Forgotten Claimant',
        },
      });
      await prisma().schoolClaim.updateMany({
        where: { udiseCode: '10000000099' },
        data: { expiresAt: new Date(Date.now() - 86_400_000) },
      });

      expect((await expireStaleClaims(prisma())).expired).toBe(1);

      const queue = await app.inject({
        method: 'GET',
        url: '/v1/school-claims?status=PENDING',
        headers: auth(blockOfficer),
      });
      const items = (queue.json() as { items: { udiseCode: string }[] }).items;
      expect(items.map((item) => item.udiseCode)).not.toContain('10000000099');
    });

    it('is safe to run twice', async () => {
      // It runs on a clock, and a clock fires while the last run is still
      // going often enough to matter.
      await expireStaleClaims(prisma());
      await sweepOrphanedUploads(prisma());
      await expect(expireStaleClaims(prisma())).resolves.toEqual({ expired: 0 });
      await expect(sweepOrphanedUploads(prisma())).resolves.toEqual({ deleted: 0 });
    });
  });
});
