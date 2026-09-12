import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ERROR_CODES } from '@balsanskar/shared';
import { getConfig, type AppConfig } from './config.js';
import { AppError } from './lib/errors.js';
import { authPlugin } from './plugins/auth.js';
import { registerRoutes } from './routes/index.js';

/**
 * Builds the HTTP application.
 *
 * Separated from `server.ts` so that tests can construct a fully wired instance,
 * drive it through `app.inject()` and never bind a port — which is what makes
 * the integration suite fast enough to run on every commit.
 */
export async function buildApp(config: AppConfig = getConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.isTest ? 'silent' : config.LOG_LEVEL,
      // Health probes fire every few seconds; logging them buries everything else.
      // Personal data must not end up in a log aggregator. Phone numbers,
      // guardian names and one-time codes are the fields most likely to be
      // logged by accident, so they are redacted at the logger itself rather
      // than trusted to every call site.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.newPassword',
          'req.body.currentPassword',
          'req.body.code',
          'req.body.phone',
          'req.body.guardianPhone',
          'req.body.contactPhone',
          'res.headers["set-cookie"]',
        ],
        censor: '[redacted]',
      },
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            // The remote address is kept: abuse investigation needs it.
            remoteAddress: request.ip,
          };
        },
      },
    },
    trustProxy: config.TRUST_PROXY,
    genReqId: (request) => {
      const header = request.headers['x-request-id'];
      return typeof header === 'string' && header.length <= 64 ? header : randomUUID();
    },
    bodyLimit: 1024 * 1024, // 1 MB: file bytes go through the storage driver, not through JSON.
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // The API serves JSON and signed files, not HTML.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });

  await app.register(cors, {
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, the mobile shell, health checks)
      // send no Origin header at all.
      if (!origin) return callback(null, true);
      callback(null, config.corsOrigins.includes(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  });

  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_SECONDS * 1000,
    // Signed-in callers are limited per account so that a whole school behind one
    // NAT gateway is not throttled because of a single busy colleague.
    keyGenerator: (request) => request.actor?.id ?? request.ip,
    enableDraftSpec: true,
  });

  await app.register(authPlugin);

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: `No route for ${request.method} ${request.url}`,
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, ...error.context }, error.message);
      } else {
        request.log.info({ code: error.code, ...error.context }, error.message);
      }
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
          requestId: request.id,
        },
      });
    }

    // Fastify's own errors (rate limit, malformed JSON, payload too large).
    const fastifyError = error as { statusCode?: unknown; message?: unknown };
    const statusCode = typeof fastifyError.statusCode === 'number' ? fastifyError.statusCode : 500;
    const message = typeof fastifyError.message === 'string' ? fastifyError.message : 'Bad request';
    if (statusCode === 429) {
      return reply.status(429).send({
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests. Please wait a moment and try again.',
          requestId: request.id,
        },
      });
    }
    if (statusCode === 413) {
      return reply.status(413).send({
        error: {
          code: ERROR_CODES.PAYLOAD_TOO_LARGE,
          message: 'That file or request is too large.',
          requestId: request.id,
        },
      });
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message,
          requestId: request.id,
        },
      });
    }

    // Anything else is a bug. Log it in full; tell the caller nothing.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send({
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Something went wrong at our end. The problem has been logged.',
        requestId: request.id,
      },
    });
  });

  await app.register(registerRoutes, { prefix: '/v1' });

  return app;
}
