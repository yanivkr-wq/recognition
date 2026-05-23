/**
 * Barrel — re-exports the Vitest+Postgres harness so callers do
 *   import { setupTestDb, seedBaseFixtures, IDS } from '@reco/db/test-utils';
 *
 * This subpath is gated by the `exports` map in package.json (only test
 * configurations resolve it). Production code paths can't accidentally pull
 * it in.
 */

export { setupTestDb, type TestDbHandle } from './test-db';
export {
  seedBaseFixtures,
  ledgerSum,
  displayBalance,
  IDS,
  type SeedHandles,
} from './seed';
