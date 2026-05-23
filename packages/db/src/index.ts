/**
 * @reco/db — public surface.
 *
 * Re-exports the Drizzle schema (table objects + Insert/Select row types),
 * the pooled `getDb()` client, and the `encrypt`/`decrypt` helpers. The
 * migration runner is not exported (it's a CLI invoked via `pnpm migrate:apply`).
 */

export * from './schema/index';
export { getDb, getPool, __resetForTesting } from './client';
export { encrypt, decrypt, __resetKeyCacheForTesting } from './helpers/encrypt';
export {
  applyMigrations,
  type ApplyMigrationsResult,
  type ApplyMigrationsOptions,
} from './migrator';
export {
  ledgerPost,
  postWithTransaction,
  LedgerInvariantError,
  type PostInput,
  type PostedEntry,
} from './ledger/index';
export {
  logProgressOperation,
  undoLongTermProgressOperation,
  type LogProgressInput,
  type LogProgressResult,
  type UndoProgressInput,
  type UndoProgressResult,
} from './long-term/index';
export {
  approveSubmissionOperation,
  type ApproveInput,
  type ApproveResult,
} from './evidence/index';
export {
  redeemOperation,
  markRedemptionReceivedOperation,
  cancelRedemptionOperation,
  refundRedemptionOperation,
  type RedeemInput,
  type RedeemResult,
  type MarkReceivedInput,
  type MarkReceivedResult,
  type AdminReverseInput,
  type AdminReverseResult,
} from './redemption/index';
export {
  adjustWalletOperation,
  type AdjustWalletInput,
  type AdjustWalletResult,
} from './joker/index';
export {
  evaluateStreak,
  evaluateTotal,
  processCompletionForCampaigns,
  type EvaluateStreakInput,
  type EvaluateStreakResult,
  type EvaluateTotalInput,
  type EvaluateTotalResult,
  type ProcessCompletionInput,
  type CampaignFanoutResult,
} from './campaigns/index';
