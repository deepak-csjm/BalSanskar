import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createAchievementSchema,
  idSchema,
  listAchievementsQuerySchema,
  setEnrolmentSchema,
  verifyAchievementSchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import { forbidden } from '../../lib/errors.js';
import { getEnrolment, setEnrolment } from './enrolment.service.js';
import { createAchievement, listAchievements, verifyAchievement } from './achievement.service.js';

const idParams = z.object({ id: idSchema });

/**
 * What a school records about its children, and what its children have won.
 *
 * There is no roster endpoint and no consent endpoint, because there is no
 * child record: see docs/data-protection.md. The register is a count per class,
 * and an achievement belongs to a school and a class rather than to a named
 * pupil.
 */
export const schoolRecordRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  app.get('/schools/:id/enrolment', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await getEnrolment(prisma, actor, id));
  });

  app.put('/schools/:id/enrolment', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('enrolment:write');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(setEnrolmentSchema, request.body);
    return reply.send(await setEnrolment(prisma, actor, id, input, request.auditContext()));
  });

  app.get('/achievements', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('achievement:read');
    const query = parseOrThrow(listAchievementsQuerySchema, request.query);
    return reply.send(await listAchievements(prisma, actor, query));
  });

  app.post('/achievements', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('achievement:create');
    if (!actor.schoolId) throw forbidden('Only school staff can record an achievement');
    const input = parseOrThrow(createAchievementSchema, request.body);
    const created = await createAchievement(prisma, actor, input, request.auditContext());
    return reply.status(201).send(created);
  });

  app.post('/achievements/:id/verify', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('achievement:verify');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(verifyAchievementSchema, request.body);
    return reply.send(await verifyAchievement(prisma, actor, id, input, request.auditContext()));
  });
};
