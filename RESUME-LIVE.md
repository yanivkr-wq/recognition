# 🟢 RESUME-LIVE — Reco is in production

> **Fresh session: read this FIRST, then `CLAUDE.md`.** This file supersedes `RESUME-HERE.md` for day-to-day work — `RESUME-HERE.md` describes the pre-launch build (Phases 1-9 plan); this file describes the **live production app** and how we now work against it. Last updated: 2026-05-24.

---

## TL;DR — what changed

Reco went **live on the Hetzner VPS** on 2026-05-24. We now **develop against production** (Lily's explicit choice): edit locally → commit → push to GitHub → rebuild on the VPS → verify on the live URL. No more preview-only iteration.

- **Live URL:** https://reco.my-restart.co.il (Hebrew default, RTL, TLS via Caddy/Let's Encrypt)
- **GitHub repo:** https://github.com/yanivkr-wq/recognition (PUBLIC, `main` branch)
- **VPS:** Hetzner `178.105.83.23`, SSH user **root**, key `~/.ssh/hetzner_budget` (shared box with family-budget + family-tasks-hub)
- **Repo on VPS:** `/opt/recognition`
- **Containers:** `reco-web` (:3030), `reco-worker` (:8100), `reco-pg` — all under docker compose, behind host Caddy

---

## ▶️ The deploy loop (how to ship a change)

1. Edit code locally
2. `pnpm --filter @reco/web typecheck` (and `@reco/shared` if you touched i18n) — must be clean
3. Commit + `git push` (git commit/push are allowlisted; pushing to main is the workflow)
4. **Rebuild on the VPS** — the auto-deploy cron is NOT firing (see Gotchas), so run it manually:
   ```bash
   ssh -i ~/.ssh/hetzner_budget root@178.105.83.23 "bash /opt/recognition/infra/update-prod.sh"
   ```
   That does `git pull` + `docker compose build` + `up -d` + smoke test (~3-5 min; the trailing `web=200 worker=200` line = success). The `curl: (56) Recv failure` lines during the smoke loop are just the container warming up — ignore them.
5. Verify on https://reco.my-restart.co.il (hard-refresh; the kid pages especially cache).

**Claude can SSH/scp to the VPS directly** — `Bash(ssh -i /c/Users/Lilyd/.ssh/hetzner_budget root@178.105.83.23:*)` and `scp` are allowlisted in `~/.claude/settings.json`. The auto-mode classifier may still ask for fresh confirmation before *first* prod-touching action in a session — that's expected; just confirm.

---

## 🔑 Production facts (the live DB + secrets)

- **Parent login:** `mom@reco.local` — password was set this session (Lily knows it; it is NOT in any file or memory). `dad@reco.local` still has the unmatchable placeholder hash.
- **Kid PINs: NOT set yet.** Lia + Yael can't log in until an admin sets their PIN at `/he/admin/kids/<id>/pin`. Kid UUIDs: Lia `33333333-3333-3333-3333-333333333301`, Yael `…302`. Household `11111111-…-111111111111`.
- **Content seeded:** 36 task templates (6 original + 30 age-appropriate), 16 rewards (6 original + 10), 15 tasks assigned to each kid. All in prod DB (`packages/db/seeds/2026-05-23_age_appropriate_tasks.sql`, idempotent).
- **`.env` on VPS** (`/opt/recognition/.env`, chmod 600): has POSTGRES_PASSWORD, AUTH_SECRET, MASTER_KEY, WORKER_INTERNAL_TOKEN (auto-generated), `ANTHROPIC_API_KEY` (real, set this session for the LLM autofill), `WHATSAPP_DRY_RUN=true`. Twilio/SMTP/B2/Sentry still blank.
- **psql access:** `ssh … "docker exec -i reco-pg psql -U reco -d reco"` — connects via unix socket trust-auth (no password). Pipe SQL via stdin: `'SELECT …;' | ssh … "docker exec -i reco-pg psql -U reco -d reco"`.

---

## ✅ Shipped this session (newest first — all live)

| Commit | What |
|---|---|
| `3a2a16b` | middleware: exclude `/icon0` `/icon1` `/apple-icon` `/manifest.webmanifest` from locale routing |
| `7571ffe` | **PWA basics** (manifest.ts + icon0/icon1/apple-icon via ImageResponse + theme color) **+ undo button in needsPhoto task state** |
| `b5fe7f0` | **LLM autofill** "✨ מלא אוטומטית" on task + reward forms (`lib/llm/`, claude-sonnet-4-6, Zod-v4 structured output, HE→EN + icon + color) |
| `f7deda7` | deploy-prod.sh: add ANTHROPIC_API_KEY to .env heredoc |
| `9214368` | admin polish: TaskIcon on /admin/tasks list + live kid-eye reward preview in reward form |
| `4c10229`+`99d33ce` | **task-card redesign** (full 2-line title, pink icon "do" button, big mint check on done, undo icon, mint tint, 44×44 tap, motion-safe scale-in) |
| `8ec26ba` | **bulk per-kid task assign** `/admin/kids/[id]/tasks` (checkbox list + select-all/clear-all) |
| `ebcd973`+`895c4e1` | age-appropriate bulk seed (30 tasks + 10 rewards) |
| `076b42a` | fix switch-user redirect (was → `0.0.0.0:3030`, now relative) |
| earlier | reward image upload (`lib/reward-images/`), first deploy + infra fixes |

---

## ✅ Shipped 2026-05-24/25 (post-launch — DONE, all live)
These were the two open requests from the previous handoff; both done, plus branding:
- **Badge management** (`/admin/badges` CRUD + form) — DONE. Real `em-*` SVG emblems (themed), color picker, **AI emblem + EN + color suggestion** in the badge form (autofill `family: 'badge'`), custom image upload, emblem-replaces-image. Feeds the campaign badge picker so badges associate to journeys. Commits `e7eb3a8`, `371d03b`, `866672e`, `f984999`, `dae5356`, `2df6b0a`.
- **Mobile** — `/admin/kids` redesigned mobile-first; `/admin/tasks` rows now wrap title + move actions to a footer (`32a0e64`, `866672e`). (Spot-check the *rest* of admin still — see audit below.)
- **Branding** (`f72bfce`) — `RecoMark` component (embroidered patch + gold coin) replaces the letter-"R" launcher icon across icon0/icon1/apple-icon; splash intro; revamped pick page. `docs/logo-explorations.html` is a scratch file (untracked).
- LLM autofill now covers task + reward + **badge** families (`lib/llm/suggest-fields.ts` has the `em-*` catalog + `BADGE_COLORS`).

---

## 🔜 IN-FLIGHT — pick up here

### Full refresh / revalidation audit (Task #3) — STARTED, NOT FIXED
**Lily's report:** "many pages have a refresh issue — save works but the page doesn't update until a manual refresh; the feedback button can't send a second feedback without restarting the app." She wants a **full validation that every page saves + behaves correctly**.

Two root-cause families identified:

**PATTERN A — sticky `useActionState` success (re-submit blocked):**
- **CONFIRMED** in `apps/web/src/components/feedback-button.tsx`: after a successful submit, `state.ok` stays `true` forever (useActionState has no built-in reset). The modal renders `{state?.ok ? <success> : <form>}`, so once it succeeds it's stuck on the success message — reopening the modal shows success, never a fresh form. That's the "can't send another feedback" bug.
- **FIX:** extract the modal+form into a child component **keyed by an incrementing open-counter** so `useActionState` remounts (resets to `undefined`) every time the modal opens. Then audit every other `useActionState` form that renders a sticky success branch for the same trap.

**PATTERN B — `useState(prop)` never re-syncs after `revalidatePath` (save persists, UI stale until manual refresh):**
- Suspect: `KidTasksForm` (`/admin/kids/[id]/tasks`) seeds `checked` from the `initiallyChecked` prop via `useState`, never re-syncs → bulk-assign "only saves after manual refresh."
- Memory already documents kid-home wallet had this *exact* bug (fixed with `useEffect(() => setX(prop), [prop])`). **Audit ALL `'use client'` components that initialize local state from a server prop.**

**Progress so far:** grepped every `revalidatePath` call (all live in `lib/*/actions.ts` — paths look mostly right: `'/[lang]/admin'` layout + page-specific). Next steps: (1) fix feedback-button (Pattern A), (2) sweep all client forms for Pattern B, (3) verify each mutating action's `revalidatePath` targets the page that actually shows the data, (4) exercise the real flows on prod (feedback resubmit, bulk-assign save, task complete/undo, redeem, joker, badge create/edit, campaign create) to validate end-to-end.

### Mobile — finish the sweep
Mobile redesign done for `/admin/kids` + `/admin/tasks`. Still spot-check: `/admin/rewards`, `/admin/campaigns` + `campaign-form`, `/admin/redemptions`, `/admin/audit`, `/admin/feedback`, reward-form `md:grid-cols-[1fr_220px]` aside, `/admin/kids/[id]/tasks` sticky save bar, the new badge form/list.

---

## ⚠️ Gotchas learned this session (don't re-learn these)

1. **Auto-deploy cron isn't firing.** `deploy-prod.sh` installs `/etc/cron.d/reco-auto-deploy` but `/var/log/auto-deploy-reco.log` never appears → cron never runs. Until fixed, every deploy needs the manual `update-prod.sh` SSH call. (Deferred diagnostic — sibling apps don't use this cron pattern either.)
2. **PowerShell + pasting:** Lily is on Windows PowerShell 5.1. Pasting multi-line chat text into it causes cascading parse errors, and she sometimes pastes chat output back. **Give ONE single-line command per code block, nothing else around it.** For anything fiddly (psql, nano, multi-step), prefer running it yourself via the Bash tool's SSH (you have the allowlist) rather than handing her a command.
3. **`.env` BOM/`xx` corruption:** editing the VPS `.env` via `nano` over SSH from Windows injected stray bytes that broke `docker compose` env parsing. If `.env` edits are needed, do them via `sed`/`docker exec` from the Bash tool, not interactive nano.
4. **`docker restart` ≠ reload env.** To pick up new `.env` vars you must `docker compose … up -d --force-recreate <svc>`, not `docker restart`.
5. **Bash glob eats `[lang]` paths.** `git add apps/web/src/app/[lang]/…` silently matches nothing (brackets = glob char class). **Always quote paths containing `[lang]`** in git/shell commands.
6. **Postgres `uuid LIKE` errors** — cast `id::text LIKE '…'`.
7. **Zod version split:** the Anthropic SDK's `zodOutputFormat` needs **Zod v4** (`import { z } from 'zod/v4'`). The rest of the app uses Zod v3 (`from 'zod'`). Keep the v4 import scoped to `lib/llm/`.
8. **Nested `<form>` is invalid HTML** — the reward image picker + autofill sub-forms live outside the main form for this reason.
9. **Credentials rule (memory `feedback_credentials.md`):** NEVER modify user auth (password_hash, PINs, secrets) to bypass a flow, even "restore after." Already bit us once this session.

---

## 🧠 Memory + docs
- Memory files auto-load (gates 0-3, credentials rule, wizard preference, Next15 server-action gotcha). The credentials rule is load-bearing — respect it.
- `CLAUDE.md` = project contracts (append-only ledger, RLS-at-app-boundary, brandbook locked, bilingual, no-emoji-emblems, etc.). Still authoritative.
- `CHANGELOG.md` — append after each sub-milestone (has entries through the reward-image work; the live-deploy session's commits aren't all logged there yet — worth backfilling).
- Lily wants clarifying questions via the **AskUserQuestion wizard**, not prose lists.

---

## Original phase roadmap (still partially open)
Phases 1-7 + visual polish + Phase 7.5 shipped pre-launch. **Phase 8 (notification dispatcher + WhatsApp + quiet hours + rate limits + bell UI) is the big remaining feature** — `notification_event` rows are already being written; the dispatcher consumes them. Needs Twilio creds in prod `.env`. Phase 9 (PWA — partially done now, + Sentry + bilingual polish + launch) is the other. See `RESUME-HERE.md` §Phase 8 + `docs/BUILD-PLAN.md` for the locked spec.
