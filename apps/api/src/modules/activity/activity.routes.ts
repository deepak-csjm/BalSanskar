import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createActivitySchema,
  giveAppreciationSchema,
  idSchema,
  listActivitiesQuerySchema,
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

  app.post('/uploads', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:create');
    const input = parseOrThrow(requestUploadSchema, request.body);
    const ticket = await createUploadTicket(prisma, actor, input, request.auditContext());
    return reply.status(201).send(ticket);
  });
};
