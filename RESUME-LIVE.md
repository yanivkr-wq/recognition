# 🟢 RESUME-LIVE — TasKidz (formerly Reco) is in production

> **Fresh session: read this FIRST, then `CLAUDE.md`.** This file supersedes `RESUME-HERE.md` for day-to-day work — `RESUME-HERE.md` describes the pre-launch build (Phases 1-9 plan); this file describes the **live production app** and how we now work against it. Last updated: 2026-05-28.

---

## TL;DR — what changed

The app is **live on the Hetzner VPS** at https://reco.my-restart.co.il (the subdomain stays "reco" — only the **product name + brand mark are now TasKidz**). We **develop against production** (Lily's explicit choice): edit locally → commit → push to GitHub → manually rebuild on the VPS → verify on the live URL.

Since the 2026-05-24 launch we've shipped a major brand rebrand (TasKidz logo + splash + theming), three player themes, the admin app shell (bottom-nav + bell + insights/journeys), repeatable daily tasks, decoupled journey measurement (`measure_amount`/`measure_unit` — migration 0012), the joker/ledger rebuild, the kid-app header redesign, and a critical trusted-devices UX fix. See **"Shipped since 2026-05-24"** below.

- **Live URL:** https://reco.my-restart.co.il (Hebrew default, RTL, TLS via Caddy/Let's Encrypt)
- **GitHub repo:** https://github.com/yanivkr-wq/recognition (PUBLIC, `main` branch)
- **VPS:** Hetzner `178.105.83.23`, SSH user **root**, key `~/.ssh/hetzner_budget`
- **Repo on VPS:** `/opt/recognition`
- **Containers:** `reco-web` (:3030), `reco-worker` (:8100), `reco-pg`
- **Latest DB migration applied:** `0012_task_measure.sql` (auto-applied by worker on boot)

---

## ▶️ The deploy loop (how to ship a change)

1. Edit code locally
2. `pnpm --filter @reco/web typecheck` (and `@reco/shared` / `@reco/db` if you touched them) — must be clean
3. Commit + `git push` (git commit/push are allowlisted)
4. **Rebuild on the VPS** — the auto-deploy cron is NOT firing; run it manually:
   ```bash
   ssh -i ~/.ssh/hetzner_budget root@178.105.83.23 "bash /opt/recognition/infra/update-prod.sh"
   ```
   `git pull` + `docker compose build` + `up -d` + smoke test (~3-5 min; trailing `web=200 worker=200` = success). `curl: (56) Recv failure` during the warm-up loop is fine.
5. Verify on https://reco.my-restart.co.il (hard-refresh; kid pages cache aggressively).

**SSH is allowlisted for the Bash tool** — `Bash(ssh -i /c/Users/Lilyd/.ssh/hetzner_budget root@178.105.83.23:*)` + `scp`. Always paste **the full root@… SSH URL** when handing Lily a command (her standing instruction).

---

## 🔑 Production facts (the live DB + secrets)

- **Parent login:** `mom@reco.local` — password set in earlier session; Lily knows it; NOT in any file/memory. `dad@reco.local` still has the unmatchable placeholder hash.
- **Kid PINs:** Lia + Yael have PINs set; trusted-device flow is now usable (see "Trusted devices fix" below). Kid UUIDs: Lia `33333333-3333-3333-3333-333333333301`, Yael `…302`. Household `11111111-…-111111111111`.
- **Content:** 36 task templates + 16 rewards seeded; some daily tasks now have `measure_amount` set for journey tracking.
- **`.env` on VPS** (`/opt/recognition/.env`, chmod 600): `POSTGRES_PASSWORD`, `AUTH_SECRET`, `MASTER_KEY`, `WORKER_INTERNAL_TOKEN`, `ANTHROPIC_API_KEY` (real), `WHATSAPP_DRY_RUN=true`. Twilio/SMTP/B2/Sentry still blank.
- **psql access:** `ssh … "docker exec -i reco-pg psql -U reco -d reco"` — unix-socket trust-auth (no password). Pipe SQL via stdin.

---

## ✅ Shipped since 2026-05-24 (live in prod)

### Brand + Visual
- **TasKidz rebrand** — name everywhere (manifest, layout, icon0/icon1/apple-icon, kid header). Logo asset at `apps/web/public/taskidz-logo.svg`.
- **`TasKidzLogo` component** (`apps/web/src/components/taskidz-logo.tsx`) — renders the SVG with `mix-blend-mode: multiply` so the baked white bg vanishes on light surfaces. Optional `animated` overlays a `RewardHex` at the gift-corner coords (`GIFT_CX=0.735, GIFT_CY=0.149, GIFT_W=0.2`).
- **`RewardHex`** (`apps/web/src/components/reward-hex.tsx`) — gold hex with 7 cycling white emblems (gift/star/trophy/crown/medal/heart/gem).
- **Splash intro** (`apps/web/src/components/splash-intro.tsx`) — cycling hex docks into the logo's gift corner (no fade between phases), then full logo scales in, then fade-unmount.
- **3 player themes** (bubblegum / ocean / sunset) — CSS-var overrides on `[data-theme="…"]`. **Pink leak swept** (star/crown/heart in legacy logo glyphs now `fill="currentColor"`).
- **Avatar library** expanded — 8 new heroes (`AvHero, AvPrincess, AvNinja, AvRobot, AvAstronaut, AvWizard, AvDragon, AvAlien`).

### Admin app shell
- **Admin bottom nav** (`apps/web/src/app/[lang]/admin/_components/admin-bottom-nav.tsx`) — 5 tabs (Insights / Approvals / Players / Rewards / More).
- **Admin "More" menu** (`/admin/menu`) — full grouped directory (Overview / Players / Content / System), monochrome line icons.
- **Admin bell** (`admin-bell.tsx`) — polling bell with dropdown.
- **Option C neutral monochrome buttons** — `.btn-admin` family in `globals.css`. Full sweep across admin pages (incl. Feedback FAB).

### Insights / Players / Journeys
- **Insights** redesigned + multi-player SVG trend chart with hover tooltips (`trend-chart.tsx`).
- **`/admin/kids`** redesigned data-first — stat tiles (`tasksToday / activeJourneys / badgesEarned / needsAttention`) + neutral action chips. Live counts from ledger/completions/submissions/redemptions/enrolments scoped to household.
- **`/admin/journeys`** — per-player live journey progress; supports `?kid=` filter; linked from the Active-Journeys stat tile on `/admin/kids`.

### Tasks + Journeys engine
- **Repeatable daily tasks** — migration `0011_repeatable_tasks.sql` adds `task_template.max_per_day` + `task_completion.occurrence_ordinal` + new unique index. `completeTaskAction` uses a per-assignment advisory transaction lock, counts active non-denied rows, enforces cap, and assigns the next ordinal. UI shows `✓ doneToday / max` tally + "Do Again" button. **Pending (waiting on approval) is shown as `⏳ N · waiting` and does NOT bump the x/N tally** — only approved counts.
- **Approval notification on `submission_approved`** — `evidence/admin-actions.ts` writes a bell `notification_event` for the kid on approve (idempotent on `dedup_key`).
- **Decoupled journey measure model** — migration `0012_task_measure.sql` adds `task_template.measure_amount` + `task_template.measure_unit` + `campaign.measure_unit`; backfills `measure_amount = coin_value` for existing daily tasks. `campaigns/total-engine.ts` now sums `COALESCE(measure_amount, 0)` (was `coin_value`, originally `COUNT(*)`). Fixes "2/120 minutes" reading from 2× 15-min tasks → now reads 30/120.
- **Task form** now exposes `maxPerDay`, `measureAmount`, `measureUnit`.

### Ledger / Joker
- **Joker on `/admin/kids/[id]/ledger`** — per-entry revoke button. `reverseLedgerEntryAction`:
  - Removed the `redirect()` to same URL (was a no-op for RSC refresh → caused "nothing happens" bug). Now just `revalidatePath` + return.
  - Joins `task_completion → task_assignment → task_template` for a meaningful descriptor.
  - Auto reason: `(he ? 'ביטול: ' : 'Reversed: ') + descriptor + ' (' + origSigned + ')'`.
- **Ledger list** (`ledger-list.tsx`) — date-grouped, filter chips, colored left-border per kind, revoke buttons.

### Kid app polish
- **Kid header — Option C single tight row** (commits `ae42935` + `04d3d1f`):
  - `grid grid-cols-[1fr_auto_1fr]` — avatar+name (start) · TasKidz logo (center) · bell + switch-user (end).
  - Wallet hero card lives directly below the header (where the coin balance is shown).
  - **Safe-area fix:** `paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)'` (was fixed `pt-10`, which left a white band above the status bar).
  - **Visible divider:** `bg-card border-b border-rule shadow-hairline`.
  - PWA Badging API mirrors `unreadCount` onto the OS app-icon (progressive enhancement, no-ops where unsupported).

### Rewards admin
- Filters + bulk actions + image thumbnails on the list; image upload at creation time (not just edit).

### Trusted devices fix (subtle but important)
- **Bug:** "מכשירים מהימנים" (remember device) checkbox was BELOW the keypad. PIN auto-submits on the 4th digit → checkbox was bypassed in practice. Backend was fine; `device_trust` simply had 0 rows.
- **Fix** (`pin-entry-form.tsx`): moved the "Remember this device" checkbox **ABOVE the keypad**, in a bordered box. Now reachable before auto-submit.

---

## 🔜 IN-FLIGHT / pick up here

### 1. Per-theme logo assets — WAITING ON LILY
Lily agreed the single baked PNG can't be cleanly recolored across themes. She'll send 3 exports: `taskidz-logo-bubblegum.svg`, `taskidz-logo-ocean.svg`, `taskidz-logo-sunset.svg`. When received: drop into `apps/web/public/`, switch `TasKidzLogo` to pick by current theme.

### 2. Safe-area padding sweep — REMAINING KID PAGES
`kid-home.tsx` got the `calc(env(safe-area-inset-top, 0px) + 0.5rem)` treatment. Apply the same to other kid pages that render their own header: **notifications, campaigns, redeem, wallet, badges**. Same pattern.

### 3. Full refresh / revalidation audit (Task #3) — STILL OPEN
Two root-cause families. The joker/ledger redirect bug (Pattern A variant) was fixed this session, but the broader sweep isn't done:

**PATTERN A — sticky `useActionState` success branch (re-submit blocked):**
- **CONFIRMED** in `apps/web/src/components/feedback-button.tsx`: after success, `state.ok` stays `true` forever. Modal shows `{state?.ok ? <success> : <form>}` → reopening the modal still shows success.
- **FIX:** key the modal+form child component by an incrementing open-counter so `useActionState` remounts.

**PATTERN B — `useState(prop)` never re-syncs after `revalidatePath`:**
- Kid-home wallet already fixed (`useEffect(() => setBalance(initialBalance), [initialBalance])`).
- **Audit ALL `'use client'` components that initialize local state from a server prop.** Top suspect: `KidTasksForm` (`/admin/kids/[id]/tasks`) seeds `checked` from `initiallyChecked` prop via `useState` and never re-syncs.

**Pattern C (new this session) — `redirect()` to the same URL is a no-op for RSC refresh.** Server actions that just need to refresh the current page should `revalidatePath(...)` and return — NOT `redirect(currentUrl)`. Audit other server actions for this.

### 4. Journey re-tuning post-0012
After the `measure_amount` backfill, validate existing campaigns read correctly on `/admin/journeys` and the kid's `/campaigns` view. Spot-check the reading journey (120 min target, 15-min daily tasks) and any total-kind campaigns Lily had set up.

### 5. Phase 8 — notification dispatcher (NOT BUILT)
`notification_event` rows are already being written (incl. the new `submission_approved` on approve). The dispatcher consumes them: WhatsApp + bell routing matrix per `docs/NOTIFICATIONS.md`, quiet hours 21:00-07:00 IL, per-recipient rate limit 3/10min. Needs Twilio creds in prod `.env`. Spec is locked.

### 6. Mobile audit — remaining admin surfaces
`/admin/kids` + `/admin/tasks` were redesigned mobile-first. Still spot-check: `/admin/rewards`, `/admin/campaigns` + `campaign-form`, `/admin/redemptions`, `/admin/audit`, `/admin/feedback`, the new badge form/list, reward-form `md:grid-cols-[1fr_220px]` aside.

---

## ⚠️ Gotchas (don't re-learn these)

1. **Auto-deploy cron isn't firing.** Every deploy = manual `update-prod.sh` SSH call.
2. **PowerShell + pasting:** Lily is on Windows PowerShell 5.1. Multi-line pastes break. **Give ONE single-line command per code block.** For anything fiddly, run it yourself via the Bash tool's allowlisted SSH.
3. **Always paste the full `root@178.105.83.23` SSH URL** when handing Lily a command (her standing rule).
4. **`.env` BOM/`xx` corruption:** never edit the VPS `.env` via interactive `nano`. Use `sed`/heredoc via Bash-SSH.
5. **`docker restart` ≠ reload env.** Use `docker compose … up -d --force-recreate <svc>`.
6. **Bash glob eats `[lang]` paths.** Always **single-quote** `'apps/web/src/app/[lang]/…'` in git/shell.
7. **Postgres `uuid LIKE` errors** — cast `id::text LIKE '…'`.
8. **Zod version split:** `lib/llm/` uses `import { z } from 'zod/v4'` (Anthropic SDK's `zodOutputFormat`). Rest of app: Zod v3.
9. **Nested `<form>` is invalid HTML** — keep autofill/image-picker sub-forms outside the main form.
10. **Server actions: `redirect()` to the same URL is a no-op for RSC refresh.** Use `revalidatePath(...)` + return instead.
11. **`useActionState` has no built-in reset.** Sticky success branches need a remount key.
12. **`useState(prop)` ignores subsequent prop changes.** Re-sync with `useEffect(() => setX(prop), [prop])` when the prop is server-rendered and can change via `revalidatePath`.
13. **PIN form auto-submits on 4th digit.** Any control that needs to be set BEFORE submit must live ABOVE the keypad (not below).
14. **Credentials rule** (`feedback_credentials.md`): NEVER modify user auth (password_hash, PINs, secrets) to bypass a flow. Offer test alternatives via the wizard.
15. **AskUserQuestion wizard** for clarifying questions — not prose lists (`feedback_question_wizard.md`).
16. **Brandbook colors/semantics locked** — `CLAUDE.md` §5 + `docs/BRANDBOOK.md`. Pink = action, mint = success, yellow = currency, lavender = campaigns/long-term. Don't repurpose. Never `#000` or `#FFF` at app-bg level; never the color red (use `--pink-dark` for denial).
17. **i18n is strict** — missing dictionary key = TypeScript error. No hardcoded Hebrew/English in components.
18. **Append-only ledger** — never `UPDATE ledger_entry.amount` or `DELETE FROM ledger_entry`. Corrections are new entries (`admin_credit / admin_debit / undo / redemption_refund`) via `ledger.post()`.

---

## 🧠 Memory + docs
- Memory files auto-load (gates 0-3, live entry, credentials rule, wizard preference, Next15 server-action gotcha).
- `CLAUDE.md` = project contracts (authoritative).
- `docs/BRANDBOOK.md` = locked design system (v1.0, 2026-05-21).
- `docs/BUILD-PLAN.md` / `SCHEMA.md` / `CRON.md` / `NOTIFICATIONS.md` = engineering contracts.
- `CHANGELOG.md` — backfill the post-launch commits when you get a chance.

---

## Original phase roadmap (status)
Phases 1-7 + visual polish + Phase 7.5 + PWA basics + badge mgmt + admin app shell + repeatable tasks + journey measure model + TasKidz rebrand: **shipped**.
**Phase 8 (notification dispatcher + WhatsApp + quiet hours + rate limits) — still the big remaining feature.** Phase 9 (PWA polish, Sentry, bilingual polish, launch) — partial.
