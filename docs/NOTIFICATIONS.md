# Reco — Notifications Design

> Event → channel → recipient routing. Quiet-hours behavior. Rate-limit behavior. Localized templates. Companion to `CRON.md` (which describes the dispatcher tick mechanics) and `SCHEMA.md` (`notification_event`, `notification_preferences`).

---

## 1. Channel set

| Channel | Mechanism | Tax | Reliability |
|---|---|---|---|
| `bell` | DB row in `notification_event` with `channel='bell'`; kid/parent's PWA polls or live-fetches recent events; bell badge shows unread count | Free | Always succeeds (no I/O) |
| `whatsapp` | Twilio REST API `POST /Messages.json` from `apps/worker/src/notifications/channels.ts:sendWhatsApp` | ~$0.005-0.02/msg | Depends on Twilio + recipient opt-in |

In v1 there is no email channel for kid/parent events (the only outbound email is the optional 09:00 daily parent summary).

---

## 2. Event taxonomy + routing table

The matrix below is the authoritative routing table. Every row in `notification_event` matches one event_kind and one recipient class. Cells with both b and w fire two `notification_event` rows (one per channel), deduped by `(dedup_key, channel)`.

| Event kind | Trigger | Recipient(s) | Bell | WhatsApp | Localized template |
|---|---|---|---|---|---|
| `task_reminder` | Dispatcher tick, per active `task_reminder` row whose fire_time has passed and today's task is incomplete | Kid (the assignee) | ✅ | ✅ | "⏰ Lia, time to do הומוורק!" / "⏰ זמן להומוורק" |
| `submission_pending` | Kid submits a task that requires approval | Both parents | ✅ | ✅ | "📷 Lia submitted homework — approve or deny" / "Lia שלחה שעורי בית — אישור/דחייה" |
| `submission_approved` | Parent approves a pending submission | Kid (the submitter) | ✅ | ✅ | "✅ Mom approved! +20 coins. Balance: 47" / "✅ אמא אישרה! +20 מטבעות. יתרה: 47" |
| `submission_denied` | Parent denies a pending submission | Kid | ✅ | ✅ | "❌ Mom needs another photo: {reason}. You can resubmit." / "❌ אמא רוצה תמונה אחרת: {סיבה}" |
| `new_redeem_item` | Admin creates a new visible-to-kids reward | Both kids | ✅ | ✅ | "🎁 New reward: {title}! Costs {cost} coins" / "🎁 פרס חדש: {שם}!" |
| `campaign_nudge` | Cadence cooldown elapsed for an active campaign | Enrolled kid | ✅ | ✅ | "🏃 {N} days left to finish {campaign}. You need {M} more {unit}!" / "🏃 נותרו {N} ימים…" |
| `campaign_completed` (success) | Streak hit target / total hit target | Kid + both parents (parents bell-only) | ✅ | ✅ for kid; ✅ bell for parents | "🏅 You won {campaign}! +{bonus} coins + {badge}" / "🏅 ניצחת!" |
| `campaign_completed` (incomplete) | Total campaign end_date reached without success | Kid only | ✅ | ❌ | "Campaign ended. Good try!" — bell-only (don't WhatsApp a loss) |
| `streak_freeze_used` | Daily reset consumed a freeze | Kid | ✅ | ❌ | "Streak freeze used — you have {N-used} left" — bell-only |
| `streak_broken` | Daily reset broke a streak | Kid | ✅ | ✅ | "Streak ended on day {N}. Start a new one tomorrow!" |
| `redemption_received` | Either party marks a redemption received | Bell to both parents; no WhatsApp | ✅ | ❌ | "Lia received: Candy" |
| `redemption_refunded` | Admin refunds a redemption | Kid | ✅ | ❌ | "Mom refunded {N} coins for {item} — reason: {reason}" |
| `admin_wallet_adjustment` | Admin credits or debits the kid's wallet manually | Kid | ✅ | ❌ | "Mom added +5 coins — reason: {reason}" / "Mom subtracted -3 — reason: {reason}" |
| `sibling_badge_earned` | Yael earns a badge → notify Lia (and vice versa) | The OTHER kid | ✅ | ❌ | "Yael earned the {badge}! Check it out 👀" — bell-only |

**Total WhatsApp routes:** task_reminder, submission_pending (×2 parents), submission_approved, submission_denied, new_redeem_item (×2 kids), campaign_nudge, campaign_completed (success only) — matches what Lily picked in Batch 5 plus the new task-reminder feature.

**Bell-only rules of thumb:**

- "Loss" events (streak break, campaign incomplete) get bell only — don't twist the knife via WhatsApp.
- Routine confirmations (received, sibling badge) are bell-only — would be noise on WhatsApp.
- Admin actions to the kid's wallet are bell-only — they're informational; the parent already communicated the reason in real life.

---

## 3. Quiet hours

### Default per-recipient

| Principal | quiet_hours_start | quiet_hours_end |
|---|---|---|
| Parent | 21:00 | 07:00 |
| Kid (effective) | inherits household default = 21:00 / 07:00 |

Override per-user in `/admin/settings/profile`. Per-kid override is deferred to v1.5 (currently uses household default; see `SCHEMA.md` §10).

### Behavior

For every `notification_event` row about to fire on the WhatsApp channel:

```typescript
const recipient = await loadRecipient(event);
const now = new Date();
const nowLocal = utcToZonedTime(now, recipient.tz);
const startLocal = parseTimeOfDay(recipient.quiet_hours_start);
const endLocal = parseTimeOfDay(recipient.quiet_hours_end);

if (isInQuietWindow(nowLocal, startLocal, endLocal)) {
  const resumeAt = nextOccurrenceLocal(endLocal, recipient.tz);  // returns UTC of next 07:00 local
  await db.update(notificationEvent)
    .set({ state: 'deferred', deferred_until: resumeAt })
    .where(eq(notificationEvent.id, event.id));
  return;  // dispatcher picks it up at the next eligible tick after resumeAt
}

// proceed with channel send
```

**Bell** events fire immediately regardless of quiet hours — they're silent in the recipient's PWA; the bell badge just increments. WhatsApp queues + resumes.

### Edge cases handled

- Event crosses midnight: `quiet_hours_start > quiet_hours_end` (e.g., 21:00 → 07:00). `isInQuietWindow` treats this as "in window if now ≥ start OR now < end."
- Multiple events stack up overnight: at 07:00 they all become eligible. The rate limiter prevents a flood — see §4.
- Time zone change (DST): Asia/Jerusalem observes DST; the comparison is always in local TZ via `date-fns-tz`. No edge cases in practice.

---

## 4. Rate limiting

A per-recipient + per-channel sliding window guards against floods. Default:

| Channel | Window | Max sends |
|---|---|---|
| `whatsapp` | 10 minutes | 3 |
| `bell` | — | unlimited |

The dispatcher consults a small in-memory counter (worker-resident; if worker restarts, the counter resets — acceptable failure mode):

```typescript
// apps/worker/src/notifications/rate-limiter.ts
const sends: Map<string /* recipient key */, number[]> = new Map();
// key = `${channel}:${userId || kidId}`

export function shouldRateLimit(key: string, now: number): boolean {
  const window = sends.get(key) ?? [];
  const fresh = window.filter(t => now - t < 10 * 60 * 1000);
  sends.set(key, fresh);
  return fresh.length >= 3;
}

export function recordSend(key: string, now: number) {
  const window = sends.get(key) ?? [];
  window.push(now);
  sends.set(key, window);
}
```

When `shouldRateLimit` is true:

```typescript
await db.update(notificationEvent)
  .set({ state: 'rate_limited', deferred_until: new Date(now + 10 * 60 * 1000) })
  .where(eq(notificationEvent.id, event.id));
```

The deferred event is reconsidered on the next `*/5 min` tick. If the recipient is still hot, it defers again; this is a slow trickle, not a hard block.

**Why in-memory and not DB-side**: simplicity. A DB-backed counter would survive restarts but adds a hot row on every send. With one worker instance and 2-3 recipients, in-memory is sufficient.

---

## 5. Localized templates

Templates live in `apps/worker/src/notifications/templates.he.ts` and `templates.en.ts`:

```typescript
// templates.he.ts
import type { NotificationPayload } from '@reco/shared/types';

export const heTemplates = {
  task_reminder: (p: NotificationPayload<'task_reminder'>) =>
    `⏰ זמן ל${p.taskTitleHe}, ${p.kidName}!`,

  submission_pending: (p: NotificationPayload<'submission_pending'>) =>
    `📷 ${p.kidName} שלחה ${p.taskTitleHe} לאישור — ` +
    `${p.appUrl}/admin/approvals/${p.submissionId}`,

  submission_approved: (p: NotificationPayload<'submission_approved'>) =>
    `✅ ${p.approverName} אישרה! +${p.coinsEarned} מטבעות. יתרה: ${p.newBalance}`,

  submission_denied: (p: NotificationPayload<'submission_denied'>) =>
    `❌ ${p.approverName} ביקשה לשלוח שוב — ${p.denyReason}`,

  new_redeem_item: (p: NotificationPayload<'new_redeem_item'>) =>
    `🎁 פרס חדש: ${p.titleHe}! עולה ${p.coinCost} מטבעות`,

  campaign_nudge_streak: (p: NotificationPayload<'campaign_nudge'>) =>
    `🔥 רצף של ${p.currentStreak} ימים ב"${p.campaignTitleHe}". ` +
    `עוד ${p.daysRemaining} ימים והפרס שלך!`,

  campaign_nudge_total: (p: NotificationPayload<'campaign_nudge'>) =>
    `🏃 ב"${p.campaignTitleHe}" צברת ${p.currentTotal}/${p.targetTotal}. ` +
    `נותרו ${p.daysRemaining} ימים.`,

  campaign_completed: (p: NotificationPayload<'campaign_completed'>) =>
    `🏅 ניצחת ב"${p.campaignTitleHe}"! +${p.bonusCoins} מטבעות${p.badgeName ? ' + תג ' + p.badgeNameHe : ''}`,

  streak_broken: (p: NotificationPayload<'streak_broken'>) =>
    `הרצף נקטע ביום ${p.lastStreakDay}. מחר זה התחלה חדשה 💪`,
};
```

EN versions mirror the HE. The dispatcher selects the language from the recipient's `locale` column.

**Why one template per event in each language, not interpolation in a single shared string**: keeps RTL/LTR sentence structure natural in each language. Hebrew "מחר זה התחלה חדשה" doesn't translate to "tomorrow is a new beginning" with the same emotional weight — the EN version says "let's start fresh tomorrow." Per-language craft.

---

## 6. URL shortener / deep links

WhatsApp messages with long URLs look ugly and may trip Twilio length limits. Reco includes a tiny redirect: `reco.my-restart.co.il/g/<token>` redirects to the actual deep link (`/admin/approvals/<id>`, `/redeem/<id>`, etc.). The token is a 12-char base62 random ID stored in a `short_link` table:

```sql
CREATE TABLE short_link (
  token       TEXT PRIMARY KEY,
  target_path TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES household(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  hit_count   INT NOT NULL DEFAULT 0
);
```

The dispatcher generates one on event creation if the message includes a link. The route checks expiry, increments `hit_count`, redirects. Tokens expire after 30 days for one-time approval links; never for sticky links like `/admin/audit`.

**Optional in v1** — if you'd rather skip and use full URLs, that's fine; WhatsApp does support long URLs and message char limit (1600) is plenty.

---

## 7. Failure handling

| Failure | Behavior |
|---|---|
| Twilio returns 4xx (bad phone, opt-out, etc.) | `state='failed'`, `error_msg` stored. Do NOT retry. Surface in bell + admin audit. |
| Twilio returns 5xx or network error | `state='failed'`, `deferred_until = now + 5 min`. Next tick retries. After 3 retries → permanent fail. |
| Bell write fails (DB error) | Bubble up; the surrounding transaction rolls back. |
| Localization missing for an event_kind in a locale | Fall back to EN. Log a warning to Sentry; missing string is a bug worth fixing. |

---

## 8. Bell UI behavior

The bell (a popover dropdown on the kid/parent home screen):

- Polls `/api/notifications/recent` every 30 seconds when the app is open, OR uses an SSE feed (deferred to v1.5).
- Shows last 30 bell events (`channel='bell'`, recipient matches session).
- Click on a bell row marks `read_at`; UNREAD count is `WHERE read_at IS NULL`.
- A bell row may carry a deep link (same `short_link` as WhatsApp) for the same one-tap navigation.
- "Mark all read" button at the top.
- Filters in admin bell: by event_kind, by kid.

Bell rows are NOT purged. They accumulate; admin can run `/api/admin/bell/purge` to clear rows older than 90 days if disk pressure builds. (At 2-kid scale, ~10k events/year × ~100 bytes/row = 1 MB/year. Not a real concern.)

---

## 9. Per-event matrix summary (TL;DR)

| Event | Recipient | Channels | Note |
|---|---|---|---|
| task_reminder | Kid | bell + WhatsApp | Per Lily's Batch 5 add |
| submission_pending | Parents (×2) | bell + WhatsApp | FCFS approval flow |
| submission_approved | Kid | bell + WhatsApp | |
| submission_denied | Kid | bell + WhatsApp | with reason |
| new_redeem_item | Kids (×2) | bell + WhatsApp | |
| campaign_nudge | Kid | bell + WhatsApp | cadence-throttled |
| campaign_completed (success) | Kid + Parents (bell only) | bell + WhatsApp (kid) | |
| campaign_completed (incomplete) | Kid | bell only | no salt in the wound |
| streak_freeze_used | Kid | bell only | informational |
| streak_broken | Kid | bell + WhatsApp | small-stakes habit nudge |
| redemption_received | Parents (×2) | bell only | FYI |
| redemption_refunded | Kid | bell only | with reason |
| admin_wallet_adjustment | Kid | bell only | with reason |
| sibling_badge_earned | Other kid | bell only | competition fuel |

---

*Last updated: 2026-05-20. The routing matrix is locked at Gate 2.*
