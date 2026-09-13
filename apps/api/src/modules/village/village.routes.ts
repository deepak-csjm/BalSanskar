import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createNeedSchema,
  idSchema,
  listNeedsQuerySchema,
  recordSmcMeetingSchema,
  recordSurveySchema,
  resolveNeedSchema,
  udiseSchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import {
  createNeed,
  getVillageSchoolPage,
  listNeeds,
  listSurveys,
  recordSmcMeeting,
  recordSurvey,
  resolveNeed,
} from './village.service.js';

const idParams = z.object({ id: idSchema });
const scopeQuery = z.object({
  schoolId: idSchema.optional(),
  blockId: idSchema.optional(),
  districtId: idSchema.optional(),
});

/**
 * The village's side of the school.
 *
 * One of these routes has no authentication at all, deliberately. A parent will
 * not create an account to look at their child's school, and requiring one is
 * the difference between a noticeboard the village reads and a noticeboard
 * nobody has ever opened. The page holds no personal data, shows only what a
 * block officer has already cleared, and exists only for schools the block
 * office has confirmed — so there is nothing on it to protect with a password.
 *
 * Everything that writes is school staff, because these are the school's own
 * records.
 */
export const villageRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  /**
   * The page behind the QR code on the school wall.
   *
   * Addressed by UDISE code rather than by an internal id, because the code is
   * already painted on the building and printed on every form the school files.
   * A villager who cannot scan can type eleven digits they can see from the
   * gate.
   */
  app.get(
    '/village/schools/:udiseCode',
    { config: { rateLimit: { max: 120, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const { udiseCode } = parseOrThrow(
        z.object({ udiseCode: udiseSchema }),
        request.params as Record<string, unknown>,
      );
      const page = await getVillageSchoolPage(prisma, udiseCode);
      return (
        reply
          // Cheap to serve and slightly stale is fine for a noticeboard; a village
          // reading it at assembly time should not cost the database anything.
          .header('cache-control', 'public, max-age=300')
          .send(page)
      );
    },
  );

  // -------------------------------------------------------------------------
  // What the school needs
  // -------------------------------------------------------------------------

  app.get('/needs', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const query = parseOrThrow(listNeedsQuerySchema, request.query);
    return reply.send(await listNeeds(prisma, actor, query));
  });

  app.post('/needs', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('village:write');
    const input = parseOrThrow(createNeedSchema, request.body);
    const created = await createNeed(prisma, actor, input, request.auditContext());
    return reply.status(201).send(created);
  });

  app.post('/needs/:id/resolve', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('village:write');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(resolveNeedSchema, request.body);
    return reply.send(await resolveNeed(prisma, actor, id, input, request.auditContext()));
  });

  // -------------------------------------------------------------------------
  // The School Management Committee
  // -------------------------------------------------------------------------

  app.post('/smc-meetings', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('village:write');
    const input = parseOrThrow(recordSmcMeetingSchema, request.body);
    const created = await recordSmcMeeting(prisma, actor, input, request.auditContext());
    return reply.status(201).send(created);
  });

  // -------------------------------------------------------------------------
  // Children who are not in school
  // -------------------------------------------------------------------------

  app.get('/surveys', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const query = parseOrThrow(scopeQuery, request.query);
    return reply.send(await listSurveys(prisma, actor, query));
  });

  app.post('/surveys', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('village:write');
    const input = parseOrThrow(recordSurveySchema, request.body);
    const created = await recordSurvey(prisma, actor, input, request.auditContext());
    return reply.status(201).send(created);
  });
};
