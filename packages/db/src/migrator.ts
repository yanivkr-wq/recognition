/**
 * Reusable migration runner — the function form that the worker calls on boot
 * (BUILD-PLAN.md Phase 1, task 8) and that the CLI in `./migrate.ts` wraps.
 *
 * Reads every *.sql file in ../migrations alphabetically, applies any whose
 * filename is not yet recorded in __migrations, wraps each application in its
 * own transaction, records the filename on success. Idempotent: subsequent
 * calls apply only what's new. Callers can pass a `log` hook to forward
 * progress to their structured logger (pino, console, etc.).
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

interface AppliedRow {
  filename: string;
}

export interface ApplyMigrationsResult {
  applied: string[];
  alreadyApplied: number;
}

export interface ApplyMigrationsOptions {
  /** Where the *.sql files live. Defaults to ../migrations relative to this file. */
  migrationsDir?: string;
  /** Forward progress messages to the caller's logger; defaults to a no-op. */
  log?: (msg: string) => void;
}

const defaultMigrationsDir = (): string => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', 'migrations');
};

export async function applyMigrations(
  databaseUrl: string,
  opts: ApplyMigrationsOptions = {},
): Promise<ApplyMigrationsResult> {
  const log = opts.log ?? (() => undefined);
  const migrationsDir = opts.migrationsDir ?? defaultMigrationsDir();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS __migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const allFiles = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const appliedRes = await client.query<AppliedRow>('SELECT filename FROM __migrations');
    const appliedSet = new Set(appliedRes.rows.map((r) => r.filename));
    const applied: string[] = [];

    for (const file of allFiles) {
      if (appliedSet.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      log(`applying ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO __migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }

    return { applied, alreadyApplied: appliedSet.size };
  } finally {
    await client.end();
  }
}
