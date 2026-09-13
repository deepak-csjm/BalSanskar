import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { idSchema, listDutiesQuerySchema, recordDutySchema } from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import { attestDuty, listDuties, recordDuty, summariseDuties } from './duty.service.js';

const idParams = z.object({ id: idSchema });

/**
 * Teaching days consumed by work that is not teaching.
 *
 * Note what is absent: nothing here is required, nothing is scheduled, and
 * nothing chases a teacher who records nothing. Teachers in this state have
 * died under the reporting pressure of the Special Intensive Revision, and the
 * platform is arriving on a phone that already carries Prerna, Prerna DBT,
 * SHARDA, Manav Sampada, the mid-day meal line and the census app. A duty
 * ledger that nagged would be the thirteenth thing nagging, and would be
 * refused on sight — correctly.
 */
export const dutyRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  app.get('/duties', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const query = parseOrThrow(listDutiesQuerySchema, request.query);
    return reply.send(await listDuties(prisma, actor, query));
  });

  /**
   * The roll-up. `report:read` rather than anything narrower, because the whole
   * argument for this feature is that a block officer wants the number too —
   * they are the person who has to explain to the district why a term's work
   * did not happen, and they currently have nothing to explain it with.
   */
  app.get('/duties/summary', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:read');
    const query = parseOrThrow(listDutiesQuerySchema, request.query);
    return reply.send(await summariseDuties(prisma, actor, query));
  });

  app.post('/duties', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('duty:write');
    const input = parseOrThrow(recordDutySchema, request.body);
    const created = await recordDuty(prisma, actor, input, request.auditContext());
    return reply.status(201).send(created);
  });

  /**
   * Confirming a colleague's record.
   *
   * On `activity:moderate` — the head teacher's existing power to say "yes,
   * this happened here" — rather than a permission of its own, and never on
   * one's own record.
   */
  app.post('/duties/:id/attest', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('activity:moderate');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await attestDuty(prisma, actor, id, request.auditContext()));
  });
};
