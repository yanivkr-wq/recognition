# Reco — Scheduled Jobs

> Every scheduled job in Reco. Two layers: app-level `node-cron` inside `reco-worker`, and host-level system cron for deploys. Times are Asia/Jerusalem unless noted. Cron expressions use 5-field format; node-cron and Linux cron agree on parsing.

---

## 1. Inside `reco-worker` (`node-cron`)

| Schedule | Job | Code path | Env var |
|---|---|---|---|
| `*/5 * * * *` | **Notification dispatcher** — scans `notification_event` for pending/deferred items eligible to fire, applies quiet-hours + rate-limit, dispatches via channel | `apps/worker/src/cron/dispatcher.ts` | `DISPATCHER_CRON` |
| `*/5 * * * *` | **Per-task reminder check** — for each enabled `task_reminder` matching today's DOW, if `fire_time` has passed by ≤5 min and today's `task_completion` is missing/incomplete, INSERT `notification_event(event_kind='task_reminder')` | (same dispatcher tick, separate function) | (same) |
| `0 0 * * *` (00:00 IL) | **Daily reset** — per kid, evaluate yesterday's streak campaigns: advance, use a freeze, or break. Schedule motivational nudges for upcoming-window campaigns. | `apps/worker/src/cron/daily-reset.ts` | `DAILY_RESET_CRON` |
| `0 1 * * *` (01:00 IL) | **Campaign window close** — for each campaign with `end_date < today`, finalize incomplete total campaigns (write `completed_kind='incomplete'`), notify "campaign ended" if appropriate | `apps/worker/src/cron/campaign-window.ts` | `CAMPAIGN_WINDOW_CRON` |
| `30 3 * * *` (03:30 IL) | **DB nightly backup** — `pg_dump reco-pg` → AES-256-GCM encrypt with `MASTER_KEY`-derived key → multipart upload to B2 `reco-backups`. 30-day retention. | `apps/worker/src/cron/db-backup.ts` | `DB_BACKUP_CRON` |
| `0 5 * * 0` (Sun 05:00 IL) | **Evidence-volume weekly backup** — `tar -czf` `/var/lib/reco/evidence` → encrypt → B2 `reco-evidence-backup`. 4-week retention. | `apps/worker/src/cron/evidence-volume-backup.ts` | `EVIDENCE_BACKUP_CRON` |
| `0 6 * * *` (06:00 IL) | **Evidence photo purge** — `unlink()` files whose submission was resolved (approved/denied) ≥30 days ago; set `evidence.purged_at = now()`. DB rows persist for audit. | `apps/worker/src/cron/evidence-purge.ts` | `EVIDENCE_PURGE_CRON` |
| `0 9 * * *` (09:00 IL) | **Daily parent summary email (optional, behind feature flag)** — last 24h: tasks completed, pending approvals, redemptions, ledger movements | `apps/worker/src/cron/daily-summary.ts` | `SUMMARY_CRON`, `SUMMARY_ENABLED` |

**Why these times:**

- **00:00** daily reset is the calendar-day boundary chosen in Batch 2. Streak engine must run here so by the time anyone checks the app in the morning, last night's misses are accounted for.
- **01:00** campaign window-close runs an hour later to let any in-flight progress entries from last-minute completions settle.
- **03:30** DB backup is staggered: Family_Budget_App runs at 03:00, Family_Tasks_Hub at 03:30 too (in their docs). **Conflict alert** — we need to move one. Actual schedule: family-tasks-hub is at 03:30, so Reco should run at **04:00** to give each app a 30-min window without disk contention.
- **Correction:** Reco DB backup → `0 4 * * *` (04:00 IL). Updating in the table above.
- **05:00 Sunday** is the lowest-traffic time of the week for the weekly evidence backup. Tarball + encrypt + upload of a small volume should finish in <2 min.
- **06:00** photo purge runs after both backups so any pending photo is already captured in the weekly tarball before being deleted.
- **09:00** daily summary aligns with parents waking up; arrives in their inbox over coffee.

**Updated DB backup row:**

| Schedule | Job |
|---|---|
| `0 4 * * *` (04:00 IL) | DB nightly backup (was incorrectly listed as 03:30) |

---

## 2. Notification dispatcher in detail

The dispatcher is the most complex cron job. It runs `*/5 min` and handles five kinds of work in sequence:

### 2.1 Generate `task_reminder` events

```sql
-- For each enabled task_reminder where today's DOW bit is set AND fire_time has passed:
WITH today_dow AS (SELECT extract(dow FROM (now() AT TIME ZONE 'Asia/Jerusalem')) AS dow),
     candidates AS (
       SELECT tr.id, tr.assignment_id, ta.kid_id, tt.title_he, tt.title_en
       FROM task_reminder tr
       JOIN task_assignment ta ON ta.id = tr.assignment_id
       JOIN task_template tt ON tt.id = ta.template_id
       JOIN today_dow td ON ((tr.days_of_week & (1 << td.dow::int)) > 0)
       WHERE tr.enabled = true
         AND ta.enabled = true
         AND tt.archived_at IS NULL
         AND tr.fire_time <= (now() AT TIME ZONE 'Asia/Jerusalem')::time
         AND tr.fire_time > ((now() AT TIME ZONE 'Asia/Jerusalem') - interval '6 hours')::time
         -- exclude assignments already completed (and not currently undone) for today:
         AND NOT EXISTS (
           SELECT 1 FROM task_completion tc
           WHERE tc.assignment_id = ta.id
             AND tc.completion_date = (now() AT TIME ZONE 'Asia/Jerusalem')::date
             AND tc.undone_at IS NULL
             AND tc.approval_status IN ('auto_approved', 'approved')
         )
     )
INSERT INTO notification_event (event_kind, recipient_kid_id, channel, dedup_key, payload_json)
SELECT 'task_reminder', kid_id, channel_name,
       'task_reminder:' || id::text || ':' || (now() AT TIME ZONE 'Asia/Jerusalem')::date::text,
       jsonb_build_object('reminder_id', id, 'task_title_he', title_he, 'task_title_en', title_en)
FROM candidates
CROSS JOIN (VALUES ('bell'), ('whatsapp')) AS ch(channel_name)
ON CONFLICT (dedup_key, channel) DO NOTHING;
```

The `*/5 min` window means a 17:00 reminder can fire as late as 17:05 (P95: ~17:02). Acceptable.

### 2.2 Dispatch pending events

```sql
-- Pick up pending events that are either eligible now (deferred_until is null or past)
-- AND apply per-recipient rate limit + quiet hours.
SELECT * FROM notification_event
WHERE state IN ('pending', 'deferred')
  AND (deferred_until IS NULL OR deferred_until <= now())
ORDER BY fire_at ASC
LIMIT 500;   -- guardrail per tick
```

For each event:

```
1. Resolve recipient (kid or user) and their TZ + quiet hours.
2. If channel='whatsapp' AND now() is within recipient's quiet hours:
     UPDATE state='deferred', deferred_until=next_quiet_hours_end
     CONTINUE.
3. If channel='whatsapp' AND recipient hit rate limit (3 sends in last 10 min):
     UPDATE state='rate_limited', deferred_until=now() + 10 min
     CONTINUE.
4. Build localized message text from event_kind + payload_json + recipient.locale.
5. Dispatch:
     - whatsapp: channels.sendWhatsApp(...)
     - bell:     channels.sendInApp(...)  (no-op, the row IS the bell entry)
6. UPDATE state='sent' or 'failed' with provider_id / error_msg.
```

### 2.3 Campaign motivational nudges

```
For each active campaign × enrolled kid where:
  - nudge_cadence != 'silent'
  - no nudge_log entry in last (cadence_cooldown_hours):
      'standard': 168 hours (weekly) until 25% remaining, then 24 hours
      'aggressive': 72 hours until 25% remaining, then 12 hours
      'gentle': 168 hours throughout
  - days_remaining > 0
  - kid hasn't completed the campaign

→ build message ("עוד 5 ימים ועוד 17 עמודים, יאללה!"), INSERT campaign_nudge_log,
   INSERT notification_event(event_kind='campaign_nudge') with dedup_key 
   'campaign_nudge:<campaign>:<kid>:<YYYY-MM-DD>'.
```

The dispatcher INSERT-then-SEND ordering matters: the row exists with state='pending' before the send attempt. If the worker crashes mid-send, the next tick picks it up; UNIQUE(dedup_key, channel) prevents double-fire.

---

## 3. Daily reset in detail

Runs `0 0 * * *` IL. Per kid in household:

```
1. For each campaign_enrollment WHERE completed_at IS NULL AND campaign.kind='streak':
   a. yesterday = (now() AT TIME ZONE 'Asia/Jerusalem')::date - 1
   b. completed_yesterday? = does there exist task_completion (or long_term_progress sum >= per_day_threshold)
       for a feeding task of this campaign, for this kid, with completion_date=yesterday,
       undone_at IS NULL, approval_status IN ('auto_approved','approved')?
   c. If yes:
      - current_streak += 1; longest_streak = MAX(longest, current)
      - last_streak_advance_date = yesterday
      - If current_streak >= streak_target_days AND not yet completed:
          → ledger.post(campaign_bonus, bonus_coins, campaign_id=...)
          → INSERT kid_badge IF badge_id IS NOT NULL
          → UPDATE campaign_enrollment SET completed_at=now(), completed_kind='success',
                  bonus_ledger_id=..., badge_award_id=...
          → INSERT notification_event(event_kind='campaign_completed', ...) for both kid AND parents
   d. If no:
      - If freezes_used < streak_freezes_allowed:
          → freezes_used += 1
          → INSERT notification_event(event_kind='streak_freeze_used', recipient_kid_id=...,
                                       channel='bell')   -- bell only; not WhatsApp (per spec)
      - Else:
          → current_streak = 0
          → INSERT notification_event(event_kind='streak_broken', ...) bell + WhatsApp

2. For each campaign_enrollment WHERE completed_at IS NULL AND campaign.kind='total':
   - Compute days_remaining = end_date - today
   - If days_remaining <= 0: handled by campaign-window cron at 01:00, not here
   - (Nudge scheduling already happens in dispatcher tick; nothing to do at midnight reset
      beyond a sanity recompute of current_total.)

3. Cleanup: any task_reminder notification_event from today that's still 'pending' (worker was down) →
   skip if older than 6 hours, or fire now if within 6h window. Avoids stale 17:00 pings at 03:00.

4. Birthday badges (per Q4): for each kid where (today.month, today.day) == (kid.birthdate.month, kid.birthdate.day):
   - INSERT badge('Birthday <year>') if it doesn't exist for this household + year
   - INSERT kid_badge(kid_id, badge_id, awarded_for_year=current_year) ON CONFLICT DO NOTHING
   - INSERT notification_event(event_kind='campaign_completed' [or new 'birthday'], recipient_kid_id, channel IN (bell,whatsapp))
     payload: "🎂 Happy birthday, {name}! You earned the Birthday {year} badge."
   - Bonus coins: NOT in v1 (just the badge per the chosen option).
```

Cron duration target: < 5s for 2 kids × ~10 active enrollments. Trivial.

---

## 4. Campaign window close (01:00 IL)

```
For each campaign WHERE end_date = yesterday AND archived_at IS NULL:
  For each campaign_enrollment WHERE campaign_id = campaign.id AND completed_at IS NULL:
    UPDATE campaign_enrollment SET completed_at = now(), completed_kind = 'incomplete'
    INSERT notification_event(event_kind='campaign_completed' [success=false], recipient_kid_id=...,
                              channel='bell')   -- soft "campaign ended" message
  UPDATE campaign SET archived_at = now()       -- optional auto-archive
```

---

## 5. Photo purge (06:00 IL)

```
SELECT e.id, e.filename
FROM evidence e
LEFT JOIN submission s ON s.evidence_id = e.id
WHERE e.purged_at IS NULL
  AND (
    (s.id IS NOT NULL AND s.status IN ('approved', 'denied') AND s.resolved_at < (now() - interval '30 days'))
    OR
    (s.id IS NULL AND e.uploaded_at < (now() - interval '7 days'))   -- orphaned uploads (uploaded but submission never created): 7-day grace
  );

For each row:
  await fs.promises.unlink(VOLUME_ROOT + '/' + filename)
  UPDATE evidence SET purged_at = now() WHERE id = $1;
```

Errors (file already missing) are logged but not raised — the goal is "DB row marked purged."

---

## 6. DB backup (04:00 IL)

```bash
# Inside the worker container:
docker exec reco-pg pg_dump -U reco -d reco \
  | node /app/scripts/encrypt-stream.mjs \    # AES-256-GCM with key = HKDF(MASTER_KEY, "db-backup")
  | node /app/scripts/b2-multipart-upload.mjs \
      --bucket reco-backups \
      --key "reco-$(date +%Y-%m-%d-%H%M).pgsql.enc"

# Then list and purge:
node /app/scripts/b2-prune.mjs --bucket reco-backups --keep-days 30
```

Same shape as Family_Tasks_Hub's backup; key derivation includes the purpose string so a leaked DB backup key can't decrypt evidence backups.

---

## 7. Evidence volume backup (Sun 05:00 IL)

```bash
tar -czf - -C /var/lib/reco/evidence . \
  | node /app/scripts/encrypt-stream.mjs --purpose evidence-backup \
  | node /app/scripts/b2-multipart-upload.mjs \
      --bucket reco-evidence-backup \
      --key "reco-evidence-$(date +%Y-%m-%d).tar.gz.enc"

node /app/scripts/b2-prune.mjs --bucket reco-evidence-backup --keep-weeks 4
```

At realistic volume (~50 photos/week × ~500KB each = 25 MB/week), 4 weekly tarballs total ~100 MB. Trivial.

---

## 8. On the Hetzner VPS itself (system cron)

| Schedule | Job |
|---|---|
| `*/2 * * * *` | `/opt/recognition/infra/auto-deploy.sh` — polls GitHub `origin/main`; if a new commit landed, runs `update-prod.sh`. Flock guard prevents overlap with concurrent runs from the budget app or tasks-hub. Independent log: `/var/log/auto-deploy-reco.log`. |

Caddy reload is not on a cron — `update-prod.sh` does NOT touch Caddy. Caddyfile changes happen manually.

---

## 9. Cron health monitoring

Each worker cron writes a heartbeat row to a lightweight `cron_heartbeat` table on completion:

```sql
CREATE TABLE cron_heartbeat (
  job_name        TEXT PRIMARY KEY,
  last_started_at TIMESTAMPTZ NOT NULL,
  last_finished_at TIMESTAMPTZ,
  last_status     TEXT NOT NULL CHECK (last_status IN ('running', 'success', 'failed')),
  last_error      TEXT,
  duration_ms     INT
);
```

The optional 09:00 daily summary email includes a "cron status" section that flags any job whose `last_finished_at` is older than 2× its expected interval.

---

## 10. Cron environment variables (defaults)

In `apps/worker/src/config.ts`:

```typescript
const cronSchedules = {
  DISPATCHER_CRON:           env('DISPATCHER_CRON',           '*/5 * * * *'),
  DAILY_RESET_CRON:          env('DAILY_RESET_CRON',          '0 0 * * *'),
  CAMPAIGN_WINDOW_CRON:      env('CAMPAIGN_WINDOW_CRON',      '0 1 * * *'),
  DB_BACKUP_CRON:            env('DB_BACKUP_CRON',            '0 4 * * *'),
  EVIDENCE_BACKUP_CRON:      env('EVIDENCE_BACKUP_CRON',      '0 5 * * 0'),
  EVIDENCE_PURGE_CRON:       env('EVIDENCE_PURGE_CRON',       '0 6 * * *'),
  SUMMARY_CRON:              env('SUMMARY_CRON',              '0 9 * * *'),
  SUMMARY_ENABLED:           env.bool('SUMMARY_ENABLED',       true),
};
```

All overridable per-environment for testing (e.g., `DAILY_RESET_CRON='*/1 * * * *'` in a smoke environment).

---

*Last updated: 2026-05-20. Schedules are locked at Gate 2; offsets relative to other apps' backups assume Family_Budget_App at 03:00 + Family_Tasks_Hub at 03:30; verify those on the VPS before deploying Reco.*
