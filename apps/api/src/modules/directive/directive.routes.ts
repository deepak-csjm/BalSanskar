import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  idSchema,
  listDirectivesQuerySchema,
  publishDirectiveSchema,
  respondToDirectiveSchema,
} from '@balsanskar/shared';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import {
  checkAuthenticity,
  directiveUptake,
  listDirectives,
  publishDirective,
  respondToDirective,
  withdrawDirective,
} from './directive.service.js';

const idParams = z.object({ id: idSchema });

/**
 * The register of orders.
 *
 * The platform verifies and never originates. Every route here points at a
 * document some office actually issued; none of them lets an instruction start
 * on this platform. A system that let an order originate here would be read by
 * the Directorate as a rival authority, and would deserve to be.
 */
export const directiveRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();

  /**
   * Is this letter real?
   *
   * Authenticated but available to every role, including a teacher, because
   * the person holding the photograph in the WhatsApp group is as often a
   * teacher as a head teacher. Rate-limited on its own budget: it is a lookup
   * by a value an attacker can enumerate, and the register is not a secret but
   * it is not a bulk export either.
   */
  app.get(
    '/directives/check',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 60, timeWindow: '10 minutes' } },
    },
    async (request, reply) => {
      request.requirePermission('school:read');
      const { letterNumber } = parseOrThrow(
        z.object({ letterNumber: z.string().trim().min(1).max(120) }),
        request.query,
      );
      return reply.send(await checkAuthenticity(prisma, letterNumber));
    },
  );

  /** What is in force for the caller's school, superseded orders removed. */
  app.get('/directives', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:read');
    const query = parseOrThrow(listDirectivesQuerySchema, request.query);
    return reply.send(await listDirectives(prisma, actor, query));
  });

  app.post('/directives', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('directive:publish');
    const input = parseOrThrow(publishDirectiveSchema, request.body);
    const created = await publishDirective(prisma, actor, input, request.auditContext());
    return reply.status(201).send(created);
  });

  app.post('/directives/:id/withdraw', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('directive:publish');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await withdrawDirective(prisma, actor, id, request.auditContext()));
  });

  /**
   * A school's answer.
   *
   * On `directive:respond`, which every teacher holds. Restricting it to the
   * head teacher would put one more thing through the single most loaded person
   * in the building — fourteen mandated registers and a dozen daily uploads
   * already funnel through them.
   */
  app.post('/directives/:id/respond', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('directive:respond');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(respondToDirectiveSchema, request.body);
    return reply.send(await respondToDirective(prisma, actor, id, input, request.auditContext()));
  });

  /**
   * What the answers tell the office.
   *
   * `report:read`, and the response deliberately carries no per-school figure:
   * the blocked reasons travel with the counts or the endpoint would be the
   * compliance dashboard this whole design exists to avoid.
   */
  app.get('/directives/:id/uptake', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('report:read');
    const { id } = parseOrThrow(idParams, request.params);
    return reply.send(await directiveUptake(prisma, actor, id));
  });
};
