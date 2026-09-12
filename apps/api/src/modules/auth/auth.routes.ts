import type { FastifyPluginAsync } from 'fastify';
import {
  passwordLoginSchema,
  refreshSchema,
  registerTeacherSchema,
  requestOtpSchema,
  setPasswordSchema,
  verifyOtpSchema,
} from '@balsanskar/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../lib/prisma.js';
import { parseOrThrow } from '../../lib/validate.js';
import {
  endSession,
  loginWithOtp,
  loginWithPassword,
  refreshSession,
  registerTeacher,
  requestOtp,
  setPassword,
  toSessionUser,
} from './auth.service.js';

export const authRoutes: FastifyPluginAsync = async (app) => {
  const prisma = getPrisma();
  const config = getConfig();

  /**
   * A per-address ceiling on the credential endpoints.
   *
   * This is a backstop against a flood, not the primary defence against
   * guessing: nobody is signed in yet, so the only key available is the source
   * address, and in rural Uttar Pradesh one address is routinely a whole block
   * office or a shared connection. Locking those users out would be the worse
   * failure. Guessing is bounded per phone number instead — a resend cooldown,
   * an hourly cap and a five-attempt limit per code — in the auth service.
   */
  const strictLimit = {
    config: {
      rateLimit: {
        max: config.AUTH_RATE_LIMIT_MAX,
        timeWindow: config.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000,
      },
    },
  };

  app.post('/otp/request', strictLimit, async (request, reply) => {
    const input = parseOrThrow(requestOtpSchema, request.body);
    const result = await requestOtp(prisma, input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return reply.send(result);
  });

  app.post('/otp/login', strictLimit, async (request, reply) => {
    const input = parseOrThrow(verifyOtpSchema, request.body);
    const session = await loginWithOtp(
      prisma,
      { phone: input.phone, code: input.code },
      { ip: request.ip, userAgent: request.headers['user-agent'] ?? null },
    );
    return reply.send(session);
  });

  app.post('/password/login', strictLimit, async (request, reply) => {
    const input = parseOrThrow(passwordLoginSchema, request.body);
    const session = await loginWithPassword(prisma, input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return reply.send(session);
  });

  app.post('/register', strictLimit, async (request, reply) => {
    const input = parseOrThrow(registerTeacherSchema, request.body);
    const result = await registerTeacher(prisma, input, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      actorId: null,
      actorRole: null,
    });
    return reply.status(201).send(result);
  });

  app.post('/refresh', async (request, reply) => {
    const input = parseOrThrow(refreshSchema, request.body);
    const session = await refreshSession(prisma, input.refreshToken, {
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return reply.send(session);
  });

  app.post('/logout', async (request, reply) => {
    const input = parseOrThrow(refreshSchema, request.body);
    await endSession(prisma, input.refreshToken);
    return reply.status(204).send();
  });

  app.get('/me', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.currentActor();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    return reply.send(await toSessionUser(prisma, user));
  });

  app.post('/password', { preHandler: app.requireAuth }, async (request, reply) => {
    const actor = request.currentActor();
    const input = parseOrThrow(setPasswordSchema, request.body);
    await setPassword(prisma, actor.id, input);
    return reply.status(204).send();
  });
};
