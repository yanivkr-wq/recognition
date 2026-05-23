# Reco

Bilingual (Hebrew default + English), self-hosted PWA for kids to track chores, earn coins, save up for rewards, and collect badges across time-boxed campaigns. Built for Lia and Yael; runs alongside [Family_Budget_App](https://github.com/Lily/family-budget-app) and [Family_Tasks_Hub](https://github.com/Lily/family-tasks-hub) on a single Hetzner CX32 VPS.

> **Codename:** Recognition. **Brand:** Reco. **Concept:** Plush. **Badge architecture:** Embroidered Patch.

---

## Documentation map

| File | Read when |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | You're a future Claude session. **Read first.** |
| [`docs/BRANDBOOK.md`](./docs/BRANDBOOK.md) | You're designing or coding any UI surface. The locked design system. |
| [`docs/brandbook.html`](./docs/brandbook.html) | Visual companion to the brandbook. Open in browser. |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | You want to know how the app is built. Container topology, integrations, security. |
| [`docs/SCHEMA.md`](./docs/SCHEMA.md) | Database schema · 23 tables · indexes · invariants. |
| [`docs/CRON.md`](./docs/CRON.md) | Every scheduled job in Reco. |
| [`docs/NOTIFICATIONS.md`](./docs/NOTIFICATIONS.md) | Event → channel routing matrix. |
| [`docs/BUILD-PLAN.md`](./docs/BUILD-PLAN.md) | What we're building right now. 9-phase roadmap. |
| [`docs/OPEN-QUESTIONS.md`](./docs/OPEN-QUESTIONS.md) | Resolved + outstanding decisions. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Running log of what changed when. |

---

## Quickstart (local dev)

```bash
# Prereqs: Node 22+, pnpm 9+, Docker Desktop
pnpm install

# Spin up local Postgres
docker run -d --name reco-pg-dev \
  -e POSTGRES_DB=reco \
  -e POSTGRES_USER=reco \
  -e POSTGRES_PASSWORD=devpass \
  -p 5432:5432 \
  postgres:16-alpine

# Copy env, fill in MASTER_KEY / AUTH_SECRET / WORKER_INTERNAL_TOKEN
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # ×3

# Apply migrations
pnpm migrate:apply

# Run web + worker in parallel
pnpm dev

# Web:    http://localhost:3030
# Worker: http://localhost:8100/healthz
```

---

## Project layout

```
recognition/
├─ apps/
│   ├─ web/         # Next.js 16 + React 19 + Tailwind 4 + Auth.js v5
│   └─ worker/      # Fastify 5 (cron + dispatcher + evidence serve)
├─ packages/
│   ├─ db/          # Drizzle schema + raw SQL migrations + encrypt helpers
│   └─ shared/      # i18n dicts, design tokens, format helpers, shared types
├─ infra/
│   ├─ docker-compose.yml
│   ├─ Dockerfile.web
│   ├─ Dockerfile.worker
│   ├─ Caddyfile.fragment
│   ├─ deploy-prod.sh
│   ├─ update-prod.sh
│   └─ auto-deploy.sh
├─ scripts/         # one-shot helpers (icon generation, dev seed)
├─ docs/            # ARCHITECTURE / SCHEMA / CRON / NOTIFICATIONS / BUILD-PLAN / BRANDBOOK
└─ CLAUDE.md        # repo rules for Claude sessions
```

---

## Tech stack at a glance

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind 4 |
| Backend (web) | Next.js server actions |
| Backend (worker) | Fastify 5 |
| Database | PostgreSQL 16 + Drizzle ORM + raw SQL migrations + ICU `he-IL` |
| Auth — parents | Auth.js v5, email + password, Argon2, DB sessions |
| Auth — kids | Custom: Netflix-style profile picker + 4-digit PIN + device-trust |
| WhatsApp | Twilio Sandbox (outbound only via direct REST) |
| Email | Gmail SMTP via Nodemailer |
| Evidence storage | Local Docker volume on the VPS |
| Backups | Backblaze B2 (DB nightly, evidence weekly) |
| Reverse proxy | Caddy 2.8 (host-installed, shared with budget + tasks apps) |
| Container | Docker Compose |
| Host | Hetzner Cloud CX32 (shared with budget + tasks apps) |

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full picture.

---

## License

Private. Single-household self-hosted app. Not licensed for redistribution.
