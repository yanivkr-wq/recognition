/**
 * @reco/shared/types
 *
 * Domain types shared between web, worker, and packages/db.
 * Database row shapes live in @reco/db (Drizzle-generated); this file is
 * for cross-cutting types like principals, locales, and view-model shapes.
 */

import type { Locale } from '../i18n/index';

// ──────────────────────────────────────────────────────────────────────────────
// Authentication principals (ARCHITECTURE §8)
// ──────────────────────────────────────────────────────────────────────────────

export type PrincipalKind = 'admin' | 'kid' | 'anonymous';

export interface AdminPrincipal {
  kind: 'admin';
  userId: string;
  householdId: string;
  name: string;
  email: string;
  locale: Locale;
}

export interface KidPrincipal {
  kind: 'kid';
  kidId: string;
  householdId: string;
  name: string;
  nameHe: string;
  locale: Locale;
  avatarSymbol: string; // e.g., 'av-fox', 'av-bunny'
  primaryColor: string;
}

export type Principal = AdminPrincipal | KidPrincipal;

// ──────────────────────────────────────────────────────────────────────────────
// Ledger entry kinds (SCHEMA §7)
// ──────────────────────────────────────────────────────────────────────────────

export type LedgerEntryKind =
  | 'earn'
  | 'campaign_bonus'
  | 'redeem'
  | 'redemption_refund'
  | 'admin_credit'
  | 'admin_debit'
  | 'undo';

// ──────────────────────────────────────────────────────────────────────────────
// Campaign kinds
// ──────────────────────────────────────────────────────────────────────────────

export type CampaignKind = 'streak' | 'total';
export type CampaignNudgeCadence = 'standard' | 'aggressive' | 'gentle' | 'silent';

// ──────────────────────────────────────────────────────────────────────────────
// Task kinds
// ──────────────────────────────────────────────────────────────────────────────

export type TaskKind = 'daily' | 'long_term';
export type ApprovalStatus = 'auto_approved' | 'pending' | 'approved' | 'denied';

// ──────────────────────────────────────────────────────────────────────────────
// Notification routing
// ──────────────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'whatsapp' | 'bell';
export type NotificationState =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'skipped'
  | 'deferred'
  | 'rate_limited';

export type NotificationEventKind =
  | 'task_reminder'
  | 'submission_pending'
  | 'submission_approved'
  | 'submission_denied'
  | 'new_redeem_item'
  | 'campaign_nudge'
  | 'campaign_completed'
  | 'streak_freeze_used'
  | 'streak_broken'
  | 'redemption_received'
  | 'redemption_refunded'
  | 'admin_wallet_adjustment'
  | 'sibling_badge_earned'
  | 'birthday';
