/**
 * Migration CLI — thin wrapper around `applyMigrations()` for use from
 * `pnpm migrate:apply`. Runtime: tsx. Reads DATABASE_URL from the
 * environment; exits non-zero on any failure.
 */

import { applyMigrations } from './migrator';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(`[migrate] ${msg}`);
  const { applied } = await applyMigrations(databaseUrl, { log });
  log(applied.length === 0 ? 'up to date' : `applied ${applied.length} file(s)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
