#!/usr/bin/env bash
# update-prod.sh — invoked by auto-deploy.sh after a new HEAD is detected.
#
# Steps:
#   1. git pull
#   2. docker compose build (cached layers reused)
#   3. docker compose up -d (rolls web + worker; postgres untouched)
#   4. Smoke-test web + worker health
#   5. Print container status
#
# Migrations are applied by the worker on boot — we don't run them here.
# Caddy fragment changes require a manual `sudo systemctl reload caddy`;
# this script never touches Caddy.

set -euo pipefail
IFS=$'\n\t'

REPO_DIR="${RECO_REPO_DIR:-/opt/recognition}"
ENV_FILE="${REPO_DIR}/.env"
COMPOSE="docker compose -f ${REPO_DIR}/infra/docker-compose.yml --env-file ${ENV_FILE}"

ts()  { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
log() { printf '[%s] [update-prod] %s\n' "$(ts)" "$*"; }
fail(){ printf '[%s] [update-prod] FAIL: %s\n' "$(ts)" "$*" >&2; exit 1; }

cd "${REPO_DIR}"

log "git pull"
git pull --ff-only

log "docker compose build"
${COMPOSE} build

log "docker compose up -d (rolling reco-web + reco-worker; reco-pg untouched)"
${COMPOSE} up -d reco-web reco-worker

# Smoke test — fail loudly on non-200.
log "smoke test"
for i in {1..30}; do
  code_w=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3030/api/health || echo 000)
  code_k=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8100/healthz   || echo 000)
  if [[ "${code_w}" == "200" && "${code_k}" == "200" ]]; then
    log "web=200 worker=200 — deploy OK"
    break
  fi
  sleep 1
  [[ $i -eq 30 ]] && fail "smoke test failed (web=${code_w} worker=${code_k})"
done

log "container status:"
${COMPOSE} ps
