/**
 * Singleton Drizzle client backed by a long-lived node-postgres Pool.
 *
 * One pool per process. Re-using `getDb()` across server-action invocations
 * keeps connection count bounded (pgbouncer-style behavior in-process). The
 * pool lazily connects; tests can override DATABASE_URL before the first
 * call, or call __resetForTesting() to discard the cached pool.
 */

import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';

let cachedPool: Pool | null = null;
let cachedDb: NodePgDatabase<typeof schema> | null = null;

export function getPool(): Pool {
  if (cachedPool) return cachedPool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  cachedPool = new Pool({ connectionString: url });
  return cachedPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (cachedDb) return cachedDb;
  cachedDb = drizzle(getPool(), { schema });
  return cachedDb;
}

export async function __resetForTesting(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
  }
  cachedPool = null;
  cachedDb = null;
}
