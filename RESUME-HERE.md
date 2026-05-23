# 🟢 RESUME-HERE — Reco

> **You are a fresh Claude Code session for the Reco project. Lily started this app on 2026-05-20, paused on 2026-05-21 after completing the monorepo scaffold, and is now resuming. Read this file FIRST, then follow the instructions below. Do not redo any planning or design work — every gate is locked.**

---

## Where we are right now

**Phase 4 (build) · Phases 1-7 COMPLETE + visual polish round (incl. Phase 7.5 mini-feature: time-bound tasks) · Phase 8 (notification dispatcher + WhatsApp + quiet hours + rate limits) — NEXT.**

Phase 1 exit audit: [`docs/PHASE-1-EXIT.md`](docs/PHASE-1-EXIT.md).
Phase 2 exit audit: [`docs/PHASE-2-EXIT.md`](docs/PHASE-2-EXIT.md).
Phase 3 exit audit: [`docs/PHASE-3-EXIT.md`](docs/PHASE-3-EXIT.md).
Phase 4 exit audit: [`docs/PHASE-4-EXIT.md`](docs/PHASE-4-EXIT.md).
Phase 5 exit audit: [`docs/PHASE-5-EXIT.md`](docs/PHASE-5-EXIT.md).
Phase 6 exit audit: [`docs/PHASE-6-EXIT.md`](docs/PHASE-6-EXIT.md).
Phase 7 exit audit: [`docs/PHASE-7-EXIT.md`](docs/PHASE-7-EXIT.md).

Seven phases shipped + a full visual-polish round. **104 Vitest tests still pass** (visual polish work was UI-only; no engine touched). The streak engine handles the headline retroactive-undo case (undo zeros the streak; re-derives from `task_completion` on every call). The total engine handles long-term + daily mixed feeders. The `processCompletionForCampaigns` helper fans out from each completion event to award bonus + badge atomically. The daily-reset cron handles streak break detection + window close + yearly birthday badges. Admin campaign CRUD + kid campaigns view + kid badges page all live. **`notification_event` rows ARE being written (campaign_completed / sibling_badge_earned / streak_broken / streak_freeze_used) with idempotent dedup keys — Phase 8 ships the dispatcher that surfaces them.**

**Visual polish round (2026-05-23)** added: persistent bottom-nav on every kid surface (home / shop / מסעות / badges / wallet), header-bell shell (UI only — wired in Phase 8), confetti on task complete + redemption + badge earn, RTL arrow helpers applied at 12 sites, wallet history grouped by date with today expanded by default + task icons inline, kid avatar picker with 10 multi-color SVG faces × 8 brandbook palette colors saving independently via dedicated server actions, reward-shop redesign with photo-replaces-icon when `image_path` set, big illustrated section headers (אלופים / מסעות / חנות), badge preview on campaign cards, "active" / "הושלם!" task split with encouragement copy, per-second countdown on time-bound tasks, photo-upload form with "send for approval" + "add a pic" inline, audit row formatting for joker adjustments. **Phase 7.5 mini-feature**: `task_template.deadline_time TIME` column (migration `0005_phase7p5_deadline_time.sql`) + server-side deadline gate + client live countdown + admin reopen widget. Avatar color whitelist enforced server-side against the same 8-color brandbook palette via `setKidColorAction`. See the "Visual polish + Phase 7.5" entry in `CHANGELOG.md` for the full list.

Read [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) §"Phase 8" before starting Phase 8.

### What's done ✅

| Gate | Date | What was decided | Artifact |
|---|---|---|---|
| **Gate 0** — Infrastructure discovery | 2026-05-20 | Reuse Hetzner VPS pattern (NOT Supabase, NOT Vercel). Third Docker stack alongside Family_Budget_App + Family_Tasks_Hub. Subdomain `reco.my-restart.co.il`. In-app approval flow (Twilio Sandbox inbound is account-singleton owned by Family_Tasks_Hub). | Memory: `project_recognition_gate0.md` |
| **Gate 1** — Requirements interview | 2026-05-20 | 49 product decisions locked across audience, devices, coin economy, tasks, campaigns, evidence flow, redemption, notifications, branding. | Memory: `project_recognition_gate1_batch{1..5}.md` |
| **Gate 2** — Technical plan + schema | 2026-05-20 | Architecture, 22-table Postgres schema + Auth.js + __migrations, cron schedules, notification matrix, 9-phase build plan, open-questions resolved. | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCHEMA.md`](docs/SCHEMA.md), [`docs/CRON.md`](docs/CRON.md), [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md), [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) |
| **Gate 3** — Design system locked | 2026-05-21 | Concept 5 — **Plush** + **Embroidered Patch** badge architecture. Six concepts explored, one chosen. Brandbook v1.0 locked. | [`docs/BRANDBOOK.md`](docs/BRANDBOOK.md) (canonical) + [`docs/brandbook.html`](docs/brandbook.html) (visual companion) |
| **Build · Phase 1** — Foundations | 2026-05-21 | Monorepo scaffold (1a), DB schema + migrations + Drizzle + encrypt + tests (1b), Next.js 16 web shell + Auth.js v5 parent login + brandbook-styled login UI (1c), Fastify 5 worker shell with /healthz + migration-on-boot + empty cron registry (1d), infra (Docker Compose + Dockerfiles + Caddyfile fragment + deploy/update/auto-deploy scripts) (1e), exit-criteria audit (1f). | Everything under `apps/`, `packages/`, `infra/` + [`docs/PHASE-1-EXIT.md`](docs/PHASE-1-EXIT.md) |
| **Build · Phase 2** — Kid auth | 2026-05-21 | `lib/kid-auth/` HMAC-JWT + Argon2 + device-trust (2a), middleware dual-principal resolution + /api/kid-session/{refresh,logout} (2a), `/[lang]/pick` profile picker + `/[lang]/pick/[slug]` PIN entry keypad + auto-submit (2b), kid home stub + "switch user" (2b), `/[lang]/admin/*` shell + `/admin/kids/[id]/pin` set/reset + `/admin/kids/[id]/devices` revoke with audit_log writes (2c), exit audit (2d). End-to-end verified: parent sets PIN via admin → kid logs in with that PIN → kid home renders. | Everything under `apps/web/src/{lib/kid-auth,app/[lang]/pick,app/[lang]/admin,app/api/kid-session}` + [`docs/PHASE-2-EXIT.md`](docs/PHASE-2-EXIT.md) |
| **Build · Phase 3** — Tasks + ledger | 2026-05-21 | Vitest-with-pg harness in `@reco/db/test-utils` (3a), single ledger writer at `packages/db/src/ledger/post.ts` with per-kid advisory lock + admin-debit clamping + 31 invariant tests + grep CI guard (3b), `completeTaskAction` / `undoTaskCompletionAction` with partial-unique double-claim catch + same-day undo (3c), kid home rebuild with wallet pulse + brandbook-conformant cards (3d), wallet history page (3e), admin task-template CRUD + per-kid assignment toggles + per-kid ledger view (3f), exit audit (3g). End-to-end verified: kid taps "I did it" → coins land + card flips to mint → undo → coins return + card flips back → redo → repeat. | Everything under `packages/db/src/{ledger,test-utils}`, `apps/web/src/{lib/{auth,tasks,admin-tasks},app/[lang]/{wallet,admin/tasks,admin/kids/[id]/ledger}}` + [`docs/PHASE-3-EXIT.md`](docs/PHASE-3-EXIT.md) |
| **Build · Phase 4** — Long-term tasks | 2026-05-22 | Migration `0003_phase4_long_term.sql` adds `task_assignment.long_term_completed_at` (4a), `logProgressOperation` + `undoLongTermProgressOperation` in `packages/db/src/long-term/` (4b) — bonus posts as `kind='earn'` with `long_term_progress_id` (no campaign FK), bonus reverses when undo drops total below goal regardless of which row was undone, 16 new Vitest invariants total 47/47 pass (4c), kid home long-term section with lavender progress bar + +N input + per-row undo chips + "הושלם!" pill on completion (4d), admin task-form gains `kind` radio + conditional long-term fieldset, edit-mode disables radio (kind change rejected server-side too) (4e), exit audit (4f). End-to-end verified: log +20 → balance 20, +80 → balance 150 (bonus) + completed, undo +80 → balance 20 + reopened. | Everything under `packages/db/src/long-term/`, `apps/web/src/{lib/long-term/,app/[lang]/_components/long-term-task-card.tsx}` + [`docs/PHASE-4-EXIT.md`](docs/PHASE-4-EXIT.md) |
| **Build · Phase 5** — Evidence + approval | 2026-05-22 | `EVIDENCE_VOLUME_PATH` config + `.evidence-dev/` (5a). `submitEvidenceAction` with UUID-only filenames + 10 MB cap + MIME allowlist + atomic INSERT (5b). Session-gated `GET /api/evidence/[id]` streaming route in Next (deviation from ARCH §9 — web serves, worker only purges) (5c). `approveSubmissionOperation` in `@reco/db` with FCFS `UPDATE WHERE status='pending'` rowcount-check + ledger.post earn + audit_log; `/admin/approvals` queue with photo + approve/deny buttons (5d). Kid task card extended with `needsPhoto` (yellow + file picker) + `denied` (pink + deny-reason inline) states (5e). 23 new Vitest invariants — 6 FCFS race (2-way + 3-way concurrent) + 15 path-safety + 8 purge SQL — total **77/77 pass** (5f). Worker `evidence-purge.ts` cron at `0 6 * * *` IL (5g), exit audit (5h). Browser-verified end-to-end: Lia uploads PNG → DB rows + file on disk → Mom approves → +20 coins land + completion approved + audit row. | Everything under `apps/web/src/{lib/evidence/,app/api/evidence,app/[lang]/admin/approvals}`, `packages/db/src/evidence/`, `apps/worker/src/cron/evidence-purge.ts` + [`docs/PHASE-5-EXIT.md`](docs/PHASE-5-EXIT.md) |
| **Build · Phase 6** — Rewards + redemption + joker | 2026-05-22 | Migration `0004_phase6_redemption_fk.sql` makes the `ledger_entry.redemption_id` FK DEFERRABLE INITIALLY DEFERRED so the circular reference between redemption + ledger lands inside one tx without weakening NOT NULL (6a). Five in-tx operations in `@reco/db`: `redeemOperation` (FOR UPDATE row lock + per-day cap + race-safe stock decrement + spendable check + pre-gen UUID then ledger.post('redeem') then INSERT redemption), `markRedemptionReceivedOperation`, `cancelRedemptionOperation`, `refundRedemptionOperation` (all FCFS `UPDATE WHERE status='<expected>'` with rowcount check), `adjustWalletOperation` (wraps ledgerPost's clamping). Six matching server actions (6b). Kid `/[lang]/redeem` reward grid w/ tile gating + `/[lang]/redeem/history` pending+resolved tracker (6c-d). Admin `/admin/redemptions` queue + `/admin/rewards` CRUD + `/admin/kids/[id]/wallet/adjust` joker + `/admin/audit` household audit feed (6e-h). 18 new Vitest invariants — happy path + 7 rejections + concurrent stock-1 race + mark-received x3 + cancel x3 + refund x2 + rollback safety — total **80/80 pass** (6h). Browser-verified end-to-end: Lia redeems candy → wallet 14→12 → admin sees in queue → admin marks received → audit row appears; joker +5 then -100 produces clamped balance display 0 with `clamped_amount=83` in ledger. | Everything under `packages/db/src/{redemption,joker}/`, `apps/web/src/{lib/redeem,lib/joker,lib/admin-rewards,app/[lang]/redeem,app/[lang]/admin/{redemptions,rewards,audit,kids/[id]/wallet}}` + [`docs/PHASE-6-EXIT.md`](docs/PHASE-6-EXIT.md) |
| **Build · Phase 7** — Campaigns + engines + badges | 2026-05-23 | Streak engine `evaluateStreak(client, {kidId, campaignId, asOfDate})` — pure ledger-derived; chain-from-first-active-day model; any break with no remaining freeze zeros the streak (matches BUILD-PLAN's retroactive-undo invariant literally). 16 streak Vitest invariants (7a). Total engine `evaluateTotal` SUMs daily completion counts + long-term progress quantities; 8 invariants including window clamp for the "incomplete" path (7b). `processCompletionForCampaigns` helper fans out from each completion event: evaluates engine → updates cache → posts campaign_bonus + INSERTs kid_badge + UPDATEs enrollment + INSERTs audit_log + INSERTs `campaign_completed` (kid) and `sibling_badge_earned` (siblings) bell events. Hooks land in `completeTaskAction`, `approveSubmissionOperation`, `logProgressOperation` — all inside the originating tx (7c). Daily-reset cron at 00:00 IL: streak re-evaluation (with `streak_broken` + `streak_freeze_used` events), window-close (`completed_kind='incomplete'`), yearly birthday badge (NULLS NOT DISTINCT UNIQUE enforces once-per-year via `awarded_for_year`) (7d). Admin `/admin/campaigns` create form with kind toggle + feeding task multi-select + kids picker + badge dropdown; list with mint/lavender chips + per-row archive; edit deferred to v2 (7e). Kid `/[lang]/campaigns` view with mint streak cards / lavender total cards + progress bar (7f). Kid `/[lang]/badges` grid w/ earned + locked-but-visible; embroidered-patch placeholder (pastel ring + dashed border + inner tile + initial letter) until family-3 SVGs in Phase 9 (7g). Bell events ARE written (idempotent dedup keys); UI delivery deferred to Phase 8 dispatcher (7h). 24 new Vitest invariants — total **104/104 pass** (7i). Browser-verified end-to-end: Mom creates "מסע מיטה" streak campaign → Lia completes 5 days → bonus +50 + King of Tasks badge land in the same tx as the 5th completion; `sibling_badge_earned` row for Yael appears in `notification_event`. | Everything under `packages/db/src/campaigns/`, `apps/worker/src/cron/daily-reset.ts`, `apps/web/src/{lib/admin-campaigns,app/[lang]/{campaigns,badges,admin/campaigns}}` + [`docs/PHASE-7-EXIT.md`](docs/PHASE-7-EXIT.md) |
| **Visual polish + Phase 7.5** — Kid UX round | 2026-05-23 | Persistent `BottomNav` on every kid surface (home / shop / מסעות / badges / wallet) — fixed, safe-area-inset-aware, pink-active highlight via `usePathname` suffix-match (bound to `ic-quest-climb`, Option D climber). Header bell shell wired in UI only — Phase 8 dispatcher delivers events. New `icon-library.tsx` with 28+ inline SVGs (task `ic-*` + reward `rw-*` + section headers + climber). New `avatar-library.tsx` with 10 multi-color SVG faces (fox/bunny/cat/dog/owl/bear/unicorn/panda/frog/monkey) each with identity palette independent of background color. `/[lang]/avatar` picker page: 8-swatch brandbook palette + face grid + live preview + single save button posting BOTH `setKidAvatarAction` + `setKidColorAction` (server-side whitelist enforces palette). New `lib/celebrate.ts` confetti wrapper (3 intensities + prefers-reduced-motion). New `lib/rtl.ts` helpers `arrowBack(lang)` / `arrowForward(lang)` — applied at 12 sites. Reward shop redesign: photo replaces icon when `image_path` set, otherwise pastel-tile + small icon (reverted from aspect-square redesign per Lily's feedback). Wallet history grouped by date with today expanded by default via native `<details>`; task icons inline; balance + date sub-headers. "Active" / "הושלם!" task split with encouragement copy ("עוד לפניך"). Badge preview chip on campaign cards. Per-second live countdown on time-bound tasks (9:21:59→9:21:58). Photo-upload form with "send for approval" + "add a pic" inline (saved vertical space). Audit row formatting for joker adjustments. **Phase 7.5 mini-feature: time-bound tasks** — migration `0005_phase7p5_deadline_time.sql` adds `task_template.deadline_time TIME`; server-side deadline gate in `completeTaskAction` rejects late completions; client live countdown shows time-remaining; admin "reopen" widget in approvals queue. Migration `0006_phase7p5_avatar_key.sql` adds `kid.avatar_key TEXT`. Critical bug fixed: kid-home stale wallet balance after revalidate (added `useEffect(() => setBalance(initialBalance), [initialBalance])` to sync prop→state). 104/104 Vitest tests still pass (no engine touched). | Everything under `apps/web/src/{components/{icon-library,avatar-library,avatar,icon-picker,reward-icon}.tsx, lib/{celebrate,rtl,avatar}, app/[lang]/{_components/bottom-nav,avatar}}`, migrations `0005`+`0006`, plus updated dictionaries + reward / wallet / campaigns / badges surfaces. **Items still in flight**: sandbox page `/[lang]/sandbox/quest-icons` exists for cleanup; admin reward image upload form not yet wired (image_path is currently populated with Unsplash demo URLs in dev DB). |

### What's next (in order) ▶️

| Phase | What to build | Sized | Risk |
|---|---|---|---|
| **8** ⏳ NEXT | Notification dispatcher + WhatsApp + quiet hours + rate limits. The `notification_event` table is already populated by Phases 5-7 (submission_pending, submission_approved, submission_denied, redemption_received, admin_wallet_adjustment, campaign_completed, sibling_badge_earned, streak_broken, streak_freeze_used) with `state='pending'` + idempotent `dedup_key`. Phase 8 ships the dispatcher tick (every 5 min) that picks them up and either writes the bell-polling endpoint surface OR fires Twilio WhatsApp per the [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) §9 matrix. Per-recipient rate limit (3 WhatsApp / 10 min, defer excess to `state='rate_limited'`). Quiet hours 21:00-07:00 IL (bell fires immediately; WhatsApp defers into the morning). Bell UI components (kid + admin). | M | Medium |
| 9 | Bilingual polish + PWA install + Sentry + launch. | M | Low |

After Phase 9 ships, **v1 is live.** See [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) for the full per-phase exit criteria.

---

## 📚 Read these documents (in this order) before touching code

1. **[`CLAUDE.md`](CLAUDE.md)** — repo-wide rules for Claude sessions. Read this first.
2. **[`docs/BRANDBOOK.md`](docs/BRANDBOOK.md)** — locked design system (Plush + Embroidered Patch). Every UI surface must conform.
3. **[`docs/SCHEMA.md`](docs/SCHEMA.md)** — what 1b implements. The 23-table schema with all constraints + indexes + invariants.
4. **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — container topology, web/worker split, auth model, evidence handling, three key flow diagrams.
5. **[`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md)** — full 9-phase roadmap. Each phase has explicit entry + exit criteria.
6. **[`docs/CRON.md`](docs/CRON.md)** + **[`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md)** — implemented in Phases 6 + 8, but inform the schema in 1b.
7. **[`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md)** — resolved questions + ongoing assumptions + v2 backlog.
8. **[`CHANGELOG.md`](CHANGELOG.md)** — running log of changes. Append a new entry after every sub-milestone.

The brandbook visual companion ([`docs/brandbook.html`](docs/brandbook.html)) is great for orientation — open it in a browser before designing any new UI.

---

## 🧠 Memory

Your auto-loaded memory contains the locked decisions from gates 0–3. Don't re-litigate them. If you think a locked decision is wrong, surface it as a flagged concern — do not silently override.

Key memory files (auto-loaded):
- `feedback_question_wizard.md` — Lily wants all clarifying questions via the AskUserQuestion wizard, not prose lists.
- `project_recognition_gate0.md` — infrastructure path
- `project_recognition_gate1_batch1.md` through `_batch5.md` — 49 product decisions
- `project_recognition_gate2_decisions.md` + `_final.md` — schema + open Qs resolved
- `project_recognition_gate3_locked.md` — Plush + Embroidered Patch chosen
- `project_recognition_resume_state.md` — current build state (this milestone)

---

## ▶️ How to resume — start by doing this

**Step 1.** Read this file (you're doing it).

**Step 2.** Read [`CLAUDE.md`](CLAUDE.md), [`docs/BRANDBOOK.md`](docs/BRANDBOOK.md), [`docs/SCHEMA.md`](docs/SCHEMA.md), [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md).

**Step 3.** Read [`CHANGELOG.md`](CHANGELOG.md) for the chronological summary.

**Step 4.** Confirm with Lily that you understand where we are. Use the AskUserQuestion wizard (per her preference). One question, two options: "Start Phase 8 (notification dispatcher + WhatsApp + quiet hours + rate limits)?" / "I have a different priority — let me describe it."

**Step 5.** If she confirms Phase 8 → implement per [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) Phase 8, in this order: (1) `channels.ts` in `apps/worker/src/notifications/` — `sendWhatsApp` (direct Twilio fetch), `sendEmail` (nodemailer), `sendInApp` (bell-only no-op), (2) `templates.{he,en}.ts` with localized message strings per event_kind — keys include `task_reminder`, `submission_pending`, `submission_approved`, `submission_denied`, `new_redeem_item`, `campaign_nudge`, `campaign_completed`, `streak_freeze_used`, `streak_broken`, `redemption_received`, `redemption_refunded`, `admin_wallet_adjustment`, `sibling_badge_earned`, (3) `dispatcher.ts` cron at `*/5 * * * *` IL — picks up `state='pending'` rows from `notification_event` (channel='bell' or channel='whatsapp'), applies quiet-hours + rate-limit gates, fires the channel, UPDATE state to 'sent' / 'failed' / 'deferred' / 'rate_limited'. Per [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) §9 matrix: WhatsApp fires for task_reminder, submission_pending/approved/denied, new_redeem_item, campaign_nudge — everything else is bell-only, (4) `quiet-hours.ts` — TZ-aware check (21:00-07:00 IL default, per-user overridable later); WhatsApp defers into morning, bell still records immediately, (5) `rate-limiter.ts` — in-memory sliding window per (channel, recipient): 3 WhatsApp / 10 min per recipient; excess UPDATE to `state='rate_limited'` then trickle out, (6) bell-polling endpoint `/api/notifications/recent?since=<timestamp>` — kid sees their own kid_id-targeted events; admin sees all household events targeting any user_id, (7) bell UI components — kid bell badge (count on icon) + dropdown; admin bell badge + dropdown. Per-kid + per-admin "mark all read" action that UPDATEs `sent_at`. (8) reminder cron `*/5` per-task-assignment check — per [`docs/SCHEMA.md`](docs/SCHEMA.md) §3 task_reminder: walks every enabled reminder where today's DOW bit matches, fire_time has passed within the last 5min, and no `task_completion` for today's assignment exists. INSERT notification_event with `dedup_key='task_reminder:<reminder_id>:<YYYY-MM-DD>'`. (9) campaign_nudge cadence per [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) §2.3 — uses `campaign_nudge_log` to enforce cooldown per campaign+kid. Test with `WHATSAPP_DRY_RUN=true` (already in env). Stop at sub-checkpoints.

---

## 🛠️ How to bring dev back up locally

The ephemeral dev stack from the prior session was torn down at handoff time. To resume:

```bash
# 1. pnpm install if node_modules is missing
pnpm install

# 2. Start a throwaway pg on port 5433 (matches apps/{web,worker}/.env.local)
docker run -d --rm --name reco-pg-smoke \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=reco -e POSTGRES_DB=reco \
  -p 5433:5432 postgres:16-alpine
until docker exec reco-pg-smoke pg_isready -U reco -d reco -q; do sleep 1; done

# 3. Apply migrations (runs 0001_init + 0002_seed_household)
DATABASE_URL='postgres://reco:test@localhost:5433/reco' pnpm --filter @reco/db migrate:apply

# 4. Set real credentials for the seeded rows.
# Parent passwords (Auth.js) — replace the placeholder Argon2id hashes.
# Hash a password:  node -p "require('./apps/web/node_modules/@node-rs/argon2').hash('YourPass', { memoryCost: 19456, timeCost: 2, parallelism: 1 }).then(h => process.stdout.write(h+'\n'))"
docker exec reco-pg-smoke psql -U reco -d reco -c \
  "UPDATE \"user\" SET password_hash = '<hash>' WHERE email = 'mom@reco.local';"
# (repeat for dad@reco.local if you want both)

# 5. Boot the web preview — picks up apps/web/.env.local automatically
pnpm --filter @reco/web dev
# Then http://localhost:3030/  → /he/pick (anonymous) or /he/admin/kids (parent)

# 6. (Optional) Boot the worker too — separate terminal
pnpm --filter @reco/worker dev
# Worker exposes http://localhost:8100/healthz
```

Kid PINs are set via the admin UI at `/he/admin/kids/<id>/pin` after parent login (so the next session sets them itself; no SQL hash-bashing required).

**Files under .env.local that already exist locally** (gitignored, dev-only secrets):
- [`apps/web/.env.local`](apps/web/.env.local) — DATABASE_URL pointing at the 5433 container, AUTH_SECRET, MASTER_KEY
- [`apps/worker/.env.local`](apps/worker/.env.local) — same DATABASE_URL + MASTER_KEY + worker knobs

To fully tear down at the end of a session: `docker stop reco-pg-smoke` (the `--rm` self-cleans the container).

---

## 🚫 Things NOT to do

- ❌ **Don't redesign.** Plush + Embroidered Patch is locked. Six concepts were explored; this one was chosen. Don't propose alternatives.
- ❌ **Don't suggest Supabase or Vercel.** Reco runs on Hetzner with self-hosted Postgres in Docker. This was explicitly chosen over the alternatives.
- ❌ **Don't change the schema** without surfacing the proposal. The 23-table model is locked at Gate 2.
- ❌ **Don't change the brandbook tokens** (colors, fonts, sizes) without explicit approval + a brandbook version bump per [`docs/BRANDBOOK.md`](docs/BRANDBOOK.md) §14.
- ❌ **Don't introduce new vendors.** Anthropic, Twilio, Backblaze B2, Gmail SMTP — all reused from the other two apps. Postgres self-hosted in Docker.
- ❌ **Don't write production-ready code without confirming with Lily.** Each sub-milestone ends with a check-in.

---

## ✨ Things TO do

- ✅ Use the **AskUserQuestion wizard** for every clarifying question (Lily's locked preference).
- ✅ Reference docs explicitly when making decisions: "per BRANDBOOK §2.3, mint is reserved for success states."
- ✅ Keep the **CHANGELOG.md** updated after each sub-milestone.
- ✅ Mark **chapters** in the session at clear phase transitions (using the session-mark tool).
- ✅ Mark **todos** at the start of each milestone using TodoWrite.
- ✅ Stop at the end of each sub-milestone for a check-in. Don't barrel through.

---

*Last updated: 2026-05-23 · Phases 1-7 complete + visual polish round (incl. Phase 7.5 time-bound tasks) · next: Phase 8 (notification dispatcher + WhatsApp + quiet hours + rate limits — Medium risk).*
