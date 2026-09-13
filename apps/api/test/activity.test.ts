import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  auth,
  createTestApp,
  createUser,
  prisma,
  resetDatabase,
  seedGeography,
  teardown,
  publishThroughGate,
  validActivityPayload,
  type Geography,
  type TestUser,
} from './helpers.js';

/**
 * The moderation workflow and the consent gate.
 *
 * The single most important behaviour in the platform is asserted here: a
 * photograph of a child does not reach the open web unless a guardian said yes,
 * a moderator with district authority said yes, and both are still true at the
 * moment of publication.
 */
describe('activity workflow', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
  let principal: TestUser;
  let districtAdmin: TestUser;
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
    districtAdmin = await createUser(app, {
      role: 'DISTRICT_ADMIN',
      districtId: geo.districtA,
    });
  });

  async function createDraft(overrides: Record<string, unknown> = {}): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/activities',
      headers: auth(teacher),
      payload: { ...validActivityPayload, ...overrides },
    });
    expect(response.statusCode).toBe(201);
    return (response.json() as { id: string }).id;
  }

  /** Attaches one photograph and returns its id on the activity. */
  async function attachPhoto(activityId: string): Promise<string> {
    const ticket = await app.inject({
      method: 'POST',
      url: '/v1/uploads',
      headers: auth(teacher),
      payload: { fileName: 'garden.jpg', contentType: 'image/jpeg', sizeBytes: 2048 },
    });
    const { key } = ticket.json() as { key: string };
    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/activities/${activityId}`,
      headers: auth(teacher),
      payload: { mediaKeys: [key] },
    });
    expect(updated.statusCode).toBe(200);
    const media = (updated.json() as { media: { id: string }[] }).media;
    return media[0]!.id;
  }

  describe('lifecycle', () => {
    it('creates a draft that is not visible beyond the school', async () => {
      const id = await createDraft();
      const activity = await prisma().activity.findUniqueOrThrow({ where: { id } });
      expect(activity.status).toBe('DRAFT');
      expect(activity.visibility).toBe('SCHOOL');
      expect(activity.publishedAt).toBeNull();
    });

    it('refuses to publish something that was never submitted', async () => {
      const id = await createDraft();
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: { decision: 'PUBLISH', visibility: 'BLOCK' },
      });
      expect(response.statusCode).toBe(409);
    });

    it('runs draft to published through review', async () => {
      const id = await createDraft();

      const submitted = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });
      expect(submitted.statusCode).toBe(200);
      expect((submitted.json() as { status: string }).status).toBe('PENDING_REVIEW');

      const published = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: {
          decision: 'PUBLISH',
          visibility: 'BLOCK',
          attestation: { confirmed: true },
        },
      });
      expect(published.statusCode).toBe(200);
      const body = published.json() as {
        status: string;
        visibility: string;
        clearance: string;
        reviewedByName: string;
      };
      expect(body.status).toBe('PUBLISHED');
      // Attested but not yet cleared, so it is live only inside the school.
      expect(body.clearance).toBe('AWAITING_BLOCK');
      expect(body.visibility).toBe('SCHOOL');

      const cleared = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/clearance`,
        headers: auth(blockOfficer),
        payload: { decision: 'CLEAR' },
      });
      expect(cleared.statusCode).toBe(200);
      expect((cleared.json() as { visibility: string }).visibility).toBe('BLOCK');
      // The reviewer is recorded by name: a publication has to be attributable.
      expect(body.reviewedByName).toBe('PRINCIPAL user');
      const stored = await prisma().activity.findUniqueOrThrow({ where: { id } });
      expect(stored.reviewedById).toBe(principal.id);
      expect(stored.publishedAt).not.toBeNull();
    });

    it('does not let the author approve their own work', async () => {
      const id = await createDraft();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });
      // Promote the author so that the only remaining objection is self-review.
      await prisma().user.update({ where: { id: teacher.id }, data: { role: 'PRINCIPAL' } });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(teacher),
        payload: { decision: 'PUBLISH', visibility: 'SCHOOL' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('requires a reason when rejecting', async () => {
      const id = await createDraft();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });

      const withoutReason = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: { decision: 'REJECT' },
      });
      expect(withoutReason.statusCode).toBe(400);

      const withReason = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: { decision: 'REJECT', reason: 'Please add what the children learned.' },
      });
      expect(withReason.statusCode).toBe(200);
      expect((withReason.json() as { rejectionReason: string }).rejectionReason).toContain(
        'learned',
      );
    });

    it('lets a rejected activity be corrected and resubmitted', async () => {
      const id = await createDraft();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: { decision: 'REJECT', reason: 'Needs a photograph.' },
      });

      const resubmitted = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });
      expect(resubmitted.statusCode).toBe(200);
      expect((resubmitted.json() as { rejectionReason: string | null }).rejectionReason).toBeNull();
    });

    it('does not let a teacher edit an activity once it is published', async () => {
      const id = await createDraft();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'SCHOOL' },
      });
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: { decision: 'PUBLISH', visibility: 'SCHOOL' },
      });

      const edit = await app.inject({
        method: 'PATCH',
        url: `/v1/activities/${id}`,
        headers: auth(teacher),
        payload: { title: 'Quietly rewritten after the fact' },
      });
      expect(edit.statusCode).toBe(403);
    });
  });

  describe('visibility ceilings', () => {
    it('does not let a head teacher publish to the open web', async () => {
      const id = await createDraft();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'PUBLIC' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: {
          decision: 'PUBLISH',
          visibility: 'PUBLIC',
          attestation: { confirmed: true },
        },
      });
      expect(response.statusCode).toBe(409);
      expect((response.json() as { error: { message: string } }).error.message).toContain(
        'cannot approve content at that visibility',
      );
    });

    it('does not let a moderator go wider than the teacher asked for', async () => {
      const id = await createDraft();
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'SCHOOL' },
      });

      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(districtAdmin),
        payload: {
          decision: 'PUBLISH',
          visibility: 'DISTRICT',
          attestation: { confirmed: true },
        },
      });
      expect(response.statusCode).toBe(409);
    });
  });

  describe('the photograph check', () => {
    /**
     * What replaced the consent gate. There is no guardian consent to be
     * missing, because there is no child record and no photograph of a child:
     * the only question left about an image is whether a child can be
     * recognised in it. See docs/data-protection.md.
     */
    it('will not let an unchecked photograph leave the school', async () => {
      const id = await createDraft();
      await attachPhoto(id);
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });

      const refused = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: {
          decision: 'PUBLISH',
          visibility: 'BLOCK',
          attestation: { confirmed: true },
        },
      });
      expect(refused.statusCode).toBe(409);
    });

    it('lets it through once somebody has confirmed no child is identifiable', async () => {
      const id = await createDraft();
      const mediaId = await attachPhoto(id);
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/submit`,
        headers: auth(teacher),
        payload: { requestedVisibility: 'BLOCK' },
      });
      await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/media/${mediaId}/consent`,
        headers: auth(principal),
        payload: { verified: true },
      });

      const published = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/moderate`,
        headers: auth(principal),
        payload: {
          decision: 'PUBLISH',
          visibility: 'BLOCK',
          attestation: { confirmed: true },
        },
      });
      expect(published.statusCode).toBe(200);
    });
  });

  describe('appreciation', () => {
    it('cannot be given twice by the same officer', async () => {
      const id = await createDraft();
      await publishThroughGate(app, {
        activityId: id,
        author: teacher,
        head: principal,
        blockOfficer,
        visibility: 'DISTRICT',
      });

      const first = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/appreciate`,
        headers: auth(districtAdmin),
        payload: { message: 'Excellent work by the whole school.' },
      });
      expect(first.statusCode).toBe(200);
      expect((first.json() as { appreciationCount: number }).appreciationCount).toBe(1);

      const second = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/appreciate`,
        headers: auth(districtAdmin),
        payload: {},
      });
      expect(second.statusCode).toBe(409);
    });

    it('cannot be given by a teacher', async () => {
      const id = await createDraft();
      const response = await app.inject({
        method: 'POST',
        url: `/v1/activities/${id}/appreciate`,
        headers: auth(teacher),
        payload: {},
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('validation', () => {
    it('refuses an activity dated in the future', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: {
          ...validActivityPayload,
          occurredOn: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
        },
      });
      expect(response.statusCode).toBe(400);
      expect(
        (response.json() as { error: { fields: Record<string, string[]> } }).error.fields,
      ).toHaveProperty('occurredOn');
    });

    it('strips control characters and bidirectional overrides from free text', async () => {
      // Built from char codes rather than written out: a formatter will
      // rewrite a unicode escape in a source file into the actual character,
      // and a NUL byte makes the whole file binary to every tool that reads it.
      const RLO = String.fromCharCode(0x202e);
      const NUL = String.fromCharCode(0x00);
      const hostileTitle = `Science fair${RLO} reversed${NUL} text here`;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/activities',
        headers: auth(teacher),
        payload: {
          ...validActivityPayload,
          title: hostileTitle,
        },
      });
      expect(response.statusCode).toBe(201);
      const stored = (response.json() as { title: string }).title;
      expect(stored).not.toContain(RLO);
      expect(stored).not.toContain(NUL);
    });
  });
});
