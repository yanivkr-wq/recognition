/**
 * Kid "things that need me" — the single source of truth behind both the bell
 * badge (home header + OS app badge) and the notifications page list, so the
 * number on the bell always matches what the kid sees when they open it
 * (Lily: "bell says 8 but opening shows nothing — align with reality").
 *
 * Surfaces three live, actionable buckets for a player, scoped to their own
 * rows:
 *   - tasks   — today's daily tasks the kid can still act on: 'todo'
 *               (not started), 'needsPhoto' (done, awaiting their photo), or
 *               'denied' (needs a redo). Locked/awaiting-approval/done are
 *               intentionally excluded (nothing for the kid to do).
 *   - popup   — an active, not-yet-dismissed popup message (0 or 1).
 *   - news    — unread bell-channel notification_event rows (campaign/streak/…).
 *
 * `count` = tasks.length + (popup ? 1 : 0) + newsUnread, which is exactly what
 * both surfaces render.
 */

import 'server-only';
import { getPool } from '@reco/db';

const TZ = 'Asia/Jerusalem';

export type KidTaskItem = {
  assignmentId: string;
  title: string;
  kind: 'todo' | 'needsPhoto' | 'denied';
};

export interface KidAttention {
  tasks: KidTaskItem[];
  popup: { id: string; title: string | null; body: string } | null;
  newsUnread: number;
  count: number;
}

export async function getKidAttention(
  kidId: string,
  householdId: string,
  lang: 'he' | 'en',
): Promise<KidAttention> {
  const pool = getPool();

  const [taskRes, popupRes, newsRes] = await Promise.all([
    pool.query<{
      assignment_id: string;
      title_he: string;
      title_en: string;
      deadline_time: string | null;
      completion_id: string | null;
      approval_status: string | null;
      evidence_submission_id: string | null;
      now_il: string;
    }>(
      `WITH il AS (
         SELECT (now() AT TIME ZONE $2)::date AS today,
                to_char(now() AT TIME ZONE $2, 'HH24:MI:SS') AS now_il
       )
       SELECT ta.id AS assignment_id, tt.title_he, tt.title_en, tt.deadline_time,
              tc.id AS completion_id, tc.approval_status, tc.evidence_submission_id,
              (SELECT now_il FROM il) AS now_il
         FROM task_assignment ta
         JOIN task_template tt ON tt.id = ta.template_id
         LEFT JOIN task_completion tc
                ON tc.assignment_id = ta.id
               AND tc.completion_date = (SELECT today FROM il)
               AND tc.undone_at IS NULL
        WHERE ta.kid_id = $1 AND ta.enabled = true
          AND ta.archived_at IS NULL AND tt.archived_at IS NULL
          AND tt.kind = 'daily'
        ORDER BY tt.display_order, tt.title_he`,
      [kidId, TZ],
    ),
    pool.query<{ id: string; title: string | null; body: string }>(
      `SELECT pm.id, pm.title, pm.body
         FROM player_message pm
        WHERE pm.household_id = $1
          AND (pm.kid_id = $2 OR pm.kid_id IS NULL)
          AND pm.archived_at IS NULL
          AND (now() AT TIME ZONE $3)::date BETWEEN pm.start_date AND pm.end_date
          AND NOT EXISTS (
            SELECT 1 FROM player_message_dismissal d
             WHERE d.message_id = pm.id AND d.kid_id = $2
          )
        ORDER BY pm.created_at DESC
        LIMIT 1`,
      [householdId, kidId, TZ],
    ),
    pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM notification_event
        WHERE recipient_kid_id = $1 AND channel = 'bell' AND state = 'pending'`,
      [kidId],
    ),
  ]);

  const tasks: KidTaskItem[] = [];
  for (const r of taskRes.rows) {
    let kind: KidTaskItem['kind'] | null = null;
    if (!r.completion_id) {
      // No active completion today → still to do, unless past its deadline.
      const locked = r.deadline_time != null && r.now_il > r.deadline_time;
      if (!locked) kind = 'todo';
    } else if (r.approval_status === 'denied') {
      kind = 'denied';
    } else if (r.approval_status === 'pending' && !r.evidence_submission_id) {
      kind = 'needsPhoto';
    }
    // 'pending' with evidence (awaiting approval), 'approved'/'auto_approved'
    // (done) → nothing for the kid to do, so they don't count.
    if (kind) {
      tasks.push({
        assignmentId: r.assignment_id,
        title: lang === 'he' ? r.title_he : r.title_en,
        kind,
      });
    }
  }

  const popup = popupRes.rows[0] ?? null;
  const newsUnread = Number(newsRes.rows[0]?.n ?? 0);
  const count = tasks.length + (popup ? 1 : 0) + newsUnread;

  return { tasks, popup, newsUnread, count };
}
