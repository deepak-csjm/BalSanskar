import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  approveUserSchema,
  createSchoolSchema,
  inviteUserSchema,
  listSchoolsQuerySchema,
  listUsersQuerySchema,
  rejectUserSchema,
  udiseSchema,
  updateSchoolSchema,
  USER_ROLES,
  cleanText,
  idSchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import {
  createSchool,
  getSchool,
  listSchools,
  lookupSchoolByUdise,
  updateSchool,
} from './school.service.js';
import {
  approveUser,
  changeUserRole,
  inviteUser,
  listUsers,
  rejectUser,
  setUserSuspension,
} from './user.service.js';

const idParams = z.object({ id: idSchema });

export const orgRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  // -------------------------------------------------------------------------
  // Geography. Readable without signing in, because the registration form needs
  // it before an account exists. Contains no personal data.
  // -------------------------------------------------------------------------

  app.get('/districts', async (_request, reply) => {
    const districts = await prisma.district.findMany({
      orderBy: { nameEn: 'asc' },
      select: { id: true, code: true, nameHi: true, nameEn: true, division: true },
    });
    return reply.send({ items: districts });
  });

  app.get('/districts/:id/blocks', async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    const blocks = await prisma.block.findMany({
      where: { districtId: id },
      orderBy: { nameEn: 'asc' },
      select: { id: true, districtId: true, code: true, nameHi: true, nameEn: true },
    });
    return reply.send({ items: blocks });
  });

  app.get(
    '/schools/lookup',
    { config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const { udiseCode } = parseOrThrow(z.object({ udiseCode: udiseSchema }), request.query);
      return reply.send(await lookupSchoolByUdise(prisma, udiseCode));
    },
  );

  // -------------------------------------------------------------------------
  // Schools
  // -------------------------------------------------------------------------

  app.get('/schools', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const query = parseOrThrow(listSchoolsQuerySchema, request.query);
    return reply.send(await listSchools(prisma, actor, query));
  });

  app.get('/schools/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await getSchool(prisma, actor, id));
  });

  app.post('/schools', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:create');
    const input = parseOrThrow(createSchoolSchema, request.body);
    const school = await createSchool(prisma, actor, input, request.auditContext());
    return reply.status(201).send(school);
  });

  app.patch('/schools/:id', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:update');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(updateSchoolSchema, request.body);
    return reply.send(await updateSchool(prisma, actor, id, input, request.auditContext()));
  });

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------

  app.get('/users', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:read');
    const query = parseOrThrow(listUsersQuerySchema, request.query);
    return reply.send(await listUsers(prisma, actor, query));
  });

  app.post('/users/invite', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:invite');
    const input = parseOrThrow(inviteUserSchema, request.body);
    const user = await inviteUser(prisma, actor, input, request.auditContext());
    return reply.status(201).send(user);
  });

  app.post('/users/:id/approve', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:approve');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(approveUserSchema, request.body ?? {});
    return reply.send(await approveUser(prisma, actor, id, input, request.auditContext()));
  });

  app.post('/users/:id/reject', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:approve');
    const { id } = parseOrThrow(idParams, request.params);
    const { reason } = parseOrThrow(rejectUserSchema, request.body);
    return reply.send(await rejectUser(prisma, actor, id, reason, request.auditContext()));
  });

  app.post('/users/:id/suspend', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:suspend');
    const { id } = parseOrThrow(idParams, request.params);
    const { reason } = parseOrThrow(z.object({ reason: cleanText(3, 300) }), request.body);
    return reply.send(
      await setUserSuspension(prisma, actor, id, true, reason, request.auditContext()),
    );
  });

  app.post('/users/:id/reactivate', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:suspend');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(
      await setUserSuspension(prisma, actor, id, false, null, request.auditContext()),
    );
  });

  app.patch('/users/:id/role', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('user:assign_role');
    const { id } = parseOrThrow(idParams, request.params);
    const { role } = parseOrThrow(z.object({ role: z.enum(USER_ROLES) }), request.body);
    return reply.send(await changeUserRole(prisma, actor, id, role, request.auditContext()));
  });
};
