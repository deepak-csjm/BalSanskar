import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { answerSmcRequestSchema, idSchema } from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import { answerSmcRequest, getResponseTimes, getWaitingBoard } from './waiting.service.js';

const idParams = z.object({ id: idSchema });

const DEFAULT_WINDOW_DAYS = 90;

/**
 * The reciprocal half of the escalation gate.
 *
 * Everything else in this API measures a school: what it did, what it filed,
 * what it is missing. These two routes measure the offices above it. They exist
 * because a platform that timed only the teacher would be the July 2024
 * attendance app with better manners, and would be read that way within a week.
 */
export const waitingRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  /**
   * Who is holding my work.
   *
   * Deliberately gated on `school:read` rather than anything narrower: a
   * teacher must be able to open this. It is the one screen in the product
   * whose entire purpose is to tell them that somebody else owes them
   * something.
   */
  app.get('/waiting', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    return reply.send(await getWaitingBoard(prisma, actor));
  });

  /**
   * How long each office takes.
   *
   * `report:read` rather than `audit:read`, because this is not an
   * investigation — it is the same kind of operational report an officer
   * already reads about schools, pointed the other way.
   */
  app.get('/reports/response-times', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:read');
    const query = parseOrThrow(
      z.object({ days: z.coerce.number().int().min(7).max(730).default(DEFAULT_WINDOW_DAYS) }),
      request.query,
    );
    const to = new Date();
    const from = new Date(to.getTime() - query.days * 24 * 60 * 60 * 1000);
    return reply.send(await getResponseTimes(prisma, actor, { from, to }));
  });

  /**
   * Answering a School Management Committee.
   *
   * `village:write` would be wrong — that is the school's own permission for
   * its own records. Answering the village on the block office's behalf is the
   * block office's act, so it rides on the permission that already marks
   * somebody as that office.
   */
  app.post('/smc-meetings/:id/answer', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:clear');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(answerSmcRequestSchema, request.body);
    return reply.send(await answerSmcRequest(prisma, actor, id, input, request.auditContext()));
  });
};
