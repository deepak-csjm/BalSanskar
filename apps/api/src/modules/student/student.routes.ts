import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createAchievementSchema,
  createStudentSchema,
  idSchema,
  listAchievementsQuerySchema,
  listStudentsQuerySchema,
  recordConsentSchema,
  revokeConsentSchema,
  updateStudentSchema,
  verifyAchievementSchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import { forbidden } from '../../lib/errors.js';
import {
  createStudent,
  getStudent,
  listConsentHistory,
  listStudents,
  recordConsent,
  revokeConsent,
  updateStudent,
} from './student.service.js';
import { createAchievement, listAchievements, verifyAchievement } from './achievement.service.js';

const idParams = z.object({ id: idSchema });

export const studentRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  app.get('/students', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('student:read');
    const query = parseOrThrow(listStudentsQuerySchema, request.query);
    return reply.send(await listStudents(prisma, actor, query));
  });

  app.get('/students/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('student:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await getStudent(prisma, actor, id));
  });

  app.post('/students', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('student:write');
    const body = parseOrThrow(
      createStudentSchema.extend({ schoolId: idSchema.optional() }),
      request.body,
    );
    // School staff always write into their own school; officers must say which.
    const schoolId = body.schoolId ?? actor.schoolId;
    if (!schoolId) {
      throw forbidden('Specify which school this student belongs to');
    }
    const { schoolId: _ignored, ...input } = body;
    const student = await createStudent(prisma, actor, schoolId, input, request.auditContext());
    return reply.status(201).send(student);
  });

  app.patch('/students/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('student:write');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(updateStudentSchema, request.body);
    return reply.send(await updateStudent(prisma, actor, id, input, request.auditContext()));
  });

  // ---------------------------------------------------------------------------
  // Guardian consent
  // ---------------------------------------------------------------------------

  app.get('/students/:id/consent', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('consent:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send({ items: await listConsentHistory(prisma, actor, id) });
  });

  app.post('/students/:id/consent', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('consent:write');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(recordConsentSchema, request.body);
    const consent = await recordConsent(prisma, actor, id, input, request.auditContext());
    return reply.status(201).send(consent);
  });

  app.post(
    '/students/:id/consent/revoke',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const actor = request.requirePermission('consent:write');
      const { id } = parseOrThrow(idParams, request.params);
      const { reason } = parseOrThrow(revokeConsentSchema, request.body);
      return reply.send(await revokeConsent(prisma, actor, id, reason, request.auditContext()));
    },
  );

  // ---------------------------------------------------------------------------
  // Achievements
  // ---------------------------------------------------------------------------

  app.get('/achievements', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('student:read');
    const query = parseOrThrow(listAchievementsQuerySchema, request.query);
    return reply.send(await listAchievements(prisma, actor, query));
  });

  app.post('/achievements', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('achievement:create');
    const input = parseOrThrow(createAchievementSchema, request.body);
    const achievement = await createAchievement(prisma, actor, input, request.auditContext());
    return reply.status(201).send(achievement);
  });

  app.post('/achievements/:id/verify', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('achievement:verify');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(verifyAchievementSchema, request.body);
    return reply.send(await verifyAchievement(prisma, actor, id, input, request.auditContext()));
  });
};
