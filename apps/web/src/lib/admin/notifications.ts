/**
 * Admin notification counts (Lily's request: "a bell that shows how many
 * things need my approval, like a normal app").
 *
 * Aggregates the three things a parent actually needs to act on, scoped to
 * the household:
 *   - approvals  — task/long-term submissions awaiting review (status='pending')
 *   - redemptions — rewards redeemed but not yet handed over (pending_delivery)
 *   - feedback   — in-app feedback not yet triaged (status='new')
 *
 * One round-trip via correlated subselects. The same shape feeds both the
 * server-rendered initial badge (admin layout) and the polled JSON route
 * (app/api/admin/notifications) that keeps the badge live without a refresh.
 */

import 'server-only';
import { getPool } from '@reco/db';

export interface AdminNotificationCounts {
  approvals: number;
  redemptions: number;
  feedback: number;
  total: number;
}

export async function getAdminNotificationCounts(
  householdId: string,
): Promise<AdminNotificationCounts> {
  const { rows } = await getPool().query<{
    approvals: number;
    redemptions: number;
    feedback: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM submission
          WHERE household_id = $1 AND status = 'pending') AS approvals,
       (SELECT count(*)::int FROM redemption
          WHERE household_id = $1 AND status = 'pending_delivery') AS redemptions,
       (SELECT count(*)::int FROM feedback
          WHERE household_id = $1 AND status = 'new') AS feedback`,
    [householdId],
  );
  const r = rows[0] ?? { approvals: 0, redemptions: 0, feedback: 0 };
  const approvals = Number(r.approvals);
  const redemptions = Number(r.redemptions);
  const feedback = Number(r.feedback);
  return {
    approvals,
    redemptions,
    feedback,
    total: approvals + redemptions + feedback,
  };
}
