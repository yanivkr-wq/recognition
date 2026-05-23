/**
 * Cron registry — the single registration point for every recurring job.
 *
 * v1 ships empty. Phases 5–9 fill it in per docs/CRON.md (dispatcher every
 * 5 min, daily-reset at 00:00, campaign-window at 01:00, db-backup at 04:00,
 * evidence-backup weekly Sun 05:00, evidence-purge at 06:00, optional daily-
 * summary at 09:00 — all Asia/Jerusalem).
 *
 * Each job's handler must be idempotent — node-cron fires on schedule
 * regardless of whether a previous tick is still running.
 */

import cron, { type ScheduledTask } from 'node-cron';
import { Pool } from 'pg';
import { env } from '../env';
import { logger } from '../logger';
import { runEvidencePurge } from './evidence-purge';
import { runDailyReset } from './daily-reset';

export interface CronJob {
  /** Stable identifier for logging + tests. */
  name: string;
  /** Crontab schedule (5- or 6-field). */
  schedule: string;
  /** Body to run on each fire. Wrap your own try/catch if needed. */
  handler: () => Promise<void>;
}

let cachedPool: Pool | null = null;
function workerPool(): Pool {
  if (cachedPool) return cachedPool;
  cachedPool = new Pool({ connectionString: env.DATABASE_URL });
  return cachedPool;
}

/**
 * Registered jobs. Phase 5 adds evidence-purge; subsequent phases push more.
 */
export const jobs: CronJob[] = [
  {
    name: 'evidence-purge',
    schedule: env.EVIDENCE_PURGE_CRON,
    handler: async () => {
      const { purged, errors } = await runEvidencePurge(workerPool());
      logger.info({ purged, errors }, 'evidence-purge tick');
    },
  },
  {
    // Phase 7: streak evaluation + window close + birthday badge.
    // Fires at 00:00 IL (env.DAILY_RESET_CRON default '0 0 * * *').
    name: 'daily-reset',
    schedule: env.DAILY_RESET_CRON,
    handler: async () => {
      const counts = await runDailyReset(workerPool());
      logger.info(counts, 'daily-reset tick');
    },
  },
];

export function registerCron(): ScheduledTask[] {
  if (jobs.length === 0) {
    logger.info('cron registry empty — first jobs land in Phase 5+');
    return [];
  }

  const tasks: ScheduledTask[] = [];
  for (const job of jobs) {
    const task = cron.schedule(
      job.schedule,
      async () => {
        const t0 = Date.now();
        try {
          await job.handler();
          logger.info({ job: job.name, durationMs: Date.now() - t0 }, 'cron job ok');
        } catch (err) {
          logger.error(
            { job: job.name, durationMs: Date.now() - t0, err },
            'cron job failed',
          );
        }
      },
      { timezone: env.TZ },
    );
    tasks.push(task);
    logger.info({ job: job.name, schedule: job.schedule, tz: env.TZ }, 'cron job registered');
  }
  return tasks;
}
