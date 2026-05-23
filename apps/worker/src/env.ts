/**
 * Typed env parser for the worker process.
 *
 * Parses process.env through a Zod schema on import. Required keys for sub-1d
 * are minimal (DATABASE_URL + the runtime knobs); the rest of the schema is
 * `.optional()` so future Phases (5 = B2/SMTP, 6 = Twilio, 8 = WhatsApp) can
 * tighten the contract field-by-field as those features land. A failure
 * throws synchronously at import time so the worker fails fast at boot.
 */

import { z } from 'zod';

const schema = z.object({
  // Runtime knobs
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Asia/Jerusalem'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  WORKER_PORT: z.coerce.number().int().positive().default(8100),
  WORKER_HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().url(),

  // Crypto (helpers/encrypt.ts validates length on first use)
  MASTER_KEY: z.string().optional(),

  // Web↔worker shared secret (Phase 5+ internal evidence-serve route)
  WORKER_INTERNAL_TOKEN: z.string().optional(),

  // Notifications (Phase 8)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  WHATSAPP_DRY_RUN: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // Email (Phase 9 daily summary)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Backblaze B2 (Phase 5 backups)
  B2_ENDPOINT: z.string().optional(),
  B2_BUCKET_DB: z.string().optional(),
  B2_BUCKET_EVIDENCE: z.string().optional(),
  B2_KEY_ID: z.string().optional(),
  B2_APP_KEY: z.string().optional(),

  // Cron schedules (overridable; defaults match docs/CRON.md)
  DISPATCHER_CRON: z.string().default('*/5 * * * *'),
  DAILY_RESET_CRON: z.string().default('0 0 * * *'),
  CAMPAIGN_WINDOW_CRON: z.string().default('0 1 * * *'),
  DB_BACKUP_CRON: z.string().default('0 4 * * *'),
  EVIDENCE_BACKUP_CRON: z.string().default('0 5 * * 0'),
  EVIDENCE_PURGE_CRON: z.string().default('0 6 * * *'),
  SUMMARY_CRON: z.string().default('0 9 * * *'),
  SUMMARY_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Evidence volume (Phase 5)
  EVIDENCE_VOLUME_PATH: z.string().default('/var/lib/reco/evidence'),
});

export type WorkerEnv = z.infer<typeof schema>;

function parseEnv(): WorkerEnv {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Surface the offending fields synchronously — the worker should fail
    // fast at boot rather than carry undefined config into a cron tick.
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid worker environment:\n${issues}`);
  }
  return result.data;
}

export const env: WorkerEnv = parseEnv();
