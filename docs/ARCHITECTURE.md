# Reco — Architecture Reference

> Bilingual (Hebrew default + English), self-hosted, two-kid + two-parent PWA for chores, rewards, and time-boxed campaigns. Runs alongside `family-budget-app` and `family-tasks-hub` on a single Hetzner CX32 VPS, sharing the same Caddy host instance. This document describes the production architecture so future contributors (and future-Claude) can evaluate which pieces to extend, replace, or leave alone. Companion to `SCHEMA.md`, `CRON.md`, `NOTIFICATIONS.md`, `BUILD-PLAN.md`, and (forthcoming) `BRANDBOOK.md`.

---

## Table of contents

1. [Tech stack summary](#1-tech-stack-summary)
2. [Hosting & infra](#2-hosting--infra)
3. [Container topology](#3-container-topology)
4. [Monorepo layout](#4-monorepo-layout)
5. [Web vs Worker split](#5-web-vs-worker-split)
6. [External integrations](#6-external-integrations)
7. [Security model](#7-security-model)
8. [Kid vs admin authorization model](#8-kid-vs-admin-authorization-model)
9. [Evidence photo handling](#9-evidence-photo-handling)
10. [Three key flows diagrammed](#10-three-key-flows-diagrammed)
11. [Deploy pipeline](#11-deploy-pipeline)
12. [Reused from the other apps](#12-reused-from-the-other-apps)
13. [Net-new in this app](#13-net-new-in-this-app)
14. [Gotchas inherited & gotchas to know](#14-gotchas-inherited--gotchas-to-know)

---

## 1. Tech stack summary

| Layer | Tech | Why this, not the alternative |
|---|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4 | Match Family_Tasks_Hub's modern stack. RSC reduces JS payload; App Router fits the per-feature mental model. |
| Backend (web) | Next.js server actions | Mutations co-locate with pages; type-safe DB access. |
| Backend (worker) | Fastify 5 | Long-running Node process for cron + notification dispatch. Same as the other apps. Smaller surface than Express; first-class TypeScript. |
| Database | PostgreSQL 16 + Drizzle ORM + raw SQL migrations | Type-safe ORM, hand-written migrations for legibility. ICU `he-IL` locale for Hebrew collation. |
| Auth — parents | Auth.js v5 (NextAuth beta), email + password (Argon2), DB-backed sessions | Pattern-port from `family-tasks-hub/apps/web/src/lib/auth.config.ts`. |
| Auth — kids | Custom: Netflix-style profile picker + 4-digit PIN, device-bound trust cookie | Net-new. Not Auth.js; sits alongside it. Kid sessions are short-lived JWT scoped to a single kid + device. |
| AI | None in v1 | Reco doesn't extract anything from free-form input. Flagged for v2 if we add things like "auto-suggest tasks." |
| WhatsApp | Twilio Sandbox — outbound only via direct `fetch` to Twilio REST | Same account as Family_Tasks_Hub. Reco writes its own ~30-line `sendWhatsApp` adapter (pattern reuse, not code import). No inbound (account-singleton owned by Family_Tasks_Hub). |
| Email outbound | Gmail SMTP via `nodemailer`, pooled transport, dedicated app-password | Reused pattern from `family-tasks-hub/apps/worker/src/notifications/channels.ts`. |
| Evidence storage | Local Docker volume mounted into `reco-worker`, served by session-gated worker route | Best privacy posture for minors' photos. Photos never transit a third-party. |
| Backups | `@aws-sdk/client-s3` → Backblaze B2 (S3 API). DB nightly, evidence-volume weekly. | Pattern from the other apps. Two new buckets: `reco-backups`, `reco-evidence-backup`. |
| Reverse proxy | Caddy 2.8 (host-installed) | Existing host instance handles `budget.my-restart.co.il` and `tasks.my-restart.co.il`. Reco adds `reco.my-restart.co.il`. |
| Container | Docker Compose | One file per app, one VPS, three `docker compose up`s. No K8s. |
| Host | Same Hetzner CX32 (4 vCPU / 8 GB / 80 GB SSD) | Resource headroom is comfortable (~3-4 GB RAM, 80% CPU spare). |
| Observability | Pino logs (worker) + Sentry (web + worker) + optional daily summary email | Same as Family_Tasks_Hub. New Sentry project for Reco. |
| i18n | Per-locale JSON dictionaries + `@formatjs/intl-localematcher` + `negotiator` | Family_Tasks_Hub pattern, copy-adapted. |
| Testing | Vitest (unit + integration), Playwright for kid-flow E2E | Vitest matches the other apps. Playwright net-new for Reco — the kid UX has enough state machines (undo, approval race) to warrant browser-level tests. |
| Package manager | pnpm 9 + workspaces | `@reco/*` scope. |
| Runtime | Node.js 22+ LTS | Native ESM, native `fetch`. |
| Language | TypeScript strict mode | No `any`. |

---

## 2. Hosting & infra

| | |
|---|---|
| **Provider** | Hetzner Cloud (existing account) |
| **Instance** | Same CX32 that runs Family_Budget_App and Family_Tasks_Hub |
| **OS** | Ubuntu 24.04 LTS |
| **TLS** | Host Caddy + Let's Encrypt for `reco.my-restart.co.il` |
| **Repo on disk** | `/opt/recognition` (codename path; user-facing brand "Reco" only affects content, not paths) |
| **Source of truth** | New private GitHub repo `recognition` |
| **Cost** | €0 marginal — shares the existing CX32. Twilio messages incur per-WhatsApp pricing (Sandbox is free for opt-in numbers). Anthropic spend: $0 (Reco has no AI in v1). B2 marginal: a few cents/month. |

**Resource budget on the shared CX32 with Reco added** (approximate):

| Container | RAM | CPU steady-state |
|---|---|---|
| budget-* (web + worker + pg) | ~700 MB | <15% |
| tasks-* (web + worker + pg) | ~600 MB | <10% |
| **reco-web** | 250 MB | <5% |
| **reco-worker** | 150 MB | <5% |
| **reco-pg** | 200 MB | <5% |
| Caddy (host) | 80 MB | <2% |
| **Headroom** | ~2-3 GB / 60% CPU | Still comfortable |

---

## 3. Container topology

```
                          Internet
                              │
                              ▼
                ┌──────────────────────────┐
                │  CADDY (host-installed)  │  ports 80/443  → reverse proxy + TLS
                │  /etc/caddy/Caddyfile    │  imports per-app fragments
                └────┬───────┬──────────┬──┘
                     │       │          │
       budget.my-restart  tasks.my-restart  reco.my-restart
                     │       │          │
                 (existing stacks)      ▼
                                  ┌───────────────────┐
                                  │   RECO STACK      │
                                  │     (new)         │
                                  └─────┬─────────────┘
                                        │
                  ┌─────────────────────┴────────────────────┐
                  ▼                                            ▼
            ┌──────────────────┐                       ┌──────────────────┐
            │   reco-web       │ ──── private docker ──│  reco-worker     │
            │   Next.js 16     │   net, Bearer auth    │  Fastify 5       │
            │   :3030          │ ◄─────────────────────│  :8100           │
            └────────┬─────────┘                       └────────┬─────────┘
                     │ SQL                                      │ SQL
                     └─────────────────┬────────────────────────┘
                                       ▼
                              ┌──────────────────┐
                              │    reco-pg       │   PG 16, ICU he-IL
                              │   pg 16          │   not exposed to host
                              └──────────────────┘

Caddy path-routes inside reco.my-restart.co.il:
  /api/internal/*    ──► reco-worker:8100   (web→worker private RPC over Caddy isn't needed,
                                              but the route exists for ops endpoints)
  /api/admin/*       ──► reco-web:3030
  /api/kid/*         ──► reco-web:3030
  everything else    ──► reco-web:3030
```

**Ports chosen to not collide:** budget uses 3000/8080, tasks uses 3020/8090, Reco uses **3030/8100**.

**Why preserve the web/worker split** (Reco has no Puppeteer or vision)?
1. **Cron schedules live in a long-lived process.** node-cron in worker is the simplest reliable scheduling primitive. Doing it in Next.js means either external host cron (adds an auth-shared-secret surface) or fragile setInterval in route handlers.
2. **Restart-cadence isolation.** Web restarts on every UI iteration (~10s); worker holds the cron schedules + the notification dispatcher. Cron skipping a tick because a UI bug pushed a restart is a real failure mode worth designing out.
3. **Cleaner code organization.** Dispatcher, photo purge, B2 backup, and the streak-evaluation cron all live in `apps/worker/src/cron/`. They never touch user UI code.
4. **Symmetry with the other two apps** — if you've maintained one, you can maintain Reco.

Reco's worker is the smallest of the three (no Puppeteer, no Anthropic vision, no Postmark inbound). 150 MB steady-state is realistic.

---

## 4. Monorepo layout

```
recognition/
├─ apps/
│   ├─ web/                   # Next.js 16 + React 19 + Tailwind 4
│   │   ├─ src/
│   │   │   ├─ app/
│   │   │   │   ├─ [lang]/
│   │   │   │   │   ├─ layout.tsx
│   │   │   │   │   ├─ page.tsx              # kid home (wallet + today's tasks)
│   │   │   │   │   ├─ tasks/                # full task list, daily + long-term
│   │   │   │   │   ├─ campaigns/            # active campaigns, badges
│   │   │   │   │   ├─ redeem/               # reward shop
│   │   │   │   │   ├─ wallet/               # ledger history
│   │   │   │   │   ├─ badges/               # collection view
│   │   │   │   │   ├─ admin/                # parent admin pages — only accessible to user role=admin
│   │   │   │   │   │   ├─ tasks/
│   │   │   │   │   │   ├─ rewards/
│   │   │   │   │   │   ├─ campaigns/
│   │   │   │   │   │   ├─ kids/
│   │   │   │   │   │   ├─ approvals/        # pending submissions queue
│   │   │   │   │   │   ├─ ledger/           # joker UI — any-kid wallet edit
│   │   │   │   │   │   ├─ audit/            # parent-only audit feed
│   │   │   │   │   │   └─ reports/
│   │   │   │   │   ├─ pick/                 # Netflix-style profile picker landing
│   │   │   │   │   │   └─ [kidSlug]/page.tsx # PIN entry
│   │   │   │   │   ├─ login/                # parent login
│   │   │   │   │   └─ dictionaries/{he,en}.json
│   │   │   │   └─ api/
│   │   │   │       ├─ auth/[...nextauth]/   # Auth.js v5 (parents only)
│   │   │   │       ├─ kid-session/          # kid PIN-auth endpoint (custom)
│   │   │   │       └─ health/
│   │   │   ├─ middleware.ts                 # locale + parent-session + kid-session resolution
│   │   │   └─ lib/
│   │   │       ├─ auth.config.ts            # ported from family-tasks-hub
│   │   │       ├─ kid-auth.ts               # NET-NEW: PIN verify, trust-cookie issue
│   │   │       ├─ i18n.ts
│   │   │       └─ ...
│   │   ├─ public/
│   │   │   ├─ manifest.json                 # PWA, two manifests: kid + admin (or one with role-based name)
│   │   │   ├─ sw.js                         # minimal pass-through
│   │   │   └─ icons/                        # generated by scripts/generate-icons.mjs
│   │   └─ next.config.ts
│   │
│   └─ worker/                # Fastify 5
│       ├─ src/
│       │   ├─ server.ts
│       │   ├─ routes/
│       │   │   ├─ evidence.ts               # GET /api/internal/evidence/:id — session-gated photo serve
│       │   │   └─ healthz.ts
│       │   ├─ notifications/
│       │   │   ├─ channels.ts               # PATTERN-PORT from family-tasks-hub: sendWhatsApp, sendEmail, sendInApp
│       │   │   ├─ dispatcher.ts             # NET-NEW for Reco's event taxonomy
│       │   │   ├─ rate-limiter.ts           # NET-NEW: 3-per-10min throttle per recipient
│       │   │   ├─ quiet-hours.ts            # NET-NEW: defer→resume logic
│       │   │   └─ templates.he.ts / .en.ts  # bilingual message templates
│       │   ├─ cron/
│       │   │   ├─ index.ts                  # node-cron registry
│       │   │   ├─ dispatcher.ts             # */5 min — fires reminders, submissions, nudges
│       │   │   ├─ daily-reset.ts            # 00:00 IL — bucket old completions, advance streaks
│       │   │   ├─ campaign-window.ts        # 01:00 IL — close expired campaigns
│       │   │   ├─ evidence-purge.ts         # 06:00 IL — 30-day photo TTL
│       │   │   ├─ db-backup.ts              # 04:00 IL — pg_dump → B2
│       │   │   ├─ evidence-volume-backup.ts # Sun 05:00 IL — tarball volume → B2
│       │   │   └─ daily-summary.ts          # 09:00 IL — optional parent summary email
│       │   ├─ campaigns/
│       │   │   ├─ streak-engine.ts          # NET-NEW
│       │   │   └─ total-engine.ts           # NET-NEW
│       │   ├─ ledger/
│       │   │   └─ post.ts                   # NET-NEW: append-only writer with invariants
│       │   ├─ config.ts                     # env parsing + Zod schema
│       │   └─ logger.ts                     # pino
│       └─ Dockerfile  → infra/Dockerfile.worker
│
├─ packages/
│   ├─ db/                    # Drizzle schema + raw SQL migrations
│   │   ├─ src/
│   │   │   ├─ schema/        # one file per logical area (household, kid, tasks, rewards, ledger, campaigns, ...)
│   │   │   ├─ helpers/
│   │   │   │   ├─ encrypt.ts                # PATTERN-PORT — for kid PIN at rest, trust-cookie tokens
│   │   │   │   └─ migrate.ts                # raw-SQL applier
│   │   │   └─ index.ts                      # getDb() singleton
│   │   ├─ migrations/
│   │   │   ├─ 0001_init.sql                 # ~22 tables (see SCHEMA.md)
│   │   │   ├─ 0002_seed_household.sql       # household + admin users + 2 kids
│   │   │   ├─ 0003_seed_taxonomy.sql        # 6 sample tasks + 6 sample rewards + 8 starter badges
│   │   │   └─ ...
│   │   └─ package.json
│   │
│   └─ shared/                # i18n keys, format helpers, shared types
│       ├─ src/
│       │   ├─ i18n/
│       │   │   ├─ dictionaries.ts           # Dictionary type
│       │   │   ├─ he.json
│       │   │   ├─ en.json
│       │   │   └─ locale-matcher.ts
│       │   ├─ format/
│       │   │   ├─ coins.ts                  # "5 coins" / "5 מטבעות" pluralization
│       │   │   └─ date.ts
│       │   └─ types/
│       │       └─ index.ts                  # Kid, TaskTemplate, Campaign, LedgerEntry, ...
│       └─ package.json
│
├─ infra/
│   ├─ docker-compose.yml                    # reco-web + reco-worker + reco-pg + evidence-volume
│   ├─ docker-compose.test.yml
│   ├─ Dockerfile.web
│   ├─ Dockerfile.worker
│   ├─ Caddyfile.fragment                    # reco.my-restart.co.il block
│   ├─ deploy-prod.sh                        # idempotent first-install (PATTERN-PORT)
│   ├─ update-prod.sh                        # called by auto-deploy
│   └─ auto-deploy.sh                        # host cron
│
├─ scripts/
│   ├─ generate-icons.mjs                    # PATTERN-PORT from family-tasks-hub
│   ├─ seed-dev.ts                           # local dev seed
│   └─ kid-pin-rotate.ts                     # ops helper to reset a forgotten PIN
│
├─ docs/
│   ├─ ARCHITECTURE.md                       # this file
│   ├─ SCHEMA.md
│   ├─ CRON.md
│   ├─ NOTIFICATIONS.md
│   ├─ BUILD-PLAN.md
│   ├─ OPEN-QUESTIONS.md
│   ├─ BRANDBOOK.md                          # forthcoming Phase 3
│   └─ TESTING.md                            # forthcoming
├─ CLAUDE.md
├─ README.md
├─ tsconfig.base.json
├─ pnpm-workspace.yaml
└─ package.json
```

---

## 5. Web vs Worker split

| Concern | Lives in **web** | Lives in **worker** |
|---|---|---|
| Kid UI (profile picker, home, tasks, redeem, wallet, campaigns) | ✅ | ❌ |
| Parent admin UI | ✅ | ❌ |
| Parent auth (Auth.js v5 login, sessions) | ✅ | ❌ |
| Kid PIN-auth endpoint (custom) | ✅ | ❌ |
| Server actions (complete task, log progress, redeem, approve, joker actions) | ✅ | ❌ |
| Ledger writes (append-only, invariant-enforced) | ✅ (server actions) + ✅ (worker for cron-triggered entries) | shared |
| Evidence photo upload (multipart receive, write to volume, INSERT evidence row) | ✅ (server action) | ❌ |
| Evidence photo serve (session-gated GET) | ❌ | ✅ (`apps/worker/src/routes/evidence.ts`) |
| Notification dispatcher cron | ❌ | ✅ |
| Daily reset cron | ❌ | ✅ |
| Campaign window-close cron | ❌ | ✅ |
| Streak / total engine evaluation | ❌ | ✅ (called from cron + from web server actions) |
| Evidence photo purge cron | ❌ | ✅ |
| DB backup cron | ❌ | ✅ |
| Outbound delivery (Twilio + SMTP + in-app write) | ❌ | ✅ |

**Why serve evidence photos from the worker** (not the web)?

The worker has the local volume mount; the web doesn't (clean separation). The worker route is `GET /api/internal/evidence/:id` with a Bearer-token session check (kid-session for self, admin-session for any). Caddy path-routes `/api/internal/evidence/*` directly to `reco-worker:8100`. Same-origin from the kid's PWA, no CORS surface.

**Web → Worker communication:**

Same poor-man's-mTLS as the other apps: web POSTs to `http://reco-worker:8100` over the private Docker network with `WORKER_INTERNAL_TOKEN` Bearer. Used for:
- Triggering an immediate notification fire from a server action (e.g., "kid submitted approval — ping parents now, don't wait for `*/5 min` tick")
- Ops endpoints: re-run daily reset, force-purge evidence, etc.

For most reads the web just queries Postgres directly. The web-worker hop is reserved for "this should happen now" pushes.

---

## 6. External integrations

| System | Used for | Lib / mechanism | Env vars |
|---|---|---|---|
| **Twilio (Sandbox WhatsApp)** | Outbound notifications | Direct `fetch` to Twilio REST API | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| **Gmail SMTP** | Optional daily parent summary email + password reset emails | `nodemailer` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| **Backblaze B2** | Two buckets: `reco-backups` (DB nightly) + `reco-evidence-backup` (volume tarball weekly) | `@aws-sdk/client-s3` | `B2_ENDPOINT`, `B2_BUCKET_DB`, `B2_BUCKET_EVIDENCE`, `B2_KEY_ID`, `B2_APP_KEY`, `DB_BACKUP_RETENTION_DAYS=30`, `EVIDENCE_BACKUP_RETENTION_WEEKS=4` |
| **Sentry** | Error tracking (web + worker) | `@sentry/nextjs`, `@sentry/node` | `SENTRY_DSN_WEB`, `SENTRY_DSN_WORKER`, `SENTRY_ENVIRONMENT` |
| **GitHub** | Source of truth + auto-deploy trigger | Host cron polls `origin/main` | (SSH deploy key) |

**Net-new compared to the other apps:**

- **None.** Every account already exists. New credentials/buckets/keys per the Gate 0 reuse map. No new vendors. Anthropic key exists for v2 readiness but isn't wired in v1.

**Per-recipient WhatsApp opt-in:**

Twilio Sandbox requires each phone to `join <code>` once before it can receive messages. Two parent phones are already opted in (used by Family_Tasks_Hub). Kid phones (if used) need to opt in too — `deploy-prod.sh` interactively prompts for kid phones and prints the join code for the user to forward.

---

## 7. Security model

| Layer | Mechanism |
|---|---|
| **TLS** | Host Caddy + Let's Encrypt for `reco.my-restart.co.il`. HSTS enabled after 1-week stability. |
| **Parent auth** | Auth.js v5: email + password (Argon2 via `@node-rs/argon2`), DB-backed sessions, 30-day expiry, server-side logout. |
| **Kid auth** | 4-digit PIN, stored as Argon2 hash. PIN verify endpoint is rate-limited (5 attempts / 15 min per (kid_id, device_fingerprint) tuple). On success: short-lived signed JWT cookie (kid-session) + optional persistent device-trust cookie (signed, 90-day rolling). |
| **Device trust** | `device_trust` row per (kid, device_fingerprint, trust_token_hash). On trusted device, kid skips PIN and gets a fresh kid-session JWT on each visit. Single-tap login. Per-kid revoke from admin UI. |
| **Authorization scope** | Server actions and worker routes BOTH enforce kid/admin boundary. Kid endpoints filter by `kid_id = session.kid_id`. Admin endpoints check `session.role = 'admin'`. No reliance on UI alone. |
| **Brute-force defense** | Parent: 5 failed login attempts / 15 min → lockout. Kid PIN: 5 failed / 15 min → kid locked, admin must reset. |
| **Encryption at rest** | `MASTER_KEY` (32 random bytes, base64). Encrypts: kid PIN salts (already hashed; double protection), device trust tokens. Not in DB; backed up to password manager. |
| **Worker access from web** | `WORKER_INTERNAL_TOKEN` Bearer header. Worker rejects anything else on internal endpoints. |
| **Evidence photo access** | Session-gated GET on worker. Kid can fetch their own; admin can fetch any. No public URLs ever. |
| **CSRF** | Auth.js v5 built-in CSRF tokens for parent forms. Kid endpoints use double-submit-token pattern (cookie + form field). Server actions inherit CSRF protection. |
| **Postgres exposure** | Not exposed to host or internet. Internal Docker network only. |
| **Caddy security headers** | X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera=self for evidence upload, microphone=(), geolocation=()), Server header stripped. |
| **Sentry PII scrubbing** | `beforeSend` redacts: emails, phone numbers, kid names, evidence filenames. Stack traces + scrubbed metadata only. |

---

## 8. Kid vs admin authorization model

This is the single biggest architectural difference from the other apps. Reco has TWO classes of authenticated principal:

- **Admin** = `user` row with `role='admin'` (parents). Auth.js v5 session cookie.
- **Kid** = `kid` row (Lia, Yael). Custom signed JWT cookie (kid-session) + optional device-trust cookie.

Every server action and every worker route declares its allowed principals:

```typescript
// apps/web/src/lib/auth/guards.ts
type Principal = AdminPrincipal | KidPrincipal;

export async function requireKid(...): Promise<KidPrincipal> { /* ... */ }
export async function requireAdmin(...): Promise<AdminPrincipal> { /* ... */ }
export async function requireKidOrAdmin(...): Promise<Principal> { /* ... */ }
```

Kid-scoped routes ALWAYS add `WHERE kid_id = $session.kid_id` to every query. Admin-scoped routes filter by `household_id = $session.household_id`. No mixing. RLS-equivalent enforced at the app boundary because we're not on Supabase.

**Concrete example** — completing a task:

```typescript
// server action: completeTask
const session = await requireKid();
// ... checks assignment.kid_id === session.kid_id, BOTH in DB query AND in code
// ... INSERTs task_completion (assignment_id, completion_date=today_IL, completed_at=now())
// ... ledger.post({ kid_id, kind: 'earn', amount: template.coin_value, task_completion_id })
// ... POST /api/internal/dispatch-now to worker for immediate parent notification if approval required
```

Same flow with admin override (joker):

```typescript
// server action: adminAdjustWallet
const session = await requireAdmin();
const { kidId, amount, reason } = parsed; // amount can be + or -
// ... ledger.post({ kid_id: kidId, kind: amount > 0 ? 'admin_credit' : 'admin_debit',
//                   amount, admin_user_id: session.user_id, note: reason })
// ... INSERT audit_log
// ... no kid-side notification by default (admin actions are visible in the wallet history)
```

The kid never directly authenticates as the parent; the parent never inherits a kid's session. Cross-principal actions (e.g., admin marking a kid's redemption received) always run as the admin and reference the kid via FK, never via assumed identity.

---

## 9. Evidence photo handling

### Upload path

```
Kid in PWA on her own phone
  → camera capture or gallery pick (HTML <input type="file" accept="image/*" capture="environment">)
  → POST /api/kid/submissions/new (server action, multipart/form-data)
    ├ verify kid session
    ├ verify task_assignment.kid_id == session.kid_id
    ├ verify task_template.evidence_required == true
    ├ write file to /var/lib/reco/evidence/<yyyy>/<mm>/<dd>/<uuid>.<ext>  (mounted volume)
    ├ INSERT evidence row with filename + metadata
    ├ INSERT submission row with status='pending', evidence_id, kid_id
    ├ POST http://reco-worker:8100/api/internal/dispatch-now { event: 'submission_pending', submission_id }
    │   └ worker fires WhatsApp to both parents + bell to both parents
    └ return { submission_id, status: 'pending' } to kid UI
```

### Serve path

```
Parent opens admin/approvals/<submission_id>
  → web SSR fetches submission + evidence row
  → renders <img src="/api/internal/evidence/<evidence_id>" />
  → browser GETs that path
    → Caddy routes to reco-worker:8100
    → worker checks session (admin cookie OR kid cookie matching evidence.kid_id)
    → reads from volume
    → streams bytes with Content-Type: <mime_type>, Cache-Control: private,no-store
```

No CDN, no signed URLs. The session check is the entire authorization gate. Cache-Control prevents intermediate caching even within the kid's PWA service worker.

### Volume mount

`docker-compose.yml`:

```yaml
services:
  reco-worker:
    volumes:
      - reco-evidence:/var/lib/reco/evidence:rw
  reco-web:
    volumes:
      - reco-evidence:/var/lib/reco/evidence:rw   # web writes on upload, worker writes nothing
volumes:
  reco-evidence:
    driver: local
```

Both containers mount the same named volume. Web writes on upload; worker reads on serve and deletes on purge.

### Purge

Worker cron at `0 6 * * *` (06:00 IL) executes:

```sql
SELECT id, filename FROM evidence
WHERE purged_at IS NULL
  AND (
    submission_id IN (
      SELECT id FROM submission
      WHERE status IN ('approved', 'denied')
        AND resolved_at < (now() - interval '30 days')
    )
    OR submission_id IS NULL  -- orphaned uploads
  );
```

For each row: `unlink(filename)` then `UPDATE evidence SET purged_at = now()`. The DB row persists (audit trail of what was uploaded), only the bytes leave.

### Backup of evidence volume

Worker cron at `0 5 * * 0` (Sundays 05:00 IL): `tar -czf` the volume → AES-256-GCM with `MASTER_KEY`-derived key → multipart upload to `reco-evidence-backup` bucket. Retention: 4 weeks. Restoration is manual — documented in `BACKUP-RESTORE.md` (forthcoming).

---

## 10. Three key flows diagrammed

### 10.1 Approval workflow

```
┌──────────┐                                                ┌──────────┐
│   Kid    │                                                │  Parent  │
└────┬─────┘                                                └────┬─────┘
     │                                                            │
     │ 1. Tap "I did it" on homework task (evidence_required)     │
     │    Camera UI opens                                          │
     │ 2. Capture photo                                            │
     │ 3. Submit                                                   │
     │                                                            │
     │ ──► POST /api/kid/submissions/new                          │
     │     (server action, multipart)                              │
     │                                                            │
     │      ┌────────────────────────────────────────────┐        │
     │      │ web:                                       │        │
     │      │  - write file to volume                    │        │
     │      │  - INSERT evidence, submission(pending)    │        │
     │      │  - notify worker (immediate)               │        │
     │      └─────────────────┬──────────────────────────┘        │
     │                        │                                    │
     │                        ▼                                    │
     │      ┌────────────────────────────────────────────┐        │
     │      │ worker:                                    │        │
     │      │  - check quiet hours (per-parent)          │        │
     │      │  - check rate limit (3/10min)              │        │
     │      │  - INSERT 2× notification_event (bell+wa)  │        │
     │      │    per parent (4 total)                    │        │
     │      │  - sendWhatsApp(parent1)                   │        │
     │      │  - sendWhatsApp(parent2)                   │        │
     │      └────────────────────────────────────────────┘        │
     │                                                            │
     │ ◄── 200 OK { submission_id, status: 'pending' }            │
     │     UI: "Waiting for parent approval..."                   │
     │                                                            │
     │                                          WhatsApp arrives  │
     │                                                  ◄─────────┤
     │                                                            │
     │                                 ┌──────────────────────┐   │
     │                                 │ Parent taps link →   │   │
     │                                 │ /admin/approvals/X   │   │
     │                                 │ sees photo + task    │   │
     │                                 │ taps Approve         │   │
     │                                 └─────────┬────────────┘   │
     │                                           │                │
     │                                           ▼                │
     │      ┌────────────────────────────────────────────┐        │
     │      │ web (server action, admin-only):           │        │
     │      │  - requireAdmin()                          │        │
     │      │  - UPDATE submission                       │        │
     │      │    SET status='approved',                  │        │
     │      │        resolved_by_user_id=$1,             │        │
     │      │        resolved_at=now()                   │        │
     │      │    WHERE id=$2 AND status='pending'        │        │
     │      │  - if rowcount=0 → "already resolved"      │        │
     │      │  - ledger.post(earn, coin_value, kid_id,   │        │
     │      │                task_completion_id=...)     │        │
     │      │  - INSERT task_completion(completion_date) │        │
     │      │  - if feeding a campaign: re-evaluate      │        │
     │      │  - notify kid: bell + WhatsApp             │        │
     │      └────────────────────────────────────────────┘        │
     │                                                            │
     │ WhatsApp: "Mom approved! +20 coins. Balance: 47"           │
     │ ◄──────────────────────────────────────────────────────────┤
     │                                                            │
     │ UI: status: 'approved', coins animate up                   │
     │                                                            │
```

**Race condition handled:** if both parents tap Approve simultaneously, the UPDATE WHERE status='pending' returns rowcount=0 for the second one. UI shows "Mom approved this 2 min ago." No double-credit possible.

**Denial path:** parent enters `deny_reason`, submission goes to status='denied'. Kid sees "Mom needs a clearer photo: 'try a different angle'." A "resubmit" button creates a new submission row pointing to the previous via `resubmit_of_submission_id`.

### 10.2 Daily reset

```
00:00:00 Asia/Jerusalem (cron in reco-worker: `0 0 * * *`)
  │
  ▼
For each kid in household:
  │
  ├──► Streak campaigns enrolled by this kid:
  │     │
  │     ├──► For each, check yesterday's completion of feeding task(s)
  │     │     │
  │     │     ├──► Completed (not currently undone): streak +1
  │     │     │   if reached target → ledger.post(campaign_bonus) +
  │     │     │                       INSERT kid_badge, INSERT campaign_enrollment.completed_at,
  │     │     │                       notify "Campaign complete! 🏅"
  │     │     │
  │     │     └──► Missed:
  │     │           │
  │     │           ├──► freezes_used < freezes_allowed?
  │     │           │     │
  │     │           │     ├──► YES: freezes_used += 1, log to notification_event ("you used a streak freeze")
  │     │           │     └──► NO: current_streak = 0 (break), log notification_event ("streak broken")
  │
  ├──► Total/goal campaigns enrolled:
  │     │
  │     ├──► (Nothing happens at reset — totals only finalize at end_date,
  │     │     and the end_date check runs in a SEPARATE cron at 01:00.)
  │     │
  │     ├──► Compute nudge: if (end_date - today) is in the last 25% of window
  │     │     AND no nudge sent in last 24h → schedule a "X days left, Y to go" nudge
  │     │     (added to notification_event with state='pending', dispatched at next */5 tick)
  │
  ├──► Daily tasks:
  │     │
  │     ├──► Yesterday's incomplete daily_task_completion slots → nothing (silently dropped per spec)
  │     │     The streak engine already accounted for these above.
  │     │
  │     └──► Today's slots: no rows pre-created. Slots come into existence on first complete.
  │           (Saves on millions of unused rows for an unused-by-kid task.)
  │
  └──► Long-term tasks: no daily action. They accumulate continuously.

CRON DURATION: target < 5s for 2 kids × 5 campaigns × 10 tasks. Should be trivially fast.

If the cron overruns or crashes mid-run: re-running is idempotent (UPDATEs are deterministic;
streak state recomputes from the ledger of actual completions, not from a running counter).
```

### 10.3 Campaign progress (a daily task feeding both wallet and a streak)

```
Lia opens Reco at 16:00, taps "I read 5 pages today"  (long-term task, no evidence required)
  │
  ▼
web server action: logProgress(assignment_id=42, quantity=5)
  │
  ├──► requireKid() → session.kid_id = 1 (Lia)
  ├──► assignment 42 confirmed kid_id=1
  ├──► INSERT long_term_progress(assignment_id=42, kid_id=1, progress_date=today_IL, quantity=5)
  ├──► ledger.post({
  │       kid_id: 1,
  │       kind: 'earn',
  │       amount: long_term_task.per_unit_coins * 5,   // e.g. 1 coin/page * 5 = 5 coins
  │       long_term_progress_id: <new_id>,
  │     })
  │
  ├──► Find feeding campaigns:
  │     SELECT c.* FROM campaign c
  │     JOIN campaign_feeding_task cft ON cft.campaign_id = c.id
  │     JOIN campaign_enrollment ce ON ce.campaign_id = c.id AND ce.kid_id = 1
  │     WHERE cft.template_id = assignment.template_id
  │       AND ce.completed_at IS NULL
  │       AND c.start_date <= today AND today <= c.end_date
  │     → e.g., "Read 100 pages in 100 days" (kind='total')
  │     → e.g., "Read 3 pages every day for 5 days" (kind='streak')
  │
  ├──► For each: evaluate.
  │
  │     For TOTAL campaign:
  │       new_total = ce.current_total + 5
  │       UPDATE campaign_enrollment SET current_total = new_total
  │       if new_total >= c.total_target_quantity:
  │         ledger.post(campaign_bonus, c.bonus_coins, campaign_id=c.id)
  │         INSERT kid_badge(kid_id, badge_id=c.badge_id, source_campaign_id=c.id)
  │         UPDATE campaign_enrollment SET completed_at=now(), completed_kind='success'
  │         notify "🏅 Campaign complete: Reading 100 pages! +50 coins"
  │
  │     For STREAK campaign:
  │       if today's contribution meets per-day threshold (3 pages):
  │         streak doesn't advance until reset (daily reset is the place that tickles streak)
  │         OR: optimistically check "did the sum of today's progress for feeding task ≥ 3?"
  │             — if yes and yesterday's streak holds → advance streak optimistically
  │             — if reached target_days → award bonus + badge NOW (don't wait for midnight)
  │
  │       (Implementation pragmatic note: streak engine advances at midnight via daily-reset.
  │        For UX, the kid home screen shows "Day 3 of 5 today!" computed live from progress.)
  │
  ├──► Schedule motivational nudge if not sent in last 24h and within cadence window.
  │
  └──► return { progress_id, new_balance, campaigns_updated: [...] }

UI: coin counter increments, campaign progress bars update, badge animation if completed.
```

---

## 11. Deploy pipeline

```
Local dev (Windows + Claude Code)
    ↓ git push origin main (to recognition repo)
GitHub (private repo)
    ↓ host cron @ */2 min
auto-deploy.sh (specific to Reco)
    ↓ if HEAD changed → flock guard → update-prod.sh
update-prod.sh:
    1. git pull
    2. [if new migrations] → docker exec reco-pg psql ... -f each new migration
    3. docker compose build (web + worker; cached layers reused)
    4. docker compose up -d  (10s downtime on reco-web + reco-worker)
    5. reco-pg untouched
    6. Smoke test: curl reco-web:3030/api/health AND reco-worker:8100/healthz
       fail loudly on non-200
    7. Print container status
```

Caddy is NOT touched by `update-prod.sh`. If the Caddyfile fragment changes, manual `sudo caddy reload`.

**One-time setup** (`infra/deploy-prod.sh`) prompts for:
- Household name (e.g., "Family")
- TZ default (`Asia/Jerusalem`)
- 2× parent admin accounts (email, password, name, phone_e164, locale)
- 2× kid profiles (name, color, initial PIN, locale)
- Twilio creds (SID, token, WhatsApp from)
- SMTP creds (Gmail app password specific to Reco)
- B2 creds (key ID, app key, endpoint)
- Sentry DSNs
- Auto-generates: `MASTER_KEY`, `AUTH_SECRET`, `WORKER_INTERNAL_TOKEN`, Postgres password
- Writes `.env` (chmod 600), `infra/secrets/postgres_password.txt`
- Installs Caddy fragment, reloads Caddy
- Builds images, brings stack up, runs migrations, seeds household + parents + kids + 6 sample tasks + 6 sample rewards + 8 starter badges
- Adds the auto-deploy cron line
- Smoke-tests the subdomain

Idempotent. Safe to re-run.

---

## 12. Reused from the other apps

Pattern-port (not code-copy, per user instruction "reuse the account, own the code"):

| Piece | What | Adaptation needed |
|---|---|---|
| `infra/auto-deploy.sh` | GitHub poll + flock-guarded deploy | Path swap: `/opt/family-tasks-hub` → `/opt/recognition`. Log file swap. |
| `infra/update-prod.sh` | Git pull + migrations + compose up | Path + container name swap. |
| `infra/deploy-prod.sh` | Idempotent first-install | Rewritten — different prompts, different seeds. Shape is the same. |
| `infra/Dockerfile.web` | Multi-stage Next.js standalone build | Use Next.js 16. |
| `infra/Dockerfile.worker` | Node 22 base for Fastify worker | Strip Puppeteer/Chrome (not needed). Smaller image. |
| `apps/worker/src/notifications/channels.ts` | `sendWhatsApp`, `sendEmail`, `sendInApp` channel adapters | Rewrite from the reference (~30 lines per function). Same shape. |
| `packages/db/src/helpers/encrypt.ts` | MASTER_KEY-based AES helpers | Pattern-port. Used for kid PIN salts and trust tokens. |
| `packages/db/src/index.ts` | `getDb()` Drizzle singleton | Pattern-port. Repoint to `@reco/db` schema. |
| `apps/web/src/lib/auth.config.ts` | Auth.js v5 setup, credentials + DB sessions | Pattern-port from family-tasks-hub. Drop TOTP. Used for parents only. |
| `apps/web/src/middleware.ts` | Locale + session resolution | Pattern-port, extended for kid-session resolution. |
| i18n pattern (per-locale dicts, typed `Dictionary`, locale-matcher) | i18n setup | Pattern-port from family-tasks-hub. |
| ICU `he-IL` locale at `initdb` | Hebrew collation | Pattern-port. |
| `__migrations` tracking table + raw-SQL migrations | Migration runner pattern | Pattern-port. |
| `scripts/generate-icons.mjs` | Sharp-based PNG icon generator from SVG source | Direct copy of approach; new SVG source. |
| Caddy host pattern | Subdomain fragment | Add `reco.my-restart.co.il` block to host Caddyfile. |
| Backup encryption (MASTER_KEY-derived key + AES-256-GCM) | B2 backup safety | Pattern-port. |

---

## 13. Net-new in this app

Things that don't exist in either reference app:

- **Kid auth** (Netflix-picker + 4-digit PIN + device-trust). The other apps are adult-only.
- **Two-principal authorization** (admin vs kid) at every server action and worker route.
- **Append-only wallet ledger** as a first-class entity. Family_Budget_App's `transaction` table is different domain semantics; closest analog is its audit_log but it's not a balance derivation.
- **Submission/evidence/approval triple** with FCFS resolution and optimistic concurrency.
- **Photo upload + local-volume storage + session-gated serve.** No precedent in either app.
- **Streak engine + total engine** for campaigns.
- **Per-task admin reminders** (`task_reminder` table, dispatched on tick).
- **Bilingual (he+en) at every UI surface from day 1.** Family_Tasks_Hub planned this but the budget app is Hebrew-only.
- **Cosmetic badge collection.**
- **Same-day kid undo with ledger reversal entries.**
- **Rate-limited WhatsApp dispatch** (3/10min/recipient). Other apps just fire; Reco's higher event volume needs the throttle.

---

## 14. Gotchas inherited & gotchas to know

### Inherited (apply day 1)

- **Use `eslint.ignoreDuringBuilds: true` AND `typescript.ignoreBuildErrors: true`** in `next.config.ts` from the start, with separate `pnpm typecheck` / `pnpm lint` validation. Avoids the mid-project ESLint pain the budget app hit.
- **Wire `auto-deploy.sh` cron at install time**, not later.
- **`AUTH_TRUST_HOST=true`** required for Auth.js v5.
- **Postgres locale matters for Hebrew.** ICU `he-IL` at `initdb`.
- **Encrypt sensitive columns with a key NOT in the DB.**
- **Minimal pass-through service worker.** No caching. Cookster's lesson, inherited.
- **Tailwind v4 preflight resets `cursor: default` on `<button>`** — override in `globals.css`.

### Net-new

- **Kid PINs are 4 digits — brute-force surface is small (10⁴ = 10,000).** Mitigate with: (a) rate limit (5 fails / 15 min per kid+device), (b) device trust cookie skips PIN on remembered devices, (c) admin-only PIN reset.
- **Device trust cookie spoofing**: cookie is HMAC-signed with `AUTH_SECRET` AND tied to a `device_trust` row that the server verifies on every kid-session refresh. Stolen cookie alone is useless without DB row.
- **Twilio Sandbox quota**: WhatsApp messages have rate + daily caps. At the volumes you'd see (≤30 events/day per kid), it's well under, but the rate-limiter (3/10min/recipient) is the failsafe.
- **Photo deletion is irreversible.** 30-day purge is fine but a parent who wants a permanent record needs to download before purge. Optional v2: "starred" submissions that exempt from purge.
- **The clock is in `Asia/Jerusalem` everywhere.** Postgres TZ, Node TZ env, cron schedules. Test with date-fns-tz + explicit `'Asia/Jerusalem'` to surface bugs.
- **Bilingual reward names**: at redemption, snapshot both Hebrew and English titles into the redemption row. If admin later renames a reward, past redemption history doesn't change.
- **Long-term unit labels are free text** — keep them short (Postgres VARCHAR(32) is plenty). Render as-is; don't try to pluralize generically (don't write "8 pagess").
- **Kid sees sibling's badge earn in their feed** — only the FACT of the earn, never sibling's private wallet history.
- **The streak engine derives from the ledger, not from a denormalized counter.** A retroactive undo of yesterday's task today MUST break yesterday's streak count. The streak query walks back day-by-day from `today` against `task_completion WHERE undone_at IS NULL`.

---

*Last updated: 2026-05-20. Maintained alongside `SCHEMA.md`, `CRON.md`, `NOTIFICATIONS.md`, `BUILD-PLAN.md`, and (forthcoming) `BRANDBOOK.md`.*
