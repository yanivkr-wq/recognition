# Reco — Build Plan (v1)

> Phased breakdown of the v1 build. Each phase is independently shippable in the sense that the deployed app remains useful after the phase ends (even if subsequent surfaces aren't there yet). Sizes are rough developer-effort estimates assuming Claude pair-programming. Phase boundaries are commitments; intra-phase task order is guidance. If a phase grows beyond +50% of estimate, surface that immediately.

---

## Phase legend

| Symbol | Meaning |
|---|---|
| **S** | Small — 1-2 days of focused work |
| **M** | Medium — 3-5 days |
| **L** | Large — 6-10 days |

## Phase summary

| # | Phase | Size | Risk | Independently shippable? |
|---|---|---|---|---|
| 1 | Foundations + parent auth + Caddy fragment | M | Low | Yes — parent login over HTTPS, no app features yet |
| 2 | Kid auth (Netflix-picker + PIN) + device trust | M | **Medium** | Yes — kid can log in, no app surface yet beyond a home placeholder |
| 3 | Tasks + assignments + completions + wallet ledger | **L** | **High** | Yes — fully functional daily task tracker for both kids |
| 4 | Long-term tasks + progress logging + ledger integration | M | Medium | Yes — adds long-term tasks to the mix |
| 5 | Evidence upload + approval flow | **L** | **High** | Yes — homework photos work end-to-end |
| 6 | Rewards + redemption + joker admin | M | Medium | Yes — kids can spend; parents can adjust |
| 7 | Campaigns + badges + nudges | **L** | **High** | Yes — full gameplay |
| 8 | Notification dispatcher + WhatsApp + quiet hours + rate limits | M | Medium | Yes — alerts fire as designed |
| 9 | Bilingual polish + design system + PWA install + observability | M | Low | **Launch.** |

**Total estimate:** 6-9 weeks at consistent pace. Calendar weeks may stretch.

**Three high-risk phases (3, 5, 7):** ledger integrity, photo handling for minors, and the streak/total engines + nudge cadence. Each gets explicit mitigations below.

---

## Phase 1 — Foundations + parent auth

**Size:** M. **Risk:** Low. **Heaviest item:** adding a third subdomain to host Caddy without breaking the two existing apps.

### Goals

Stand up the app's skeleton on the existing VPS without breaking budget or tasks-hub. Get parent login working at `https://reco.my-restart.co.il`.

### Tasks

1. **New GitHub repo** `recognition`, push initial scaffold.
2. **pnpm workspace** with `apps/web`, `apps/worker`, `packages/db`, `packages/shared`, `infra/`, `scripts/`. Root `tsconfig.base.json`, `.prettierrc`, `.editorconfig`, `.nvmrc`.
3. **Next.js 16** in `apps/web` (App Router, Turbopack, Tailwind 4, React 19). Minimal `[lang]/layout.tsx` + `[lang]/page.tsx` stub.
4. **Fastify 5** in `apps/worker` with health endpoint, pino logger, Zod config.
5. **DNS:** add A record `reco.my-restart.co.il` → VPS IP (Box DNS panel).
6. **Caddy fragment** in `infra/Caddyfile.fragment` for `reco.my-restart.co.il` (web + worker reverse proxy). Append to host Caddyfile via `deploy-prod.sh`. **Cutover test:** budget + tasks both still reachable post-reload.
7. **Docker Compose** for the new app: `reco-web`, `reco-worker`, `reco-pg` (ICU `he-IL` at `initdb`). Reco-evidence named volume. No Caddy in this compose file.
8. **Migration runner** in worker boot: applies `0001_init.sql` ... etc. against `reco-pg`. Tracks via `__migrations`.
9. **Drizzle schema** in `packages/db/src/schema/` mirroring `SCHEMA.md`. Type-only; no runtime queries beyond `getDb()`.
10. **Auth.js v5** wired in web: email + password (Argon2), DB sessions. Port `auth.config.ts` pattern from family-tasks-hub. Login page at `/[lang]/login`. `AUTH_TRUST_HOST=true`. **Parents only.**
11. **`deploy-prod.sh`** (idempotent first-install) — prompts for everything in §11 of `ARCHITECTURE.md`. Seeds household + 2 parents + 2 kids (without PINs — those are set in Phase 2) + 6 sample tasks + 6 sample rewards + 8 starter badges.
12. **`auto-deploy.sh` + `update-prod.sh`** for this repo. Add cron line `*/2 * * * *` to VPS crontab. Configure separate log file `/var/log/auto-deploy-reco.log`.
13. **i18n minimum:** middleware locale negotiation, `[lang]/dictionaries.ts` typed loader, `he.json` + `en.json` with just enough strings for login.
14. **Health endpoints:** `/api/health` on web, `/healthz` on worker. Smoke tests in `update-prod.sh`.

### Entry criteria

- You've decided on a Caddy migration window (≤10 min during which both other apps may have a brief blip on Caddyfile reload). Worst-case rollback: revert the Caddyfile fragment + `caddy reload`.
- DNS A record provisioned.

### Exit criteria

- [ ] `https://reco.my-restart.co.il/he/login` loads with valid LE cert.
- [ ] `https://budget.my-restart.co.il/` and `https://tasks.my-restart.co.il/` still load.
- [ ] Both parents can log in to Reco.
- [ ] `git push` to `recognition:main` triggers auto-deploy within 4 min.
- [ ] `psql reco-pg \dt` shows all 23 tables + `__migrations`.
- [ ] Sample-seed data is present: 6 tasks, 6 rewards, 8 badges, 2 kids without PINs.

---

## Phase 2 — Kid auth (Netflix-picker + PIN) + device trust

**Size:** M. **Risk:** Medium. This is net-new auth code with security implications. Don't take shortcuts.

### Goals

A kid lands at `https://reco.my-restart.co.il/`, picks their profile, enters PIN, gets a kid-session JWT. Optionally remembers the device.

### Tasks

1. **`kid` and `device_trust` tables** migrations applied.
2. **`apps/web/src/lib/kid-auth.ts`:**
   - `verifyPin(kidId, pin, deviceFp)` — Argon2 compare, lockout enforcement, audit-log on success/failure.
   - `issueKidSession(kid, deviceFp)` — short-lived signed JWT (24h), HttpOnly + SameSite=Lax cookie `reco-kid-session`.
   - `issueDeviceTrust(kid, deviceFp, label)` — write `device_trust` row, return raw token to set as a 90-day HttpOnly cookie `reco-kid-trust`.
   - `verifyDeviceTrust(cookie, kidId)` — hash + lookup + expiry + UA fingerprint sanity check.
3. **Middleware extension:** on every request, resolve principal:
   - parent-session cookie present + valid → `Principal = Admin`
   - kid-trust cookie present + valid → issue fresh kid-session, `Principal = Kid`
   - kid-session cookie present + valid → `Principal = Kid`
   - else → `Principal = Anonymous`, redirect appropriately.
4. **`/[lang]/pick` page** (profile picker UI): server-renders kid cards (name, avatar, color). Tap → `/[lang]/pick/[slug]` (PIN entry). Both kids visible to anyone on a clean device.
5. **PIN entry UI:** 4 large digit buttons, oversized for thumbs, vibration on tap (Web Vibration API), error animation on wrong PIN, "remember this device for [Kid]" checkbox.
6. **PIN setup flow** for the parent in admin: `/admin/kids/<id>/pin` — set/reset a kid's PIN. Required after seed.
7. **Rate-limit middleware:** 5 wrong PINs / 15 min per (kid_id, device_fp) → `pin_locked_until = now() + 15 min`. Kid sees friendly "ask a parent to reset" message.
8. **Device-trust management UI** in admin: `/admin/kids/<id>/devices` — list devices, revoke button.
9. **Logout flow:** kid taps "switch user" → clears kid-session cookie, keeps trust cookie (so re-pick + PIN-skip works).
10. **Tests:**
    - Vitest: PIN hash round-trip, lockout after 5 fails, trust cookie verify, expiry behavior.
    - Playwright: end-to-end pick + PIN + remember-this-device + close-browser + reopen → skipped-PIN entry.

### Entry criteria

- Phase 1 exit criteria met.
- Both kids' initial PINs decided (parents pick during this phase).

### Exit criteria

- [ ] Lia can open the app, tap her profile, enter PIN, land at `/[lang]/` (placeholder kid home).
- [ ] Yael same.
- [ ] "Remember this device" works: close browser, reopen, tap profile, no PIN required, lands on home.
- [ ] Parent can revoke a trusted device; the same browser then requires PIN again.
- [ ] 5 wrong PINs → 15-min lockout; lockout-expiry → fresh PIN attempts work.
- [ ] Parent login still works in parallel.
- [ ] All Phase 1 smoke tests still pass.

### Risks & mitigations

- **JWT key rotation**: signing with `AUTH_SECRET` (single key, no rotation in v1). If the secret leaks, all kid sessions invalidate on next deploy with a new secret. Document.
- **Trust cookie theft**: bound to UA fingerprint (coarse — accepts minor browser updates) AND requires DB row match. Stolen cookie alone is useless. If a parent suspects theft, revoke from admin.
- **PIN brute force**: 4-digit space (10⁴) with 5/15min rate limit = 13 hours of constant attack to exhaust. Acceptable given the threat model (someone with physical access to the kid's tablet).

---

## Phase 3 — Tasks + assignments + completions + wallet ledger

**Size:** L. **Risk:** **HIGH** — ledger correctness is the financial center of the app.

### Why this is the riskiest phase

1. First introduction of the append-only ledger pattern. Bugs here corrupt every downstream feature (wallet display, streak engine, campaigns).
2. Concurrency: kid double-taps, race conditions across same-day undo + re-complete.
3. The partial unique index on `task_completion(assignment_id, completion_date) WHERE undone_at IS NULL` is the single integrity point — any code path that bypasses it must be caught.
4. Streak engine derives from this data; if Phase 3 is wrong, Phase 7 is wrong.

### Goals

Kid sees their daily task list. Taps "I did it" → coins land in wallet immediately (for tasks not requiring evidence). Same-day undo + redo works correctly. Admin can view ledger.

### Tasks

1. **`packages/db/src/schema/*` migrations** through `task_template`, `task_assignment`, `task_completion`, `ledger_entry`.
2. **`apps/worker/src/ledger/post.ts`** — the ONLY ledger writer. Wraps in a serializable transaction. Computes balance_after. Validates invariants.
3. **Vitest suite for ledger**: invariants test, balance derivation, clamp-to-zero behavior, undo reversal, retroactive recompute.
4. **Server action: `completeTask(assignmentId)`**:
   - `requireKid()` + assignment kid ownership check
   - `INSERT task_completion` (partial unique enforces single-active-row-per-day)
   - If `template.evidence_required` is false → `ledger.post(earn, template.coin_value)`
   - Else → flow continues to Phase 5
5. **Server action: `undoTaskCompletion(completionId)`**:
   - `requireKid()` + ownership
   - Verify same calendar day (else fail)
   - `UPDATE task_completion SET undone_at = now()`
   - `ledger.post(undo, -original_amount, undo_of_entry_id=...)` — only if the original `ledger_credit_id` is set (no-op for pending-evidence completions)
6. **Server action: `redoTaskCompletion(assignmentId)`** (after an undo same day):
   - Same as `completeTask`. A new row with `undone_at IS NULL` for the same date.
7. **Kid home page** (`/[lang]/page.tsx`):
   - Wallet balance (large, animated on change)
   - Today's task list (assigned, daily kind only): each card with title, icon, coin reward, status (todo / done with undo button / done-pending-evidence stub).
   - Empty state if no tasks assigned.
8. **Wallet history page** (`/[lang]/wallet`): scrollable list of ledger entries, with timestamps + reason for admin entries.
9. **Admin: task templates** (`/admin/tasks`): list of templates, create/edit/archive. Bilingual fields. Form validates the daily/long_term CHECK constraint.
10. **Admin: assignments** (`/admin/tasks/[id]/assign`): toggle each kid on/off for the template.
11. **Admin: ledger view per kid** (`/admin/kids/[id]/ledger`): full history, joker action button leads to Phase 6.

### Entry criteria

- Phase 2 exit criteria met.

### Exit criteria

- [ ] Lia can complete the seeded "make bed" task; her wallet increments correctly; the ledger has a single `earn` entry.
- [ ] Lia taps undo within 1 min; wallet returns to previous balance; ledger has 2 entries (earn + undo).
- [ ] Lia re-completes the same task on the same day; wallet credits again; ledger has 3 entries (earn, undo, earn).
- [ ] Across midnight: yesterday's completion remains valid in history; today's slot is fresh.
- [ ] Both kids can complete the same template independently; ledgers are isolated.
- [ ] All Phase 1-2 smoke tests still pass.
- [ ] Ledger Vitest suite: 100% pass on invariants (no negative display, no double-credit, undo reversal correct, partial-unique respects undone rows).

### Risks & mitigations

- **Race-condition on double-tap "I did it"**: optimistic UI shows "done!" immediately, but the second request hits the partial unique constraint and the second action becomes a no-op (kid sees "already done"). Verify with a Playwright test simulating two clicks 50ms apart.
- **Streak engine dependency**: nothing in Phase 3 should denormalize completion state. The streak engine in Phase 7 will derive from the table; if Phase 3 stores a parallel "streak counter" it's a footgun.
- **`balance_after` denorm drift**: assert via Vitest after every ledger insert that `balance_after == SUM(amount) WHERE kid_id=... AND created_at <= row.created_at`. Verify via a periodic dev-only sanity check.

---

## Phase 4 — Long-term tasks + progress logging

**Size:** M. **Risk:** Medium.

### Goals

Long-term tasks (e.g., "read 100 pages") work: kid logs progress, coins accrue per unit, bonus on goal hit.

### Tasks

1. **`long_term_progress` migration**.
2. **Server action: `logProgress(assignmentId, quantity)`** — INSERT, ledger.post earn for `quantity × per_unit_coins`. If running total ≥ goal: ledger.post bonus, mark assignment as completed in some way (no schema field for this yet — add `task_assignment.long_term_completed_at`?). Or: the campaign engine handles it via a feeding-task campaign — but a long-term task is NOT a campaign by default. Decision: add `task_assignment.long_term_completed_at` column.
3. **`long_term_progress` undo** — symmetric to task_completion undo.
4. **Kid UI for long-term**: progress bar, "+N" entry field, history of today's entries.
5. **Admin: long-term task template editor** with goal + per-unit + bonus fields.

### Entry criteria

Phase 3 exit criteria met.

### Exit criteria

- [ ] Kid can log "+5 pages" against the "Read 100 pages" task. 5 coins land immediately.
- [ ] Repeated logging accumulates. At cumulative quantity ≥ 100, bonus coins land via a separate `earn` ledger entry (or `campaign_bonus` if part of a campaign).
- [ ] Undo of a progress row reverses the per-unit coins only (bonus stays if previously earned and not consumed by goal recomputation). **Open question** — what happens if a kid logs +5 → bonus fires → kid undoes the +5? Expected: total drops below goal, bonus is reversed too. This is a Phase 4 edge case to design + test.

---

## Phase 5 — Evidence upload + approval flow

**Size:** L. **Risk:** **HIGH** — minors' photos, FCFS approval concurrency, photo serving security.

### Why high risk

1. Minors' photos require careful handling — leaking these is a much worse incident than a regular data leak.
2. FCFS approval is genuinely concurrent — two parents racing. The optimistic UPDATE must be airtight.
3. Photo serving must enforce authorization on every byte request.
4. Volume mounts + photo writes from Next.js are unusual; need to verify perms.

### Goals

Lia submits homework with a photo, both parents get a WhatsApp ping, one approves, Lia sees the approval, coins land.

### Tasks

1. **`submission` + `evidence` tables migrations.**
2. **Worker route `GET /api/internal/evidence/:id`** — session check (kid for own, admin for any) → stream file from volume → Content-Type, Cache-Control: private,no-store.
3. **Evidence-volume mount on both `reco-web` and `reco-worker`** in docker-compose.
4. **Server action: kid submission upload** — multipart receive, write to volume with sane filename pattern (`/var/lib/reco/evidence/YYYY/MM/DD/<uuid>.<ext>`), INSERT evidence + submission rows, write a temp ledger placeholder OR keep ledger uninvolved until approval (simpler — go with the latter).
5. **Admin approval queue** (`/admin/approvals`):
   - Lists submissions WHERE status='pending' ORDER BY submitted_at DESC.
   - Click a row → side panel with photo, task info, kid info, approve/deny buttons.
   - Approve: optimistic UPDATE (rowcount check); on rowcount=0 show "already resolved by Mom 2 min ago."
   - Deny: requires reason text field.
6. **On approve:** INSERT task_completion (or update existing pending one with approval_status='approved'), `ledger.post(earn)`, INSERT `notification_event(submission_approved)` for the kid.
7. **On deny:** UPDATE submission status, INSERT `notification_event(submission_denied)`. Kid UI shows "submit again" → creates a new submission with `resubmit_of_submission_id`.
8. **Camera + gallery upload UI** for kid: `<input type="file" accept="image/*" capture="environment">`. Single file, max 10MB (enforce in server action).
9. **Loading + error states**: submission in flight, approval pending UI, denial reason display.
10. **Worker cron: evidence-purge** (06:00 IL) — actual `unlink` + `purged_at` update.
11. **Worker cron: evidence-volume-backup** (Sun 05:00 IL) — tar + encrypt + B2.
12. **Vitest: FCFS race test** — fire two simultaneous approvals; assert one succeeds, one returns "already resolved."

### Entry criteria

Phase 4 exit criteria met. (Or skip Phase 4 if photos go in Phase 3 — they don't, since Phase 3 only handles non-evidence tasks.)

### Exit criteria

- [ ] Lia submits homework with a photo from her phone's camera. Photo lands on volume. Bell/WhatsApp pings both parents.
- [ ] Parent 1 approves; Lia's WhatsApp pings the result; her wallet credits 20 coins.
- [ ] Parent 2 tries to approve the same one; UI shows "already resolved."
- [ ] Photo serves only to Lia + parents; cookie-less curl returns 401.
- [ ] After 30 days post-approval, the photo file is gone from the volume; the `evidence` row still exists with `purged_at` set.
- [ ] Weekly evidence-volume backup runs successfully; manual restore drill succeeds.
- [ ] No 5xx errors visible in Sentry on the upload+approve path under a 50-iteration Playwright loop.

### Risks & mitigations

- **Photo directory perms**: 0700 on `/var/lib/reco/evidence/`, owned by the worker's UID. Web container's UID must match (set in Dockerfile).
- **Filename injection**: never accept client-supplied filenames; always generate `<uuid>.<safe_ext>` on server.
- **Cache poisoning**: every photo response gets `Cache-Control: private, no-store`. PWA's minimal SW does not cache anyway, but defense-in-depth.
- **Disk space**: 30-day photo retention + 4-week backup retention = bounded. Worst case ~250 MB. Monitor via daily summary email.

---

## Phase 6 — Rewards + redemption + joker admin

**Size:** M. **Risk:** Medium.

### Goals

Kid spends coins, redemption tracker shows status, parent marks received, joker UI works end-to-end.

### Tasks

1. **`reward_item` + `redemption` migrations.**
2. **Server action: `redeem(rewardItemId)`** — verify spendable balance ≥ cost, stock available, max_per_kid_per_day not exceeded; INSERT redemption with snapshot fields + `ledger.post(redeem, -cost, redemption_id)` in one transaction.
3. **Kid redeem page** (`/[lang]/redeem`): grid of reward cards (visible_to_kids=true), large icon, title, cost. Inactive (greyed) if cost > balance or per-day cap hit.
4. **Kid redemption tracker** (`/[lang]/redeem/history`): pending_delivery items at the top with "tap when you've got it" button; received items below.
5. **Server action: `markReceived(redemptionId)`** — kid OR admin; UPDATE status='received', received_at, received_by_*.
6. **Server action: `adminCancelRedemption(redemptionId, reason)`** — admin only; UPDATE status='cancelled', `ledger.post(redemption_refund, +cost)`.
7. **Server action: `adminRefundRedemption(redemptionId, reason)`** — admin only; same shape, status='refunded'.
8. **Admin redeem queue** (`/admin/redemptions`): list pending_delivery, click → action panel (mark received, cancel, refund).
9. **Admin: reward CRUD** (`/admin/rewards`): create/edit/archive, image upload, stock + per-day cap.
10. **Joker wallet UI** (`/admin/kids/[id]/wallet/adjust`): pick credit or debit, amount, reason. Submit → `ledger.post(admin_credit|admin_debit, ...)` + INSERT audit_log + INSERT `notification_event(admin_wallet_adjustment, channel='bell')` for the kid.
11. **Audit feed** (`/admin/audit`): household-wide audit_log view with filters.

### Entry criteria

Phase 5 exit criteria met.

### Exit criteria

- [ ] Lia redeems candy (2 coins). Wallet -2; redemption shows pending_delivery.
- [ ] Lia taps "got it" → status='received'. Parent's bell shows the receipt.
- [ ] Admin tries to cancel a received redemption — UI blocks (only pending_delivery cancellable, OR allows refund as a different action).
- [ ] Joker adds +5 coins to Yael with reason "extra dish duty." Yael's wallet +5; her bell shows "Mom added +5 coins — extra dish duty."
- [ ] Joker tries to debit Yael -100 with balance 30. Wallet displays 0 (clamped). Ledger has `admin_debit -100`, `clamped_amount=70`. Both parents see the audit.

---

## Phase 7 — Campaigns + badges + nudges

**Size:** L. **Risk:** **HIGH** — streak engine + total engine + nudge cadence are the most state-heavy components.

### Why high risk

1. The streak engine must be ledger-driven (per Batch 2 decision), not flag-driven. Bugs here let kids cheat.
2. Total campaigns and streak campaigns share UI but have different math; easy to confuse.
3. Nudge cadence is a UX feature with a tight margin: too few = unhelpful; too many = annoying. Hard to tune without real data.
4. The 1-freeze-default decision needs to thread through the entire UI ("you have 1 freeze remaining" surfacing).

### Goals

Admin creates a streak campaign and a total campaign. Both kids auto-enrolled (or admin enrolls). Daily reset advances streaks. Nudges fire. Completion awards bonus + badge.

### Tasks

1. **`badge`, `campaign`, `campaign_feeding_task`, `campaign_enrollment`, `campaign_nudge_log`, `kid_badge` migrations.**
2. **Streak engine** (`apps/worker/src/campaigns/streak-engine.ts`):
   - `evaluateStreak(kidId, campaignId, today)` — returns `{ currentStreak, freezesUsed, completedNow, brokeNow }`.
   - Walks back day-by-day from `today` against `task_completion`/`long_term_progress` (filtered) for feeding tasks.
   - On a miss after today: tries freeze, else breaks.
3. **Total engine** (`apps/worker/src/campaigns/total-engine.ts`):
   - `evaluateTotal(kidId, campaignId)` — computes running total via SUM, returns `{ currentTotal, completedNow }`.
4. **Daily-reset cron** invokes streak engine per enrollment.
5. **On-completion engine invocation** in server actions (`completeTask`, `logProgress`): for any feeding campaign of this template, call appropriate engine, write campaign_enrollment updates, post bonus ledger entry if completed.
6. **Nudge cadence engine** in dispatcher tick (per `NOTIFICATIONS.md` §2.3).
7. **Admin: campaign CRUD** (`/admin/campaigns`): create form with kind=streak/total, fields per kind, feeding task picker (multi-select task_template), enrolled kids picker, badge picker.
8. **Kid: active campaigns view** (`/[lang]/campaigns`): cards per active enrollment showing progress (streak chain for streak, progress bar for total, days remaining, motivational text).
9. **Kid: badges page** (`/[lang]/badges`): grid of earned badges + locked-but-visible upcoming badges from active campaigns.
10. **"Sibling badge earned" notifications:** when one kid completes a campaign that awards a badge, notify the other kid bell-only.
11. **Tests:**
   - Vitest: streak advance, freeze use, break, retroactive break (yesterday's undo today).
   - Vitest: total accumulation, early completion, end-date incomplete.
   - Vitest: nudge cadence — fires at correct cooldown; doesn't fire if recent nudge exists.

### Entry criteria

Phase 6 exit criteria met.

### Exit criteria

- [ ] Admin creates a 5-day streak campaign on "make bed" task; both kids enrolled.
- [ ] Lia makes her bed 4 days running. On day 5 morning, streak = 4. Lia completes day 5 → on next reset (00:00), campaign completes; Lia's wallet +50 bonus; badge awarded; Yael's bell shows "Lia earned the Bed Master badge!".
- [ ] Yael misses day 3. Daily reset: freeze used (`freezes_used = 1`). Yael continues days 4-5 → completes (no further freezes needed). Day 5 reset → bonus + badge.
- [ ] Admin creates a 100-page "Read a book" total campaign over 60 days. Lia logs progress over 30 days, hits 100 pages on day 30 → instant completion + bonus + badge.
- [ ] Yael enrolls but only reads 40 pages by day 60. End_date reached → 01:00 cron marks `completed_kind='incomplete'`. Bell-only "campaign ended" message.
- [ ] Retroactive undo: Lia has streak=4. Lia undoes day 3 today (day 5). On next daily-reset evaluation, streak should be 0 (broken on day 3 from the perspective of derivation). Tested.

---

## Phase 8 — Notification dispatcher + WhatsApp + quiet hours + rate limits

**Size:** M. **Risk:** Medium — first time WhatsApp actually fires; opt-in coordination needed.

### Goals

All event_kinds from `NOTIFICATIONS.md` fire to the correct channels with correct localization, respecting quiet hours and rate limits.

### Tasks

1. **`channels.ts` rewrite** in `apps/worker/src/notifications/`: `sendWhatsApp` (direct Twilio fetch), `sendEmail` (nodemailer), `sendInApp` (no-op).
2. **`templates.he.ts` + `templates.en.ts`** with all event_kind localizations.
3. **`dispatcher.ts`** in `apps/worker/src/cron/`: implements the matrix in `NOTIFICATIONS.md` §9.
4. **`quiet-hours.ts`**: TZ-aware quiet window check, defer scheduling.
5. **`rate-limiter.ts`**: in-memory sliding window per (channel, recipient).
6. **Bell polling endpoint** `/api/notifications/recent` for the bell UI.
7. **Bell UI** components (kid + admin variants).
8. **WhatsApp opt-in** docs in `deploy-prod.sh` and `README.md`: how parents/kids send `join <code>` to the Sandbox number.
9. **Phone overrides for testing**: env var `WHATSAPP_DRY_RUN=true` short-circuits to console.log; useful in dev.

### Entry criteria

Phase 7 exit criteria met. Twilio Sandbox WhatsApp credentials in `.env`.

### Exit criteria

- [ ] All 13 event_kinds from `NOTIFICATIONS.md` fire correctly (bell + WhatsApp where matrix says).
- [ ] Quiet hours: a `submission_pending` event at 22:30 lands as a bell entry immediately; WhatsApp fires at 07:00 next morning.
- [ ] Rate limit: 5 rapid completions by Lia at 16:00 → first 3 WhatsApp acks fire; 4th and 5th queue → rate_limited; trickle out over the next 20 min.
- [ ] Both kids' phones (or parents' phones if kids don't have WhatsApp) opted in via `join <code>`.
- [ ] Bell shows correct unread counts; "mark all read" works.
- [ ] All Phase 1-7 smoke tests still pass.

---

## Phase 9 — Bilingual polish + design system + PWA install + observability — LAUNCH

**Size:** M. **Risk:** Low.

### Goals

The app is ready for daily use. Both languages polished. PWA installs cleanly. Observability is in place.

### Tasks

1. **Design system applied** (per the chosen concept from Gate 3): colors, typography, spacing tokens, component primitives.
2. **i18n second-pass**: every UI string in dictionaries. No hardcoded strings.
3. **RTL audit**: every page in both `dir="rtl"` and `dir="ltr"` modes. Fix any clipped text, misaligned icons, wrong logical properties.
4. **PWA install banner**: triggers after first task completion (kid app); on parent login (admin app). Dismissible.
5. **Two PWA manifests** (or one with `id` + `start_url` distinguishing kid vs admin) — TBD, depends on Gate 3 design.
6. **Service worker**: minimal pass-through. Update banner on `controllerchange`.
7. **Icon generation**: `scripts/generate-icons.mjs` from a single SVG source.
8. **Sentry SDK** (web + worker). `beforeSend` strips kid names, emails, phones, evidence filenames.
9. **Smoke tests in `update-prod.sh`**: curl health + a couple of high-value invariants ("ledger sum equals balance for each kid").
10. **`README.md` runbook**: how to reset a kid's PIN, how to restore a backup, how to add a new authorized phone.
11. **`TESTING.md` / `QA-V1.md`**: full end-to-end checklist.

### Entry criteria

- Phase 8 exit criteria met.
- Gate 3 design approved + applied through Phases 3-8 surfaces.

### Exit criteria — also the **v1 launch checklist**

- [ ] All Phase 1-8 exit criteria still pass.
- [ ] Two kids' PWAs installed on their own devices; admin PWA on parent's phone.
- [ ] At least one full lifecycle observed in the last 48h: task → completion → coins → redeem → received.
- [ ] At least one approval flow observed end-to-end (kid submission → parent ping → approval → kid wallet credit).
- [ ] At least one campaign completed by each kid (streak + total).
- [ ] Sentry connected, no recent unresolved P0/P1 errors.
- [ ] At least one daily summary email arrived (if enabled).
- [ ] Both kids actually enjoyed using it for a week. (The only criterion that matters.)

When all boxes check: **v1 is live.**

---

## Cross-phase concerns (worked continuously, not phased)

- **`CLAUDE.md` at repo root** with project rules; updated as patterns solidify.
- **TypeScript strict mode** from Phase 1; never disabled per file.
- **Ledger invariants** documented in `packages/db/src/ledger/INVARIANTS.md` and tested in every CI run.
- **Bilingual coverage**: every PR touching UI must include both `he.json` and `en.json` keys.
- **Test coverage targets**: 80% on `packages/db` (especially ledger), 70% on `apps/worker` (cron + engines), 30% on `apps/web` (UI; Playwright covers the happy paths).
- **No new dependencies without justification** in the commit message.

---

## What if a phase slips?

Phases are independently shippable. A slip in N doesn't block users from getting value from 1..N-1:

- **Phase 1 slip:** nothing to ship. Wait it out.
- **Phase 2 slip:** parents have admin only. No kid surface.
- **Phase 3 slip:** kids can log in but can't complete tasks. Acceptable degraded state for ~days.
- **Phase 4 slip:** daily tasks work; long-term doesn't. Most of the value is daily-task-driven; this is OK.
- **Phase 5 slip:** evidence/approval doesn't work. ALL non-evidence tasks still work. Kids who have homework tasks will be sad; flag for users.
- **Phase 6 slip:** kids can earn but not redeem. The app is broken as a system but not as a tracker. Avoid landing here.
- **Phase 7 slip:** no campaigns/badges. Daily/long-term tasks + redemption still work. Acceptable v0.9.
- **Phase 8 slip:** no notifications. App still works in-session. Kids will forget to do tasks; parents will miss approvals. Avoid landing here.
- **Phase 9 slip:** ugly app, but functional. Worst case ship without v9 polish; backfill.

The order above prioritizes "minimum useful" early (Phase 3) and concentrates risk in 3, 5, 7.

---

*Build plan locked 2026-05-20. Phase boundaries are commitments; phase-internal task orders are guidance. If a phase grows beyond +50% of estimate, surface that immediately.*
