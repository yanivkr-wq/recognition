/**
 * Reco worker entrypoint.
 *
 * Boot sequence:
 *   1. Parse env (synchronous, fails fast on invalid config — see ./env.ts).
 *   2. Initialize the pino logger.
 *   3. Apply pending DB migrations via @reco/db's runner.
 *   4. Start Fastify on env.WORKER_PORT with /healthz.
 *   5. Register all cron jobs (currently zero — Phase 5+ fills the registry).
 *   6. Install SIGINT/SIGTERM handlers for graceful shutdown.
 *
 * Steps 3-5 are deliberately serial: we don't want Fastify accepting traffic
 * before the schema is up to date, and we don't want crons firing before the
 * HTTP listener is bound (a few crons hit /healthz internally as part of
 * smoke checks).
 */

import Fastify from 'fastify';
import { applyMigrations } from '@reco/db';
import { env } from './env';
import { logger } from './logger';
import { registerCron } from './cron/registry';

async function main(): Promise<void> {
  logger.info(
    { env: env.NODE_ENV, tz: env.TZ, port: env.WORKER_PORT },
    'reco worker starting',
  );

  // 1. Migrations on boot.
  logger.info('applying pending migrations');
  const { applied, alreadyApplied } = await applyMigrations(env.DATABASE_URL, {
    log: (msg) => logger.info({ migrator: true }, msg),
  });
  if (applied.length === 0) {
    logger.info({ alreadyApplied }, 'migrations up to date');
  } else {
    logger.info({ applied, alreadyApplied }, 'migrations applied');
  }

  // 2. HTTP server.
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'reco-worker',
    timestamp: new Date().toISOString(),
  }));

  await app.listen({ port: env.WORKER_PORT, host: env.WORKER_HOST });
  logger.info({ port: env.WORKER_PORT, host: env.WORKER_HOST }, 'reco worker listening');

  // 3. Cron registry.
  const tasks = registerCron();

  // 4. Graceful shutdown.
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    logger.info({ signal }, 'shutdown signal received');
    for (const task of tasks) task.stop();
    try {
      await app.close();
      logger.info('reco worker stopped cleanly');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'reco worker failed to start');
  process.exit(1);
});
