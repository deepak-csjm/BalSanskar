import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  ATTESTATION_TEXT,
  createActivitySchema,
  decideClearanceSchema,
  giveAppreciationSchema,
  idSchema,
  listActivitiesQuerySchema,
  listClearanceQuerySchema,
  moderateActivitySchema,
  requestUploadSchema,
  submitActivitySchema,
  updateActivitySchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import {
  archiveActivity,
  createActivity,
  getActivity,
  giveAppreciation,
  listActivities,
  moderateActivity,
  setMediaConsentVerified,
  submitActivity,
  updateActivity,
} from './activity.service.js';
import { createUploadTicket } from './media.service.js';
import { decideClearance, getSchoolTrust, listClearanceQueue } from './clearance.service.js';

const idParams = z.object({ id: idSchema });
const mediaParams = z.object({ id: idSchema, mediaId: idSchema });

export const activityRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  app.get('/activities', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:read');
    const query = parseOrThrow(listActivitiesQuerySchema, request.query);
    return reply.send(await listActivities(prisma, actor, query));
  });

  app.get('/activities/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await getActivity(prisma, actor, id));
  });

  app.post('/activities', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:create');
    const input = parseOrThrow(createActivitySchema, request.body);
    const activity = await createActivity(prisma, actor, input, request.auditContext());
    return reply.status(201).send(activity);
  });

  app.patch('/activities/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:update_own');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(updateActivitySchema, request.body);
    return reply.send(await updateActivity(prisma, actor, id, input, request.auditContext()));
  });

  app.post('/activities/:id/submit', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:submit');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(submitActivitySchema, request.body ?? {});
    return reply.send(await submitActivity(prisma, actor, id, input, request.auditContext()));
  });

  app.post('/activities/:id/moderate', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:moderate');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(moderateActivitySchema, request.body);
    return reply.send(await moderateActivity(prisma, actor, id, input, request.auditContext()));
  });

  app.post(
    '/activities/:id/media/:mediaId/consent',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const actor = request.requirePermission('activity:moderate');
      const { id, mediaId } = parseOrThrow(mediaParams, request.params);
      const { verified } = parseOrThrow(z.object({ verified: z.boolean() }), request.body);
      await setMediaConsentVerified(prisma, actor, id, mediaId, verified, request.auditContext());
      return reply.status(204).send();
    },
  );

  app.post('/activities/:id/archive', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:archive');
    const { id } = parseOrThrow(idParams, request.params);
    await archiveActivity(prisma, actor, id, request.auditContext());
    return reply.status(204).send();
  });

  app.post(
    '/activities/:id/appreciate',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const actor = request.requirePermission('appreciation:give');
      const { id } = parseOrThrow(idParams, request.params);
      const input = parseOrThrow(giveAppreciationSchema, request.body ?? {});
      return reply.send(await giveAppreciation(prisma, actor, id, input, request.auditContext()));
    },
  );

  // ---------------------------------------------------------------------------
  // Clearance: the gate out of the school
  // ---------------------------------------------------------------------------

  app.get('/clearance-queue', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:clear');
    const query = parseOrThrow(listClearanceQuerySchema, request.query);
    return reply.send(await listClearanceQueue(prisma, actor, query));
  });

  app.post('/activities/:id/clearance', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:clear');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(decideClearanceSchema, request.body);
    return reply.send(await decideClearance(prisma, actor, id, input, request.auditContext()));
  });

  /** A school's standing, and how much of its work gets a second look. */
  app.get('/schools/:id/trust', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await getSchoolTrust(prisma, actor, id));
  });

  /** The statement a head teacher confirms before work leaves the school. */
  app.get('/attestation-text', async (_request, reply) => {
    return reply.header('cache-control', 'public, max-age=3600').send(ATTESTATION_TEXT);
  });

  app.post('/uploads', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:create');
    const input = parseOrThrow(requestUploadSchema, request.body);
    const ticket = await createUploadTicket(prisma, actor, input, request.auditContext());
    return reply.status(201).send(ticket);
  });
};
