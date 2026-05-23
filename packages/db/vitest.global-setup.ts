/**
 * Vitest globalSetup — loads .env.test (if present) so test files importing
 * `process.env.TEST_DATABASE_URL` at module-eval time see a populated value.
 *
 * The file is intentionally minimal: it doesn't touch the database, it just
 * makes the env var available. The actual DB lifecycle lives in
 * src/test-utils/test-db.ts so each test file can decide whether it needs
 * the harness (encrypt.test.ts doesn't).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export default function setup(): void {
  const envPath = path.resolve(import.meta.dirname, '.env.test');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
