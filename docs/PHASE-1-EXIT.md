# Phase 1 — Exit checklist

> Status of the Phase 1 acceptance gates from [`BUILD-PLAN.md`](./BUILD-PLAN.md#exit-criteria).
> Six gates total: four can be (and have been) verified locally against a throwaway pg
> container; two are intrinsically VPS-only and will be confirmed on first `deploy-prod.sh` run.

| # | Gate | Status | Where verified |
|---|---|---|---|
| 1 | `https://reco.my-restart.co.il/he/login` loads with valid LE cert | **Deferred** | First VPS deploy — see "VPS first-run checklist" below |
| 2 | `https://budget.my-restart.co.il/` and `https://tasks.my-restart.co.il/` still load | **Deferred** | First VPS deploy (Caddy reload check) |
| 3 | Both parents can log in to Reco | **Verified locally** | Argon2 round-trip with `mom@reco.local` + `dad@reco.local`; both received `authjs.session-token` and reached `/he/` |
| 4 | `git push` to `recognition:main` triggers auto-deploy within 4 min | **Deferred** | First post-deploy push (cron is `*/2 min`, deploy ~30s, so first push lands ≤2 min) |
| 5 | `psql reco-pg \dt` shows all 23 tables + `__migrations` | **Verified locally** | 26 tables present: 22 domain + 3 Auth.js (`session`/`account`/`verification_token`) + `__migrations` |
| 6 | Sample-seed data is present: 6 tasks, 6 rewards, 8 badges, 2 kids without PINs | **Verified locally** | Counts confirmed: 1 household, 2 parent users, 2 kids (with sentinel placeholder PIN hashes that always fail verify), 6 tasks, 6 rewards, 8 badges |

---

## Locally-verified evidence (2026-05-21)

Against the throwaway `postgres:16-alpine` container on port 5433 + dev preview server on port 3030.

### Schema (gate 5)

```
 26 tables    (22 domain + 3 Auth.js + __migrations)
 22 domain    (per docs/SCHEMA.md — household, user, kid, device_trust, task_template,
                task_assignment, task_reminder, evidence, submission, task_completion,
                long_term_progress, reward_item, badge, campaign, campaign_feeding_task,
                kid_badge, campaign_enrollment, notification_event, campaign_nudge_log,
                redemption, ledger_entry, audit_log)
```

40 indexes total, including the partial-unique `task_completion_assignment_date_active`
(`WHERE undone_at IS NULL`) that's the double-claim prevention.

### Seed counts (gate 6)

```
 households | users | kids | tasks | rewards | badges | migrations
------------+-------+------+-------+---------+--------+------------
          1 |     2 |    2 |     6 |       6 |      8 |          2
```

Both kids have placeholder PIN hashes (all-zero-byte Argon2id):

```
 name | pin_is_placeholder
------+--------------------
 Lia  | t
 Yael | t
```

The hashes are syntactically valid Argon2id strings but fail every verification —
i.e., the kids exist in the DB with `color=#FF9F7A` (Lia) / `#6EC9F4` (Yael) per
BRANDBOOK §2.2, but no PIN actually works until an admin sets one via the Phase 2
admin UI (`/admin/kids/<id>/pin`). This matches the gate's "without PINs" intent.

### Parent login (gate 3)

Full credentials flow exercised end-to-end:

| Email | Password (dev only) | CSRF → POST | Session cookie issued | `/he/` reaches home |
|---|---|---|---|---|
| `mom@reco.local` | `TestPass123` | 302 → `/he/` | `authjs.session-token` | 200 with "Welcome back, Mom" |
| `dad@reco.local` | `DadPass456` | 302 → `/he/` | `authjs.session-token` | 200 with "Welcome back, Dad" |

Wrong-password rejection verified separately: 302 → `/he/login?error=CredentialsSignin`,
no session cookie issued, `user.failed_login_count` incremented by 1.

---

## VPS first-run checklist (gates 1, 2, 4)

Run on the Hetzner host the first time, in this order. Each step is a checkable item.

- [ ] **DNS:** `A reco.my-restart.co.il` → VPS IP (Box DNS panel). Provision before first deploy.
- [ ] **GitHub deploy key:** SSH key with read access to the `recognition` repo in `~/.ssh`, added to GitHub.
- [ ] **Caddy `conf.d` import:** `/etc/caddy/Caddyfile` must contain `import /etc/caddy/conf.d/*.caddy`. `deploy-prod.sh` warns if missing.
- [ ] **First install:**
  ```
  ssh hetzner
  sudo mkdir -p /opt/recognition && sudo chown $(id -u):$(id -g) /opt/recognition
  cd /opt
  git clone git@github.com:lilydrkr/recognition.git
  cd recognition/infra
  ./deploy-prod.sh
  ```
  Expected output: secrets generated, images built, stack up, smoke-test green, Caddy
  fragment installed + reloaded, auto-deploy cron line added.
- [ ] **Gate 1:** Open `https://reco.my-restart.co.il/he/login` in a browser. Verify (a) valid Let's Encrypt cert, (b) brandbook-styled login card renders, (c) RTL layout with "כניסת הורים" subtitle.
- [ ] **Gate 2:** Open `https://budget.my-restart.co.il/` and `https://tasks.my-restart.co.il/` in the same session. Confirm both still load after the Caddy reload.
- [ ] **Gate 3 (re-verify):** With real parent credentials set via psql (`UPDATE "user" SET password_hash = ... WHERE email = ...`), log in as each parent. Confirm landing on `/he/`.
- [ ] **Gate 4:** From your local machine, push a trivial commit to `recognition:main`. Within ≤2 min the cron should fire `auto-deploy.sh`; within ≤2 more min the new commit is live. Watch `tail -f /var/log/auto-deploy-reco.log`.

---

## What's not in scope for Phase 1 (and so isn't on this list)

These are deliberately deferred to later phases — don't expect them at Phase 1 exit:

- **Kid auth UI** (profile picker, PIN entry, device trust) — Phase 2.
- **Any kid-facing surface** (home, tasks, wallet, redeem, campaigns, badges) — Phases 3–7.
- **Parent admin pages** (tasks editor, approvals queue, joker, audit) — Phases 3, 5, 6.
- **Notifications** (bell, WhatsApp dispatch, quiet hours) — Phase 8.
- **Bilingual polish + PWA install + Sentry** — Phase 9.

---

## Handoff notes

### What changed between Gate 2 (plan) and Phase 1 (build)

| Item | Note |
|---|---|
| Schema table count | docs/SCHEMA.md says "23 tables" in the prose; the section-by-section count is 22 domain. The Auth.js trio + `__migrations` bring the physical count to 26. No structural change. |
| `kid_badge` UNIQUE | Implemented as `NULLS NOT DISTINCT` (Postgres 15+) to enforce the documented "earned once" semantics for non-yearly badges. Surfaced in sub-1b CHANGELOG. |
| Worker runtime | `tsx` in both dev and prod (no separate `tsc → dist/`). Simplifies the Dockerfile + matches the worker's actual usage. |
| Web → worker import quirk | All `.js` suffixes in relative imports across `packages/db/src/**` and `packages/shared/src/**` were stripped because Turbopack's edge bundler didn't resolve them under `transpilePackages`. Extensionless works across tsc, tsx, vitest, Next, and node-postgres. |

### Phase 2 entry-condition reminders

[`BUILD-PLAN.md`](./BUILD-PLAN.md#phase-2--kid-auth-netflix-picker--pin--device-trust) Phase 2 requires:

- [x] All Phase 1 exit criteria met (this file).
- [ ] **Both kids' initial PINs decided.** Lily picks two 4-digit PINs for Lia and Yael. The admin UI for setting them lands in Phase 2 (`/admin/kids/<id>/pin`) — but the values themselves are a human decision.

### Throwaway dev environment

If you want to keep poking at the local stack between phases:

- Throwaway pg container: `docker ps --filter name=reco-pg-smoke` (port 5433, ICU `he-IL`).
- Migrations applied + seed loaded.
- Both parent passwords set in DB: `mom@reco.local` / `TestPass123`, `dad@reco.local` / `DadPass456`.
- Both kid PIN hashes are sentinel placeholders (Phase 2 will replace).
- Preview dev server: `apps/web` via `mcp__Claude_Preview__preview_start name=reco-web` (port 3030).
- `.env.local` files: `apps/web/.env.local`, `apps/worker/.env.local` (gitignored).

Tear down with `docker stop reco-pg-smoke` and the preview-stop tool.

---

*Last updated: 2026-05-21. Phase 1 build complete; Phase 2 (kid auth) is next.*
