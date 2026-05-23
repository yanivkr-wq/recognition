/**
 * Process a kid's completion event against every active campaign that
 * feeds off the completed template.
 *
 * Called by:
 *   - completeTaskAction (Phase 3) when a daily task completion lands
 *   - logProgressOperation (Phase 4) when a long-term progress row lands
 *
 * For each enrollment whose campaign feeds off the templateId:
 *   1. Evaluate streak / total engine for the kid (re-derives from data).
 *   2. UPDATE campaign_enrollment cache fields (current_streak,
 *      freezes_used, current_total, last_streak_advance_date).
 *   3. If completedNow:
 *      a. ledger.post('campaign_bonus', +bonus_coins, campaignId)
 *      b. INSERT kid_badge if campaign.badge_id is set (with
 *         source_campaign_id wired). NULLS NOT DISTINCT on the UNIQUE
 *         constraint enforces "earn once."
 *      c. UPDATE enrollment with completed_at, completed_kind='success',
 *         bonus_ledger_id, badge_award_id.
 *      d. INSERT campaign_completed bell notification_event for the kid.
 *      e. INSERT sibling_badge_earned events for every OTHER kid in the
 *         household.
 *
 * All four side effects happen inside the caller's transaction so the
 * coin event and the campaign event commit atomically. If something
 * inside this function throws, the entire originating action rolls back.
 *
 * Notification dispatch is deferred to Phase 8; we just write the event
 * rows with state='pending' here. The dispatcher tick picks them up.
 */

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ledgerPost, type PostedEntry } from '../ledger/post';
import { evaluateStreak, type EvaluateStreakResult } from './streak-engine';
import { evaluateTotal, type EvaluateTotalResult } from './total-engine';

export interface ProcessCompletionInput {
  kidId: string;
  householdId: string;
  templateId: string;
  /** "Today" in IL date (YYYY-MM-DD). The caller usually passes the
   *  completion's completion_date / progress_date — same calendar day. */
  asOfDate: string;
}

export interface CampaignFanoutResult {
  campaignId: string;
  kind: 'streak' | 'total';
  /** New cache values written to campaign_enrollment. */
  currentStreak?: number;
  freezesUsed?: number;
  currentTotal?: number;
  completedNow: boolean;
  brokeNow?: boolean;
  bonusLedgerEntry?: PostedEntry;
  badgeAwardId?: string | null;
}

interface EnrollmentRow {
  campaign_id: string;
  enrollment_id: string;
  kind: 'streak' | 'total';
  badge_id: string | null;
  bonus_coins: number;
  completed_at: Date | null;
  prior_current_streak: number;
}

export async function processCompletionForCampaigns(
  client: PoolClient,
  input: ProcessCompletionInput,
): Promise<CampaignFanoutResult[]> {
  // 1. Find every active enrollment whose campaign feeds off this template.
  //    "Active" = not yet completed_at AND not archived AND inside its
  //    date window (asOfDate within [start_date, end_date]).
  const enrolls = await client.query<EnrollmentRow>(
    `SELECT
       c.id                AS campaign_id,
       e.id                AS enrollment_id,
       c.kind              AS kind,
       c.badge_id          AS badge_id,
       c.bonus_coins       AS bonus_coins,
       e.completed_at      AS completed_at,
       e.current_streak    AS prior_current_streak
     FROM campaign_enrollment e
     JOIN campaign c              ON c.id = e.campaign_id
     JOIN campaign_feeding_task f ON f.campaign_id = c.id
     WHERE e.kid_id        = $1
       AND e.household_id  = $2
       AND f.template_id   = $3
       AND e.completed_at IS NULL
       AND c.archived_at  IS NULL
       AND c.start_date <= $4::date
       AND c.end_date   >= $4::date`,
    [input.kidId, input.householdId, input.templateId, input.asOfDate],
  );

  const out: CampaignFanoutResult[] = [];

  for (const e of enrolls.rows) {
    if (e.kind === 'streak') {
      const evalRes = await evaluateStreak(client, {
        kidId: input.kidId,
        campaignId: e.campaign_id,
        asOfDate: input.asOfDate,
      });
      await client.query(
        `UPDATE campaign_enrollment
            SET current_streak           = $1,
                longest_streak           = GREATEST(longest_streak, $1),
                freezes_used             = $2,
                last_streak_advance_date = CASE WHEN $1 > 0 THEN $3::date ELSE last_streak_advance_date END
          WHERE id = $4`,
        [evalRes.currentStreak, evalRes.freezesUsed, input.asOfDate, e.enrollment_id],
      );
      const result = await maybeComplete(client, input, e, evalRes.completedNow);
      out.push({
        campaignId: e.campaign_id,
        kind: 'streak',
        currentStreak: evalRes.currentStreak,
        freezesUsed: evalRes.freezesUsed,
        completedNow: result.completedNow,
        brokeNow: evalRes.brokeNow,
        bonusLedgerEntry: result.bonusLedgerEntry,
        badgeAwardId: result.badgeAwardId,
      });
    } else {
      const evalRes = await evaluateTotal(client, {
        kidId: input.kidId,
        campaignId: e.campaign_id,
        asOfDate: input.asOfDate,
      });
      await client.query(
        `UPDATE campaign_enrollment SET current_total = $1 WHERE id = $2`,
        [evalRes.currentTotal, e.enrollment_id],
      );
      const result = await maybeComplete(client, input, e, evalRes.completedNow);
      out.push({
        campaignId: e.campaign_id,
        kind: 'total',
        currentTotal: evalRes.currentTotal,
        completedNow: result.completedNow,
        bonusLedgerEntry: result.bonusLedgerEntry,
        badgeAwardId: result.badgeAwardId,
      });
    }
  }

  return out;
}

interface MaybeCompleteResult {
  completedNow: boolean;
  bonusLedgerEntry?: PostedEntry;
  badgeAwardId?: string | null;
}

async function maybeComplete(
  client: PoolClient,
  input: ProcessCompletionInput,
  e: EnrollmentRow,
  shouldComplete: boolean,
): Promise<MaybeCompleteResult> {
  if (!shouldComplete) return { completedNow: false };

  // Post the campaign_bonus ledger entry. Zero-bonus campaigns skip the
  // ledger but still trip the completion + badge.
  let bonusLedgerEntry: PostedEntry | undefined;
  if (e.bonus_coins > 0) {
    bonusLedgerEntry = await ledgerPost(client, {
      kind: 'campaign_bonus',
      householdId: input.householdId,
      kidId: input.kidId,
      amount: e.bonus_coins,
      campaignId: e.campaign_id,
    });
  }

  // Award badge if the campaign has one. NULLS NOT DISTINCT on
  // (kid_id, badge_id, awarded_for_year) enforces earn-once. Use
  // ON CONFLICT DO NOTHING so a re-run of the cron doesn't blow up
  // — the engine's completedNow flag is the gate.
  let badgeAwardId: string | null = null;
  if (e.badge_id) {
    const bRes = await client.query<{ id: string }>(
      `INSERT INTO kid_badge (kid_id, badge_id, source_campaign_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [input.kidId, e.badge_id, e.campaign_id],
    );
    badgeAwardId = bRes.rows[0]?.id ?? null;
  }

  await client.query(
    `UPDATE campaign_enrollment
        SET completed_at     = now(),
            completed_kind   = 'success',
            bonus_ledger_id  = $1,
            badge_award_id   = $2
      WHERE id = $3`,
    [bonusLedgerEntry?.id ?? null, badgeAwardId, e.enrollment_id],
  );

  // Audit row — the household sees campaign completions in /admin/audit.
  await client.query(
    `INSERT INTO audit_log (
       household_id, actor_kid_id, action, target_kind, target_id, after_json
     ) VALUES (
       $1, $2, 'campaign.completed', 'campaign', $3, $4
     )`,
    [
      input.householdId,
      input.kidId,
      e.campaign_id,
      JSON.stringify({
        bonus_coins: e.bonus_coins,
        bonus_ledger_id: bonusLedgerEntry?.id ?? null,
        badge_award_id: badgeAwardId,
      }),
    ],
  );

  // Notification events: campaign_completed for the kid + sibling_badge_earned
  // for the others. Bell channel only; the Phase 8 dispatcher picks up
  // state='pending' and decides what to do. dedup_key prevents double-write
  // if the engine ever re-evaluates the same completion (it shouldn't, but
  // defense in depth — the `completed_at` IS NULL check above is the primary
  // guard).
  await client.query(
    `INSERT INTO notification_event (
       household_id, event_kind, recipient_kid_id, channel,
       dedup_key, payload_json
     ) VALUES (
       $1, 'campaign_completed', $2, 'bell',
       $3, $4
     )
     ON CONFLICT (dedup_key, channel) DO NOTHING`,
    [
      input.householdId,
      input.kidId,
      `campaign_completed:${e.campaign_id}:${input.kidId}`,
      JSON.stringify({
        campaign_id: e.campaign_id,
        bonus_coins: e.bonus_coins,
        badge_award_id: badgeAwardId,
      }),
    ],
  );
  if (e.badge_id) {
    // Sibling fan-out. Bell-only — the kid who EARNED the badge sees the
    // campaign_completed event; siblings see a separate sibling-celebration
    // line on their bell.
    await client.query(
      `INSERT INTO notification_event (
         household_id, event_kind, recipient_kid_id, channel,
         dedup_key, payload_json
       )
       SELECT $1, 'sibling_badge_earned', sib.id, 'bell',
              'sibling_badge_earned:' || $2 || ':' || sib.id::text,
              $3
         FROM kid sib
        WHERE sib.household_id = $1
          AND sib.id <> $4
          AND sib.archived_at IS NULL
       ON CONFLICT (dedup_key, channel) DO NOTHING`,
      [
        input.householdId,
        e.campaign_id,
        JSON.stringify({
          campaign_id: e.campaign_id,
          earner_kid_id: input.kidId,
          badge_id: e.badge_id,
        }),
        input.kidId,
      ],
    );
  }

  void randomUUID; // reserved for future inline UUID use
  return { completedNow: true, bonusLedgerEntry, badgeAwardId };
}
