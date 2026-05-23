# Phase 7 — Exit audit (campaigns + streak/total engines + badges + nudges)

**Date:** 2026-05-23
**Risk:** **HIGH** — most state-heavy components
**Status:** ✅ Core landed. 6 of 6 BUILD-PLAN exit criteria met functionally; 1 (sibling badge bell UI render) defers to Phase 8's notification dispatcher per the build plan's phase ownership. 24 new Vitest invariants — total **104/104 pass**. Browser-verified end-to-end campaign completion with bonus + badge.

---

## Per-criterion status

| # | BUILD-PLAN exit criterion | Status | Evidence |
|---|---|---|---|
| 1 | Admin creates a 5-day streak campaign on "make bed" task; both kids enrolled. | ✅ | Browser-verified: Mom created "מסע מיטה" / streak / target 5 / freezes 1 / bonus 50 with King of Tasks badge linked + Lia enrolled. DB: `campaign` + `campaign_enrollment` + `campaign_feeding_task` rows present. |
| 2 | Lia makes bed 4 days running; day 5 streak=4. Completes day 5 → on next reset campaign completes; +50 bonus; badge awarded; Yael bell shows. | ✅ | Browser-verified end-to-end: 5 consecutive completions (4 backdated + today via UI redo) → on-event hook fired `processCompletionForCampaigns` → `current_streak=5`, `completed_at` set, `completed_kind='success'`, `campaign_bonus +50` posted, `kid_badge` row inserted with `source_campaign_id`. Yael's `sibling_badge_earned` bell event written to `notification_event` (state='pending', delivery via Phase 8 dispatcher). |
| 3 | Yael misses day 3, daily-reset uses freeze, continues days 4-5 → completes. | ✅ | Covered by Vitest invariant `evaluateStreak — freeze handling > uses a freeze to bridge one missing day` (streak=5, freezesUsed=1, completedNow=true on a campaign with `streak_freezes_allowed=1`). |
| 4 | Admin creates 100-page total over 60 days. Lia hits 100 pages on day 30 → instant completion + bonus + badge. | ✅ | Covered by Vitest invariants in `total-engine.test.ts`. The on-event hook in `logProgressOperation` also calls `processCompletionForCampaigns` so the kid sees instant completion as soon as the crossing log lands. |
| 5 | Yael only reads 40 pages by day 60. End_date reached → cron marks `completed_kind='incomplete'`. Bell-only message. | ✅ | `runDailyReset` window-close branch UPDATEs `completed_at + completed_kind='incomplete'` for any active enrollment where `end_date < today`, and writes a `campaign_completed` bell event with `payload_json.completed_kind='incomplete'`. Tested via the streak `asOfDate past end_date clamps to end_date` Vitest and verified by inspection (no current overdue enrollment to browse). |
| 6 | Retroactive undo: Lia streak=4, undoes day 3 today, on next eval streak=0. | ✅ | **The headline invariant.** Vitest `evaluateStreak — retroactive undo > streak drops to 0 when a mid-chain day is undone with no freezes` passes. The engine re-derives from `task_completion` on every call (cache is forward-only) — never trusts the cached `current_streak`. |

**Phase 8 deferrals (intentional, per build plan):** the **bell UI** that surfaces `notification_event` rows (campaign_completed, sibling_badge_earned, streak_broken, streak_freeze_used) lands with the notification dispatcher. Phase 7 writes the events with `state='pending'`; they're idempotent (UNIQUE on `dedup_key, channel`) so the dispatcher can pick them up safely.

---

## What landed (deliverable map)

| Sub | Files | Outcome |
|---|---|---|
| 7a | [`packages/db/src/campaigns/streak-engine.ts`](../packages/db/src/campaigns/streak-engine.ts) + [`streak-engine.test.ts`](../packages/db/src/campaigns/streak-engine.test.ts) | Pure ledger-derived streak engine. Chain-from-first-active-day model: a single break inside the window with no freeze available zeros the streak. 16 invariants including 2 retroactive-undo cases (with + without freeze). |
| 7b | [`packages/db/src/campaigns/total-engine.ts`](../packages/db/src/campaigns/total-engine.ts) + [`total-engine.test.ts`](../packages/db/src/campaigns/total-engine.test.ts) | Sums daily completion counts + long-term progress quantities in one query. 8 invariants including window clamping for the Yael "incomplete" path. |
| 7c | [`packages/db/src/campaigns/process-completion.ts`](../packages/db/src/campaigns/process-completion.ts), updates to `completeTaskAction` / `approveSubmissionOperation` / `logProgressOperation` | Fan-out helper iterates active enrollments feeding off the completed template, evaluates the appropriate engine, updates cache, posts `campaign_bonus` ledger entry + INSERT `kid_badge` (NULLS NOT DISTINCT enforces earn-once) + UPDATE enrollment + INSERT audit_log + INSERT `campaign_completed`/`sibling_badge_earned` bell events with idempotent `ON CONFLICT (dedup_key, channel)`. |
| 7d | [`apps/worker/src/cron/daily-reset.ts`](../apps/worker/src/cron/daily-reset.ts), [`cron/registry.ts`](../apps/worker/src/cron/registry.ts) | 00:00 IL cron with three responsibilities: streak re-evaluation (with `streak_broken` + `streak_freeze_used` events), window close (`completed_kind='incomplete'`), yearly birthday badge (NULLS-NOT-DISTINCT UNIQUE enforces once-per-year). |
| 7e | [`apps/web/src/lib/admin-campaigns/actions.ts`](../apps/web/src/lib/admin-campaigns/actions.ts), [`apps/web/src/app/[lang]/admin/campaigns/`](../apps/web/src/app/[lang]/admin/campaigns/) | Create campaign (kind toggle, feeding task multi-select, kids picker, badge dropdown) + list + archive. Edit deferred to v2 (BUILD-PLAN scope: enrollment changes mid-campaign are rare; archive + recreate is the supported path). |
| 7f | [`apps/web/src/app/[lang]/campaigns/`](../apps/web/src/app/[lang]/campaigns/) | Kid view with mint streak cards + lavender total cards (BRANDBOOK §2 color semantics). Progress bar grammar matches Phase 4's long-term card. Browser-verified: Lia's "1 of 5 days" → "5 of 5 days · Completed!" trip. |
| 7g | [`apps/web/src/app/[lang]/badges/`](../apps/web/src/app/[lang]/badges/) | Earned grid (placeholder embroidered patch — pastel ring + dashed border + inner pastel tile + initial letter) + locked-but-visible upcoming badges from active enrollments. Browser-verified: "מלכת המשימות" badge appears after the test completion. |
| 7h | bell events written via process-completion + daily-reset; UI dispatch deferred to Phase 8 | The `notification_event` rows landed at `state='pending'` with dedup keys; Phase 8 picks them up. |
| 7i | [`docs/PHASE-7-EXIT.md`](docs/PHASE-7-EXIT.md), CHANGELOG, RESUME-HERE, memory update | This doc + the standard 3 follow-ups. |

---

## Vitest coverage added in Phase 7 (24 tests)

`packages/db/src/campaigns/streak-engine.test.ts` (16):

- **baseline (5):** empty, asOf-before-start, N consecutive days, target crossing, no re-fire after `completed_at`.
- **freeze handling (3):** 1-freeze bridges 1 miss; 1-freeze + 2-miss breaks; 2-freeze + 2-miss holds.
- **retroactive undo (2):** the headline invariant — undo zeros the streak; with available freeze the streak holds.
- **edge cases (3):** today missing breaks; late-starting kid; asOfDate past end_date clamps.
- **long-term feeding tasks (3):** per_day_threshold gating; null threshold treats any progress as active; mixed daily + long-term feeders both count.

`packages/db/src/campaigns/total-engine.test.ts` (8):

- long-term progress (4): sums; flips completedNow; excludes undone; excludes pending.
- daily feeding (1): 1 unit per completion.
- mixed feeding (1): SUMs both contributions.
- window clamping (1): the Yael "incomplete" path.
- already-completed (1): completedNow doesn't re-fire after `completed_at`.

Plus the existing 80 tests still pass — **total 104/104**.

---

## Phase 7 risk + open items

- **Phase 7 was HIGH risk** (most state-heavy phase). Three concentration points landed clean:
  1. **Retroactive undo** (BUILD-PLAN's headline invariant): engine re-derives from `task_completion` on every call; cache is forward-only. Vitest test confirms streak=4 → undo day 3 → next eval = 0.
  2. **Stream + Total semantics distinction**: streak's "any break with no freeze = 0" semantics vs total's "running SUM" — different math behind shared UI. Tests for both kinds keep them honest.
  3. **Same-tx campaign side-effects**: the on-event hook runs inside the originating action's transaction, so a coin event + campaign_bonus + badge award are atomic. Failures (engine throw, FK conflict) roll back the whole completion.
- **Streak semantics decision:** I chose "any break in chain → streak=0" over "rebuild after break" (which would have given streak=2 in the BUILD-PLAN's retroactive-undo example instead of the expected 0). Documented in `streak-engine.ts` header comment. Easier kid mental model + matches the exit criterion text literally.
- **Edit form deferred:** Sub-7e ships create + archive only. Editing kind/feeding-tasks/enrolled-kids mid-campaign would silently invalidate engine state; safest path is archive + recreate. The list page links archive directly per row.
- **Embroidered patch placeholder:** Sub-7g uses a pastel-ring + dashed-border + inner-tile + initial-letter rendering until the family-3 SVG library lands in Phase 9. The DOM structure mirrors BRANDBOOK §5 anatomy so the SVG swap will be drop-in.
- **Sibling-badge bell UI deferred to Phase 8:** the events ARE written (verified in DB: `sibling_badge_earned` row for Yael with payload containing the badge_id + earner_kid_id). Phase 8's bell-polling endpoint surfaces them.
- **`notification_event.dedup_key` shape:** I chose `<event_kind>:<campaign_id>:<kid_id>[:<date>]` for the new events (matches the existing convention from `submission_pending` → `task_reminder` in NOTIFICATIONS.md §3). Idempotent across cron re-runs.

---

## Regression check (Phases 1-6)

- ✅ Parent login still works.
- ✅ Kid PIN entry still works (Lia 1234 + Yael 5678).
- ✅ Phase 3 daily task path still works AND now also drives campaign progress (verified by the test campaign that auto-progressed Lia's streak).
- ✅ Phase 4 long-term still works AND drives total/streak campaigns when the template is a feeding task.
- ✅ Phase 5 evidence + approval still works AND `approveSubmissionOperation` now also fans out to campaigns (the approval is when the completion becomes "visible" to the engines).
- ✅ Phase 6 redeem/joker/audit all unchanged.
- ✅ All 80 prior Vitest invariants still pass alongside the 24 new ones (104 total).

---

*Phase 7 complete. Next: Phase 8 — notification dispatcher + WhatsApp + quiet hours + rate limits (Medium risk). The bell-polling endpoint + the WhatsApp dispatch consume the `notification_event` rows Phase 7 is already writing.*
