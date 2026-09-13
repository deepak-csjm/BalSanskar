import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AuthenticityResult, Directive, DirectiveUptake } from '@balsanskar/shared';
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
import { normaliseLetterNumber } from '../src/modules/directive/directive.service.js';

/**
 * The register of orders.
 *
 * Two things are being protected. A school must be able to find out whether the
 * letter circulating in its WhatsApp group is real — forged closure orders and
 * leave sanctions bearing officers' signatures are documented. And an
 * instruction must reach a school carrying the rank it actually has: the
 * Bareilly fodder case, in which a Block Education Officer ordered every school
 * to supply 46 kg of straw under threat of departmental action and the Basic
 * Shiksha Adhikari later confirmed no government order existed, is the failure
 * this register is shaped around.
 */
describe('the register of orders', () => {
  let app: FastifyInstance;
  let geo: Geography;
  let teacher: TestUser;
  let head: TestUser;
  let blockOfficer: TestUser;
  let districtOfficer: TestUser;
  let stateOfficer: TestUser;

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
    districtOfficer = await createUser(app, { role: 'DISTRICT_ADMIN', districtId: geo.districtA });
    stateOfficer = await createUser(app, { role: 'STATE_ADMIN' });
  });

  const STATE_ORDER = {
    source: 'STATE_ORDER' as const,
    letterNumber: 'पत्रांक-गुण0वि0/कैलेण्डर/10099/2025-26',
    issuedOn: '2026-03-30',
    issuingOffice: 'महानिदेशक स्कूल शिक्षा, उत्तर प्रदेश',
    title: 'शैक्षिक कैलेण्डर 2026-27',
    plainSummary:
      'हर विद्यालय अपने सूचना पट पर नया शैक्षिक कैलेण्डर लगाए और अभिभावक बैठक की तिथियाँ उसी के अनुसार तय करे।',
  };

  async function publish(as: TestUser, payload: Record<string, unknown> = {}) {
    return app.inject({
      method: 'POST',
      url: '/v1/directives',
      headers: auth(as),
      payload: { ...STATE_ORDER, ...payload },
    });
  }

  describe('who may claim what authority', () => {
    it('lets the state office register a state order', async () => {
      const response = await publish(stateOfficer);
      expect(response.statusCode).toBe(201);
      expect((response.json() as Directive).source).toBe('STATE_ORDER');
    });

    it('does not let a block officer dress their instruction as a state order', async () => {
      // The Bareilly fodder case, made structural. The problem was never that a
      // block officer issued an instruction — they are entitled to. It was that
      // it reached schools wearing the authority of a government order.
      const response = await publish(blockOfficer);
      expect(response.statusCode).toBe(403);
    });

    it('does not let a block officer issue a district order either', async () => {
      const response = await publish(blockOfficer, { source: 'DISTRICT_ORDER' });
      expect(response.statusCode).toBe(403);
    });

    it('lets a block officer register a block instruction, labelled as one', async () => {
      const response = await publish(blockOfficer, {
        source: 'BLOCK_INSTRUCTION',
        letterNumber: 'खं0शि0अ0/2026/48',
        issuingOffice: 'खंड शिक्षा अधिकारी',
        title: 'विद्यालय परिसर की सफ़ाई',
        plainSummary: 'माह के अंतिम शनिवार को विद्यालय परिसर की विशेष सफ़ाई करवाई जाए।',
      });
      expect(response.statusCode).toBe(201);
      expect((response.json() as Directive).source).toBe('BLOCK_INSTRUCTION');
    });

    it('gives a head teacher no way to put anything on the register', async () => {
      const response = await publish(head, { source: 'BLOCK_INSTRUCTION' });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('is this letter real', () => {
    it('matches a number typed off a photocopy, not only one pasted exactly', async () => {
      await publish(stateOfficer, { letterNumber: 'गुण0वि0/कैलेण्डर/10099/2025-26' });

      // Spacing, case and the dashes an OCR round trip mangles all fold away.
      for (const typed of [
        'गुण0वि0/कैलेण्डर/10099/2025-26',
        'गुण0वि0 / कैलेण्डर / 10099 / 2025-26',
        'गुण0वि0-कैलेण्डर-10099-2025—26',
      ]) {
        const response = await app.inject({
          method: 'GET',
          url: `/v1/directives/check?letterNumber=${encodeURIComponent(typed)}`,
          headers: auth(teacher),
        });
        const result = response.json() as AuthenticityResult;
        expect(result.found, `did not match: ${typed}`).toBe(true);
      }
    });

    it('reports a miss as a miss and never as a forgery', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/directives/check?letterNumber=BSA%2F2026%2F991',
        headers: auth(teacher),
      });
      const result = response.json() as AuthenticityResult;
      expect(result.found).toBe(false);
      expect(result.matches).toEqual([]);
      // The register holds a subset of what exists. Telling a head teacher a
      // genuine order was false would do more harm in an afternoon than this
      // feature saves in a year, so the payload carries no verdict at all —
      // only whether the register knows the number. The wording a person reads
      // lives in the client, where it can say so in Hindi.
      expect(Object.keys(result).sort()).toEqual(['found', 'letterNumber', 'matches']);
      expect(response.body).not.toMatch(/forg|fraud|invalid|फ़र्ज़ी/i);
    });

    it('lets a teacher check, not only the head teacher', async () => {
      await publish(stateOfficer);
      const response = await app.inject({
        method: 'GET',
        url: `/v1/directives/check?letterNumber=${encodeURIComponent(STATE_ORDER.letterNumber)}`,
        headers: auth(teacher),
      });
      expect(response.statusCode).toBe(200);
    });

    it('normalises consistently', () => {
      expect(normaliseLetterNumber('BSA / 2026 / 118')).toBe('bsa-2026-118');
      expect(normaliseLetterNumber('  bsa--2026__118  ')).toBe('bsa-2026-118');
    });
  });

  describe('exactly one order in force', () => {
    it('marks the earlier order superseded and hides it by default', async () => {
      const first = await publish(stateOfficer);
      const firstId = (first.json() as Directive).id;

      const second = await publish(stateOfficer, {
        letterNumber: 'गुण0वि0/कैलेण्डर/11200/2026-27',
        issuedOn: '2026-06-01',
        supersedesId: firstId,
      });
      expect(second.statusCode).toBe(201);

      const listed = await app.inject({
        method: 'GET',
        url: '/v1/directives',
        headers: auth(head),
      });
      const rows = listed.json() as Directive[];
      expect(rows).toHaveLength(1);
      expect(rows[0]?.letterNumber).toContain('11200');

      const all = await app.inject({
        method: 'GET',
        url: '/v1/directives?includeInactive=true',
        headers: auth(head),
      });
      const everything = all.json() as Directive[];
      expect(everything).toHaveLength(2);
      const superseded = everything.find((row) => row.id === firstId);
      expect(superseded?.status).toBe('SUPERSEDED');
      expect(superseded?.supersededById).not.toBeNull();
    });

    it('refuses to let two orders replace the same one', async () => {
      const first = await publish(stateOfficer);
      const firstId = (first.json() as Directive).id;
      await publish(stateOfficer, { letterNumber: 'A/2/3', supersedesId: firstId });
      const third = await publish(stateOfficer, { letterNumber: 'A/2/4', supersedesId: firstId });
      // Otherwise the chain forks and "which one governs me" has two answers,
      // which is the state the register exists to end.
      expect(third.statusCode).toBe(409);
    });
  });

  describe('what a school can say back', () => {
    let directiveId: string;

    beforeEach(async () => {
      const created = await publish(stateOfficer);
      directiveId = (created.json() as Directive).id;
    });

    async function respond(as: TestUser, payload: Record<string, unknown>) {
      return app.inject({
        method: 'POST',
        url: `/v1/directives/${directiveId}/respond`,
        headers: auth(as),
        payload,
      });
    }

    it('accepts "we could not, and here is what is missing"', async () => {
      const response = await respond(head, {
        state: 'BLOCKED',
        blockedReason: 'FUNDS_NOT_RECEIVED',
        note: 'कंपोजिट ग्रांट इस सत्र में अभी तक नहीं आया।',
      });
      expect(response.statusCode).toBe(200);
      expect((response.json() as Directive).myResponse).toMatchObject({
        state: 'BLOCKED',
        blockedReason: 'FUNDS_NOT_RECEIVED',
      });
    });

    it('insists a blocked answer says what is missing', async () => {
      const response = await respond(head, { state: 'BLOCKED' });
      expect(response.statusCode).toBe(400);
    });

    it('refuses a reason attached to an answer that is not blocked', async () => {
      // Otherwise the field drifts into a general-purpose explanation box, and
      // an explanation box an officer reads is a confession field.
      const response = await respond(head, { state: 'DONE', blockedReason: 'STAFF_SHORTAGE' });
      expect(response.statusCode).toBe(400);
    });

    it('clears the reason when the answer stops being blocked', async () => {
      await respond(head, { state: 'BLOCKED', blockedReason: 'MATERIAL_NOT_RECEIVED' });
      const later = await respond(head, { state: 'DONE' });
      expect((later.json() as Directive).myResponse?.blockedReason).toBeNull();
    });

    it('lets an ordinary teacher answer, not only the head teacher', async () => {
      // Fourteen mandated registers and a dozen daily uploads already funnel
      // through the head teacher. This must not be the fifteenth.
      const response = await respond(teacher, { state: 'SEEN' });
      expect(response.statusCode).toBe(200);
    });

    it('records one answer per school, not one per person', async () => {
      await respond(teacher, { state: 'SEEN' });
      await respond(head, { state: 'DONE' });
      const listed = await app.inject({
        method: 'GET',
        url: '/v1/directives',
        headers: auth(teacher),
      });
      expect((listed.json() as Directive[])[0]?.myResponse?.state).toBe('DONE');
    });

    it('refuses an answer to an order that is no longer in force', async () => {
      await app.inject({
        method: 'POST',
        url: `/v1/directives/${directiveId}/withdraw`,
        headers: auth(stateOfficer),
        payload: {},
      });
      const response = await respond(head, { state: 'DONE' });
      expect(response.statusCode).toBe(409);
    });
  });

  describe('what the office learns', () => {
    it('leads with what is missing and never with who is behind', async () => {
      const created = await publish(stateOfficer);
      const directiveId = (created.json() as Directive).id;

      await app.inject({
        method: 'POST',
        url: `/v1/directives/${directiveId}/respond`,
        headers: auth(head),
        payload: { state: 'BLOCKED', blockedReason: 'FUNDS_NOT_RECEIVED' },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/v1/directives/${directiveId}/uptake`,
        headers: auth(blockOfficer),
      });
      const uptake = response.json() as DirectiveUptake;

      expect(uptake.blockedBy[0]).toEqual({ reason: 'FUNDS_NOT_RECEIVED', schools: 1 });
      expect(uptake.byState).toEqual([{ state: 'BLOCKED', schools: 1 }]);
      expect(uptake.responded).toBe(1);
      expect(uptake.schoolsInScope).toBeGreaterThan(0);

      // No per-school figure and no ranking anywhere in the payload. A
      // red/amber/green on which schools completed a drive renders undelivered
      // money as teacher failure.
      const body = JSON.stringify(uptake);
      expect(body).not.toMatch(/"compliance/i);
      expect(body).not.toMatch(/"schools":\s*\[/);
      expect(Object.keys(uptake)).not.toContain('bySchool');
    });
  });

  describe('reach', () => {
    it('does not show one block’s instruction to the next block', async () => {
      await publish(blockOfficer, {
        source: 'BLOCK_INSTRUCTION',
        letterNumber: 'खं0/2026/9',
        issuingOffice: 'खंड शिक्षा अधिकारी',
        title: 'ब्लॉक स्तरीय बैठक',
        plainSummary: 'प्रधानाध्यापक अगले मंगलवार खंड कार्यालय में उपस्थित हों।',
      });

      const outsider = await createUser(app, {
        role: 'PRINCIPAL',
        schoolId: geo.schoolA2,
        blockId: geo.blockA2,
        districtId: geo.districtA,
      });
      const listed = await app.inject({
        method: 'GET',
        url: '/v1/directives',
        headers: auth(outsider),
      });
      expect(listed.json() as Directive[]).toEqual([]);
    });

    it('shows a state order to every school', async () => {
      await publish(stateOfficer);
      for (const [schoolId, blockId] of [
        [geo.schoolA1, geo.blockA1],
        [geo.schoolB1, geo.blockB1],
      ] as const) {
        const user = await createUser(app, {
          role: 'PRINCIPAL',
          schoolId,
          blockId,
          districtId: schoolId === geo.schoolB1 ? geo.districtB : geo.districtA,
        });
        const listed = await app.inject({
          method: 'GET',
          url: '/v1/directives',
          headers: auth(user),
        });
        expect((listed.json() as Directive[]).length).toBe(1);
      }
    });

    it('narrows an order to the school types it is about', async () => {
      await publish(districtOfficer, {
        source: 'DISTRICT_ORDER',
        letterNumber: 'बीएसए/2026/77',
        issuingOffice: 'जिला बेसिक शिक्षा अधिकारी',
        title: 'उच्च प्राथमिक विद्यालयों हेतु विज्ञान प्रदर्शनी',
        plainSummary: 'उच्च प्राथमिक विद्यालय विज्ञान प्रदर्शनी हेतु दो प्रविष्टियाँ भेजें।',
        schoolTypes: ['UPPER_PRIMARY'],
      });
      // Every seeded school is PRIMARY, so nobody should see it.
      const listed = await app.inject({
        method: 'GET',
        url: '/v1/directives',
        headers: auth(head),
      });
      expect(listed.json() as Directive[]).toEqual([]);
    });
  });
});
