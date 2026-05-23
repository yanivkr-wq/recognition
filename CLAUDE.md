# Project-wide rules for Claude (any session in this repo)

These rules apply to every Claude session working on Reco. Read them at session start. They are NOT optional — they're contracts that prevent specific classes of bugs and design drift we've already designed around.

---

## 🟢 Starting a fresh session? Read [`RESUME-HERE.md`](RESUME-HERE.md) FIRST.

[`RESUME-HERE.md`](RESUME-HERE.md) tells you exactly where we are in the build, what's locked, what's next, and the doc-read order. After reading it, return here for the project-wide rules.

---

## 0. Read these documents first

Before doing any non-trivial work, read the relevant doc:

| When you... | Read first |
|---|---|
| Touch any UI surface, design a component, pick a color, choose an icon, or write user-facing copy | **[`docs/BRANDBOOK.md`](docs/BRANDBOOK.md)** — the locked design system. The brandbook wins over prior decisions. |
| Build or modify a feature | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCHEMA.md`](docs/SCHEMA.md), [`docs/CRON.md`](docs/CRON.md), [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) |
| Plan or sequence work | [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) |
| Encounter an unanswered question | [`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md) — confirm or add the answer |

The visual companion to the brandbook is [`docs/brandbook.html`](docs/brandbook.html) — open it in a browser to see every component, color, icon, and pattern in action.

---

## 1. BRANDBOOK.md is the design contract

`docs/BRANDBOOK.md` is locked at v1.0 as of 2026-05-21. Every UI surface in Reco must conform.

**The brandbook wins** over:
- Decisions in earlier phases of design (Phase 3 exploration → all six explored concepts are now retired in favor of Plush + Embroidered Patch).
- Decisions in CLAUDE.md or any other doc, where they conflict.
- Existing code that drifted from the spec (file a bug; do not normalize the drift into the brandbook).

**Updating the brandbook** is a deliberate process — see §14 of the brandbook itself. Don't change tokens, fonts, badge architecture, or component rules without explicit re-confirmation from Lily.

**If you can't find a rule** for a new UI surface in the brandbook: compose from existing components (§6) and patterns (§12). If that fails, ask Lily, then add the answer to §12 (recipes) or §6 (components) once decided.

---

## 2. SPEC + ARCH + SCHEMA are the engineering contracts

`docs/ARCHITECTURE.md`, `docs/SCHEMA.md`, `docs/CRON.md`, `docs/NOTIFICATIONS.md`, and `docs/BUILD-PLAN.md` were locked at Gate 2 (2026-05-20).

- The wallet is an **append-only ledger** (`SCHEMA.md` §7). Never `UPDATE ledger_entry.amount`. Never `DELETE FROM ledger_entry`. Corrections are new entries with `kind ∈ {admin_credit, admin_debit, undo, redemption_refund}`.
- All ledger writes go through a single `ledger.post()` entry point (`apps/worker/src/ledger/post.ts`). Grep tests in CI guard against direct INSERTs.
- The wallet display is `GREATEST(0, SUM(amount))` — never a stored balance the app maintains separately.
- The streak engine is **ledger-derived**, not flag-driven. A retroactive undo of yesterday's task today MUST break yesterday's streak (`ARCHITECTURE.md` §10.2).
- The partial unique index on `task_completion(assignment_id, completion_date) WHERE undone_at IS NULL` is the double-claim prevention. Don't bypass it.

---

## 3. Kid vs admin authorization

Reco has two principal classes:
- **Admin** (parent) — Auth.js v5 session, email + password.
- **Kid** (Lia, Yael) — custom signed JWT cookie + optional device-trust cookie (no email, no password, just a 4-digit PIN).

Every server action and worker route must declare which principal it allows (`apps/web/src/lib/auth/guards.ts:requireKid()` / `requireAdmin()` / `requireKidOrAdmin()`). RLS-equivalent is enforced at the app boundary because we're not on Supabase — see `ARCHITECTURE.md` §8.

**Kid-scoped queries** must filter by `kid_id = session.kid_id`. **Admin-scoped queries** must filter by `household_id = session.household_id`. Never trust a request's `kid_id` parameter without verifying ownership.

---

## 4. Bilingual & RTL

Reco is Hebrew-default + English. Both languages are equal-tier brand citizens (see `BRANDBOOK.md` §3 + §8).

- All UI strings live in `packages/shared/src/i18n/dictionaries/{he,en}.json`. **No hardcoded Hebrew or English text in components.** A missing dictionary key is a TypeScript error.
- Use **logical CSS properties** — `padding-inline-start`, `margin-inline-end`, Tailwind's `ps-*` / `pe-*` / `ms-*` / `me-*`. **Never** `padding-left` / `margin-right` etc.
- Numbers and the brand mark "Reco" stay LTR even in Hebrew context. Force with `<span dir="ltr">` where Unicode Bidi doesn't auto-resolve.
- Hebrew uses Heebo (display 800/900, body 500). Latin uses Fredoka (display) + Quicksand (body). Never mix these — Heebo's Latin glyphs lack character.

---

## 5. Color rules (from BRANDBOOK.md §2)

- **Never** pure black `#000` — use `--ink` (`#2D2A4A`).
- **Never** pure white at app background level — use `--bg` (`#FAF8F5`). White is for cards only.
- **Never** the color red — use `--pink-dark` (`#E94B7F`) for denial states.
- **Lia is peach** (`#FF9F7A`). **Yael is sky** (`#6EC9F4`). Never reuse these colors for unrelated meanings. Never blend them on the same component.
- **Mint** = success. **Pink** = action. **Yellow** = currency. **Lavender** = campaigns / long-term. Don't repurpose semantic colors.

---

## 6. Badge architecture is locked

The badge wrapper is the **Embroidered Patch** (`BRANDBOOK.md` §5). Circular, dashed stitched border, pastel interior matching category, illustrated emblem centered, white count chip pinned below.

- **Don't** use 3D silver shields (Plush v1/v2 — rejected at Gate 3).
- **Don't** use hanging-medal ribbons (alternative B — rejected).
- **Don't** use collectible-card portrait rectangles (alternative C — rejected).
- **Don't** use emoji as badge emblems in production — use the 8 SVG emblems (or the future licensed pack).
- **Add new badges** by adding a new emblem to family 3 + a new color mapping to `BRANDBOOK.md` §5.5. Don't invent new badge architectures.

---

## 7. Notification routing

`docs/NOTIFICATIONS.md` is the locked routing matrix. Specifically:

- WhatsApp fires for: `task_reminder`, `submission_pending`, `submission_approved`, `submission_denied`, `new_redeem_item`, `campaign_nudge`. Everything else is bell-only.
- Quiet hours default: 21:00–07:00 Asia/Jerusalem, per-user adjustable. WhatsApp defers into the quiet window; bell still records.
- Per-recipient rate limit: 3 WhatsApp per 10 minutes. Excess defers to `state='rate_limited'`.

All notification writes use `INSERT ... ON CONFLICT (dedup_key, channel) DO NOTHING`. Idempotent across cron ticks.

---

## 8. Cron schedules

`docs/CRON.md` is the locked schedule:

| Schedule | Job |
|---|---|
| `*/5 * * * *` | Notification dispatcher + per-task reminder check |
| `0 0 * * *` IL | Daily reset (streak engine, birthday badges) |
| `0 1 * * *` IL | Campaign window close |
| `0 4 * * *` IL | DB nightly backup → B2 |
| `0 5 * * 0` IL | Evidence-volume weekly backup → B2 |
| `0 6 * * *` IL | Evidence photo purge (30-day TTL post-resolution) |
| `0 9 * * *` IL | Daily parent summary email (optional, feature-flagged) |

Don't add unscheduled jobs without updating `CRON.md`.

---

## 9. Infrastructure

Reco runs on the existing Hetzner CX32 VPS alongside Family_Budget_App and Family_Tasks_Hub. Same pattern, separate stack:

- Repo on disk: `/opt/recognition`
- Subdomain: `reco.my-restart.co.il`
- Containers: `reco-web` (port 3030), `reco-worker` (port 8100), `reco-pg`
- Host Caddy reverse-proxies via `infra/Caddyfile.fragment`
- Deploy: GitHub push → host cron `*/2 min` → `auto-deploy.sh` → `update-prod.sh`
- Logs: `/var/log/auto-deploy-reco.log`

**Don't introduce new vendors.** Twilio account, Anthropic account, Backblaze B2, Gmail SMTP — all reused from the other apps with new credentials/keys. Database is self-hosted Postgres in Docker; **not Supabase**.

---

## 10. Commit hygiene

- No backwards-compatibility shims. Single-user app; we own all callers.
- No new dependencies without justification in the commit message.
- Verify with `pnpm typecheck` on touched packages before declaring done.
- Per-file header comment block: 3–10 lines explaining what the file is and the non-obvious design choices. Models the convention from Family_Tasks_Hub.

---

## 11. Voice & tone

Read `BRANDBOOK.md` §10. Quick reminders:

- **Kid copy**: warm, encouraging, soft. Not babyish. Not aggressive. Direct without being curt. Selective bold for emphasis. Never "FAILED!" or "WRONG!" — always offer a path forward.
- **Admin copy**: utilitarian, attribution-clear, calm. Both parents see the same view; tone is collegial.
- **Hebrew default**: second person feminine (את) since both kids are girls.
- **No baby-talk**, no jargon, no sarcasm.
- All strings via dictionaries — see §4 above.

---

## 12. What's locked vs what's open

**Locked** (don't change without explicit re-approval):
- Concept: Plush
- Badge architecture: Embroidered Patch
- Color tokens (§2 of brandbook)
- Typography stack (§3)
- Icon families and their visual rules (§4)
- Database schema (`SCHEMA.md`)
- Cron schedules (`CRON.md`)
- Notification matrix (`NOTIFICATIONS.md`)
- Authorization model (kid + admin principals)
- Append-only ledger contract

**Open** (consult `OPEN-QUESTIONS.md`):
- Marketing materials, icon licensing source for production
- Phase 9 polish details (PWA install banner exact UX, etc.)
- v2 backlog items

---

*This document is a contract. If a rule here conflicts with code, the rule wins — file a bug. If a rule here conflicts with `BRANDBOOK.md`, the brandbook wins. Last updated: 2026-05-21.*
