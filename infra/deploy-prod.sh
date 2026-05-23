#!/usr/bin/env bash
# deploy-prod.sh — Reco one-time / idempotent first install on the VPS.
#
# Run on the Hetzner host AS ROOT. The sibling apps on this VPS
# (family-budget, family-tasks-hub) follow the same convention — no
# dedicated deploy user exists; ssh-key access is granted on root@.
# Re-running is safe: every step is "create if missing, leave alone if present".
#
# Pre-conditions:
#   - Ubuntu 24.04, docker + docker compose plugin installed
#   - Caddy installed at /etc/caddy/Caddyfile, already importing /etc/caddy/conf.d/*.caddy
#   - DNS A record reco.my-restart.co.il → VPS IP already provisioned
#   - The GitHub `recognition` repo is publicly cloneable (or set RECO_REPO_URL to an ssh:// URL)
#
# After success:
#   - /opt/recognition/.env populated (chmod 600)
#   - infra/secrets/postgres_password.txt populated
#   - Docker images built, stack up
#   - Migrations applied + household seeded
#   - Caddy fragment installed and reloaded
#   - /etc/cron.d/reco-auto-deploy installed (*/2 min)
#   - https://reco.my-restart.co.il returns a brandbook-styled login

set -euo pipefail
IFS=$'\n\t'

# ── Constants ───────────────────────────────────────────────────────────────
REPO_DIR="/opt/recognition"
REPO_URL="${RECO_REPO_URL:-https://github.com/yanivkr-wq/recognition.git}"
ENV_FILE="${REPO_DIR}/.env"
SECRETS_DIR="${REPO_DIR}/infra/secrets"
PG_PASS_FILE="${SECRETS_DIR}/postgres_password.txt"
CADDY_FRAGMENT_SRC="${REPO_DIR}/infra/Caddyfile.fragment"
CADDY_FRAGMENT_DST="/etc/caddy/conf.d/reco.caddy"
CRON_FILE="/etc/cron.d/reco-auto-deploy"
# Use a function instead of a string variable: the strict-mode `IFS=$'\n\t'`
# above suppresses space-splitting on unquoted expansion, so `${COMPOSE} build`
# was being executed as a single command path. A function side-steps IFS
# entirely and quotes its argument list correctly.
compose() {
  docker compose -f "${REPO_DIR}/infra/docker-compose.yml" --env-file "${ENV_FILE}" "$@"
}

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn ]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required but not installed"
}

# ── 0. Sanity ───────────────────────────────────────────────────────────────
# Sibling apps (family-budget, family-tasks-hub) on this VPS run as root —
# Reco follows the same convention. If a future hardening pass adds a deploy
# user, flip this guard and drop the `sudo` calls below (they're no-ops as root).
[[ "${EUID}" -eq 0 ]] || fail "run as root (matches family-budget / family-tasks-hub convention)"
require_cmd git
require_cmd docker
require_cmd openssl
require_cmd caddy

# ── 1. Clone or update the repo ─────────────────────────────────────────────
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  log "cloning recognition repo to ${REPO_DIR}"
  sudo mkdir -p "${REPO_DIR}"
  sudo chown "$(id -u):$(id -g)" "${REPO_DIR}"
  git clone "${REPO_URL}" "${REPO_DIR}"
else
  log "repo exists at ${REPO_DIR}; pulling latest"
  git -C "${REPO_DIR}" pull --ff-only
fi

mkdir -p "${SECRETS_DIR}"
chmod 700 "${SECRETS_DIR}"

# ── 2. Generate / preserve secrets ─────────────────────────────────────────
gen_b64_32() { openssl rand -base64 32 | tr -d '\n'; }
gen_pw_32()  { openssl rand -base64 24 | tr -d '\n=/+'; }

# Source any existing .env so we preserve human-set values across re-runs.
if [[ -f "${ENV_FILE}" ]]; then
  log ".env already exists; preserving existing values"
  # shellcheck disable=SC1090
  set -a; source "${ENV_FILE}"; set +a
else
  log "creating .env from template"
fi

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(gen_pw_32)}"
AUTH_SECRET="${AUTH_SECRET:-$(gen_b64_32)}"
MASTER_KEY="${MASTER_KEY:-$(gen_b64_32)}"
WORKER_INTERNAL_TOKEN="${WORKER_INTERNAL_TOKEN:-$(gen_b64_32)}"

cat > "${ENV_FILE}" <<EOF
# Reco production .env — managed by deploy-prod.sh. Re-running preserves values.
# Every value is double-quoted because this file is also bash-sourced on re-runs;
# unquoted spaces / glob characters (notably crontab '*') would otherwise be
# treated as command words after the assignment.
NODE_ENV="production"
TZ="Asia/Jerusalem"
APP_URL="https://reco.my-restart.co.il"

# Postgres (containerized; reachable only on the reco-net Docker network)
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
DATABASE_URL="postgres://reco:${POSTGRES_PASSWORD}@reco-pg:5432/reco"

# Secrets — DO NOT regenerate after first deploy; rotating MASTER_KEY breaks
# all kid PINs and trust cookies, AUTH_SECRET invalidates parent sessions.
AUTH_SECRET="${AUTH_SECRET}"
AUTH_URL="https://reco.my-restart.co.il"
AUTH_TRUST_HOST="true"
MASTER_KEY="${MASTER_KEY}"
WORKER_INTERNAL_TOKEN="${WORKER_INTERNAL_TOKEN}"

# Twilio Sandbox (reused account; fill in after first run if not set)
TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-}"
TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-}"
TWILIO_WHATSAPP_FROM="${TWILIO_WHATSAPP_FROM:-}"
WHATSAPP_DRY_RUN="${WHATSAPP_DRY_RUN:-false}"

# Gmail SMTP
SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
SMTP_FROM="${SMTP_FROM:-}"

# Backblaze B2
B2_ENDPOINT="${B2_ENDPOINT:-s3.eu-central-003.backblazeb2.com}"
B2_BUCKET_DB="${B2_BUCKET_DB:-reco-backups}"
B2_BUCKET_EVIDENCE="${B2_BUCKET_EVIDENCE:-reco-evidence-backup}"
B2_KEY_ID="${B2_KEY_ID:-}"
B2_APP_KEY="${B2_APP_KEY:-}"
DB_BACKUP_RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-30}"
EVIDENCE_BACKUP_RETENTION_WEEKS="${EVIDENCE_BACKUP_RETENTION_WEEKS:-4}"

# Sentry
SENTRY_DSN_WEB="${SENTRY_DSN_WEB:-}"
SENTRY_DSN_WORKER="${SENTRY_DSN_WORKER:-}"
SENTRY_ENVIRONMENT="production"

# Cron schedules (defaults from docs/CRON.md)
DISPATCHER_CRON="${DISPATCHER_CRON:-*/5 * * * *}"
DAILY_RESET_CRON="${DAILY_RESET_CRON:-0 0 * * *}"
CAMPAIGN_WINDOW_CRON="${CAMPAIGN_WINDOW_CRON:-0 1 * * *}"
DB_BACKUP_CRON="${DB_BACKUP_CRON:-0 4 * * *}"
EVIDENCE_BACKUP_CRON="${EVIDENCE_BACKUP_CRON:-0 5 * * 0}"
EVIDENCE_PURGE_CRON="${EVIDENCE_PURGE_CRON:-0 6 * * *}"
SUMMARY_CRON="${SUMMARY_CRON:-0 9 * * *}"
SUMMARY_ENABLED="${SUMMARY_ENABLED:-false}"

# Notification routing
DEFAULT_QUIET_HOURS_START="${DEFAULT_QUIET_HOURS_START:-21:00}"
DEFAULT_QUIET_HOURS_END="${DEFAULT_QUIET_HOURS_END:-07:00}"
WHATSAPP_RATE_LIMIT_PER_10MIN="${WHATSAPP_RATE_LIMIT_PER_10MIN:-3}"

# Evidence storage
EVIDENCE_VOLUME_PATH="${EVIDENCE_VOLUME_PATH:-/var/lib/reco/evidence}"
EOF
chmod 600 "${ENV_FILE}"

# Postgres password also written to a separate file (handy for one-off psql).
printf '%s' "${POSTGRES_PASSWORD}" > "${PG_PASS_FILE}"
chmod 600 "${PG_PASS_FILE}"

log "secrets written to ${ENV_FILE} (chmod 600)"

# ── 3. Build images + bring stack up ───────────────────────────────────────
log "building docker images (this can take 3-5 min on first run)"
compose build

log "starting reco-pg first so we can apply migrations before web/worker boot"
compose up -d reco-pg

# Wait for postgres health
for i in {1..30}; do
  if docker exec reco-pg pg_isready -U reco -d reco -q; then
    log "reco-pg ready"
    break
  fi
  sleep 1
  [[ $i -eq 30 ]] && fail "reco-pg never became ready"
done

log "starting web + worker (worker applies migrations on boot)"
compose up -d reco-worker reco-web

# ── 4. Smoke test ───────────────────────────────────────────────────────────
log "smoke-testing the stack"
for i in {1..30}; do
  code_w=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3030/api/health || echo 000)
  code_k=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/healthz   || echo 000)
  if [[ "${code_w}" == "200" && "${code_k}" == "200" ]]; then
    log "web=200 worker=200"
    break
  fi
  sleep 1
  [[ $i -eq 30 ]] && fail "smoke test failed (web=${code_w} worker=${code_k})"
done

# ── 5. Install Caddy fragment ──────────────────────────────────────────────
sudo mkdir -p /etc/caddy/conf.d
if sudo cmp -s "${CADDY_FRAGMENT_SRC}" "${CADDY_FRAGMENT_DST}" 2>/dev/null; then
  log "Caddy fragment unchanged"
else
  log "installing Caddy fragment → ${CADDY_FRAGMENT_DST}"
  sudo cp "${CADDY_FRAGMENT_SRC}" "${CADDY_FRAGMENT_DST}"
  # Ensure the host Caddyfile imports conf.d (idempotent: only insert once).
  if ! grep -q 'import /etc/caddy/conf.d/\*.caddy' /etc/caddy/Caddyfile; then
    warn "host Caddyfile does not import /etc/caddy/conf.d/*.caddy"
    warn "add this line to /etc/caddy/Caddyfile then 'sudo systemctl reload caddy':"
    warn "    import /etc/caddy/conf.d/*.caddy"
  else
    log "host Caddyfile already imports conf.d/*.caddy"
  fi
  sudo caddy validate --config /etc/caddy/Caddyfile || fail "caddy validate failed"
  sudo systemctl reload caddy
  log "Caddy reloaded"
fi

# ── 6. Install auto-deploy cron ────────────────────────────────────────────
if [[ ! -f "${CRON_FILE}" ]]; then
  log "installing auto-deploy cron → ${CRON_FILE}"
  USER_NAME="$(id -un)"
  sudo tee "${CRON_FILE}" >/dev/null <<EOF
# Reco auto-deploy. Polls origin/main every 2 minutes; on a new HEAD,
# update-prod.sh pulls + rebuilds + restarts the stack. Single-flighted
# via flock so two ticks can't race.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/2 * * * * ${USER_NAME} flock -n /tmp/reco-auto-deploy.lock ${REPO_DIR}/infra/auto-deploy.sh >> /var/log/auto-deploy-reco.log 2>&1
EOF
  sudo chmod 644 "${CRON_FILE}"
  sudo touch /var/log/auto-deploy-reco.log
  sudo chown "${USER_NAME}:${USER_NAME}" /var/log/auto-deploy-reco.log
  log "auto-deploy cron installed"
else
  log "auto-deploy cron already installed at ${CRON_FILE}"
fi

# ── 7. Done ────────────────────────────────────────────────────────────────
log ""
log "============================================================"
log "Reco is up at https://reco.my-restart.co.il"
log ""
log "Next manual steps:"
log "  - Update parent password hashes via /admin/account (Phase 2+)"
log "  - Set kid PINs via /admin/kids/<id>/pin (Phase 2+)"
log "  - Fill missing Twilio / SMTP / B2 / Sentry creds in ${ENV_FILE}"
log "  - Then re-run: $0"
log "============================================================"
