/**
 * Pino logger singleton, pretty-printed in dev.
 *
 * In production we emit raw JSON so the Hetzner host's journald + log
 * aggregator can parse cleanly. `pino-pretty` runs as a transport (separate
 * worker thread) in dev, which is fine under tsx but is intentionally
 * skipped when NODE_ENV=production to avoid the extra fd / cold-start cost.
 */

import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'reco-worker' },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});
