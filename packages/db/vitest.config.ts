/**
 * Vitest config for @reco/db.
 *
 * Phase 3 introduces invariant tests against a real Postgres instance. Those
 * tests share a single connection pool per process and TRUNCATE between cases
 * (see src/test-utils/test-db.ts), so we MUST disable Vitest's per-file
 * parallel worker pool — otherwise concurrent files would race the same DB.
 *
 * The `--env-file` flag isn't enough to load .env.test because the test files
 * import `process.env.TEST_DATABASE_URL` at module evaluation time, before
 * Vitest's env-file mechanism runs. We load it ourselves via globalSetup so
 * by the time `setupTestDb()` reads the env, the value is present.
 *
 * The CI invocation is just `pnpm --filter @reco/db test`; .env.test is the
 * developer's local override and is gitignored.
 */

import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Tests in this package range from pure unit (encrypt) to DB-backed
    // (ledger.post). Pure tests don't need the DB, but running everything
    // sequentially keeps the harness simple — and the suite is small.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.global-setup.ts')],
    // Long-ish default for the first-process migration apply (Postgres cold
    // start in Docker can be ~3s on Windows).
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
