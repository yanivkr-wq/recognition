/**
 * Vitest config for @reco/web.
 *
 * Scoped to pure-unit tests that don't need Next's runtime — currently the
 * evidence path-safety tests in `src/lib/evidence/paths.test.ts`. Server
 * actions + UI components live in the Next app shell and require a full
 * harness to test in isolation; those are exercised by browser flow tests
 * during exit-criteria verification instead.
 *
 * `pool: forks + singleFork` matches @reco/db's config so any future tests
 * that touch the throwaway pg can join the same serialization.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    include: ['src/lib/**/*.test.ts'],
    testTimeout: 5_000,
  },
});
