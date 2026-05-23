/**
 * Vitest-with-Postgres harness for @reco/db.
 *
 * Phase 3 introduces invariant tests against the real schema (partial unique
 * indexes, CHECK constraints, circular FKs). Mocking would defeat the point —
 * the whole purpose is to assert that the DB rejects malformed ledger writes.
 *
 * Usage from a test file:
 *
 *   const harness = await setupTestDb();
 *   beforeEach(() => harness.truncate());
 *   afterAll(() => harness.close());
 *
 * Requirements:
 *   - TEST_DATABASE_URL points at a Postgres ≥15 instance the test can
 *     write to. NEVER point this at production. The dev convention is the
 *     throwaway container from RESUME-HERE.md on port 5433, using a separate
 *     database (`reco_test`).
 *   - Migrations are applied once per test PROCESS (the first setupTestDb()
 *     call). Subsequent tests in the same process get the schema for free.
 *   - truncate() preserves __migrations so the next test doesn't re-run
 *     migrations, and TRUNCATE ... CASCADE handles the circular FKs.
 */

import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema/index';
import { applyMigrations } from '../migrator';

const DOMAIN_TABLES = [
  // Order doesn't matter with CASCADE, but list every domain table so a future
  // migration adds itself here too. __migrations + the auth tables that don't
  // hold meaningful state are excluded.
  'ledger_entry',
  'task_completion',
  'long_term_progress',
  'submission',
  'evidence',
  'redemption',
  'kid_badge',
  'campaign_enrollment',
  'campaign_nudge_log',
  'campaign_feeding_task',
  'campaign',
  'badge',
  'reward_item',
  'notification_event',
  'audit_log',
  'device_trust',
  'task_reminder',
  'task_assignment',
  'task_template',
  'kid',
  '"user"',
  'session',
  'account',
  'verification_token',
  'household',
] as const;

export interface TestDbHandle {
  /** Drizzle instance bound to the test pool. */
  db: NodePgDatabase<typeof schema>;
  /** Raw pg pool — for raw SQL invariant tests. */
  pool: Pool;
  /** TRUNCATE every domain table. Call from beforeEach. Preserves __migrations. */
  truncate: () => Promise<void>;
  /** Close the pool. Call from afterAll. */
  close: () => Promise<void>;
  /** The DATABASE_URL the harness opened. */
  url: string;
}

let migrationsAppliedFor: string | null = null;

export async function setupTestDb(): Promise<TestDbHandle> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required for the @reco/db test harness. ' +
        'See packages/db/.env.test.example.',
    );
  }

  // Apply migrations once per process per URL. applyMigrations() is idempotent
  // on its own; this short-circuit just avoids the connect/disconnect overhead.
  if (migrationsAppliedFor !== url) {
    await applyMigrations(url, { log: () => undefined });
    migrationsAppliedFor = url;
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  const truncate = async (): Promise<void> => {
    await pool.query(
      `TRUNCATE TABLE ${DOMAIN_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
    );
  };

  return {
    db,
    pool,
    truncate,
    close: async () => {
      await pool.end();
    },
    url,
  };
}
