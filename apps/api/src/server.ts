import { buildApp } from './app.js';
import { getConfig } from './config.js';
import { disconnectPrisma, getPrisma } from './lib/prisma.js';

/**
 * Process entry point.
 *
 * Fails fast on a bad configuration or an unreachable database, and shuts down
 * gracefully so that in-flight requests finish before the container goes away.
 */
async function main(): Promise<void> {
  const config = getConfig();
  const app = await buildApp(config);

  // Prove the database is reachable before accepting traffic. A process that
  // binds a port and then 500s on every request is worse than one that fails
  // to start.
  await getPrisma().$queryRaw`SELECT 1`;

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(
    { storage: config.STORAGE_DRIVER, sms: config.SMS_PROVIDER, env: config.NODE_ENV },
    'BalSanskar API is listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Shutting down');
    const timer = setTimeout(() => {
      app.log.error('Shutdown took too long; exiting');
      process.exit(1);
    }, 15_000);
    timer.unref();
    try {
      await app.close();
      await disconnectPrisma();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    app.log.error({ err: reason }, 'Unhandled promise rejection');
  });
}

main().catch((error: unknown) => {
  console.error('Failed to start the BalSanskar API');
  console.error(error);
  process.exit(1);
});
