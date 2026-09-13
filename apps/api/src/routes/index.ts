import type { FastifyPluginAsync } from 'fastify';
import { getPrisma } from '../lib/prisma.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { orgRoutes } from '../modules/org/org.routes.js';
import { claimRoutes } from '../modules/org/claim.routes.js';
import { schoolRecordRoutes } from '../modules/school-record/school-record.routes.js';
import { villageRoutes } from '../modules/village/village.routes.js';
import { waitingRoutes } from '../modules/waiting/waiting.routes.js';
import { activityRoutes } from '../modules/activity/activity.routes.js';
import { reportRoutes } from '../modules/report/report.routes.js';
import { publicRoutes } from '../modules/public/public.routes.js';
import { fileRoutes } from './files.js';

export const registerRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Liveness: the process is up. Deliberately does not touch the database, so
   * that a database blip does not cause an orchestrator to kill healthy pods
   * and turn a degradation into an outage.
   */
  app.get('/health', { config: { rateLimit: false } }, async () => ({
    status: 'ok',
    time: new Date().toISOString(),
  }));

  /** Readiness: this instance can serve traffic. Checks the database. */
  app.get('/ready', { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      return reply.send({ status: 'ready' });
    } catch {
      return reply.status(503).send({ status: 'not-ready', reason: 'database unreachable' });
    }
  });

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(orgRoutes);
  await app.register(claimRoutes);
  await app.register(schoolRecordRoutes);
  await app.register(villageRoutes);
  await app.register(waitingRoutes);
  await app.register(activityRoutes);
  await app.register(reportRoutes);
  await app.register(publicRoutes);
  await app.register(fileRoutes);
};
