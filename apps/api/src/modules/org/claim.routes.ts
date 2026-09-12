import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  createSchoolClaimSchema,
  decideClaimSchema,
  idSchema,
  listClaimsQuerySchema,
} from '@balsanskar/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import { createSchoolClaim, decideSchoolClaim, listSchoolClaims } from './claim.service.js';

const idParams = z.object({ id: idSchema });

/**
 * Claiming a school, and the block office confirming it.
 *
 * The claim endpoint is reachable without signing in — by definition the
 * claimant has no account yet — so it is rate-limited hard and every claim is
 * anchored to a phone number verified by one-time code moments earlier.
 */
export const claimRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();
  const config = getConfig();

  app.post(
    '/school-claims',
    {
      config: {
        rateLimit: {
          max: config.AUTH_RATE_LIMIT_MAX,
          timeWindow: config.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
        },
      },
    },
    async (request, reply) => {
      const input = parseOrThrow(createSchoolClaimSchema, request.body);
      const receipt = await createSchoolClaim(prisma, input, {
        actorId: null,
        actorRole: null,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
      return reply.status(receipt.status === 'PENDING' ? 201 : 200).send(receipt);
    },
  );

  app.get('/school-claims', { preHandler: app.requireAuth }, async (request, reply) => {
    // The block officer who administers these schools is the one who can answer
    // whether a claimant is who they say they are.
    const actor = request.requirePermission('user:approve');
    const query = parseOrThrow(listClaimsQuerySchema, request.query);
    return reply.send(await listSchoolClaims(prisma, actor, query));
  });

  app.post('/school-claims/:id/decide', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.requirePermission('school:verify_claim');
    const { id } = parseOrThrow(idParams, request.params);
    const input = parseOrThrow(decideClaimSchema, request.body);
    return reply.send(await decideSchoolClaim(prisma, actor, id, input, request.auditContext()));
  });
};
