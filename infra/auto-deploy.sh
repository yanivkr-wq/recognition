#!/usr/bin/env bash
# auto-deploy.sh — host cron poller (*/2 min) that triggers a deploy when
# origin/main advances. Single-flighted by a flock in /tmp/reco-auto-deploy.lock
# (the cron line in /etc/cron.d/reco-auto-deploy uses `flock -n`).
#
# Exits silently when there's nothing to do — logs only on real activity.
# Output is appended to /var/log/auto-deploy-reco.log by the cron line.

set -euo pipefail
IFS=$'\n\t'

REPO_DIR="${RECO_REPO_DIR:-/opt/recognition}"

ts()  { date -u +'%Y-%m-%dT%H:%M:%SZ'; }
log() { printf '[%s] [auto-deploy] %s\n' "$(ts)" "$*"; }
fail(){ printf '[%s] [auto-deploy] FAIL: %s\n' "$(ts)" "$*" >&2; exit 1; }

cd "${REPO_DIR}" || fail "repo dir missing: ${REPO_DIR}"

# Fetch but don't mutate working tree yet.
git fetch --quiet origin main || fail "git fetch failed"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [[ "${LOCAL}" == "${REMOTE}" ]]; then
  # No-op tick. Don't spam the log — only the first quiet tick after a
  # deploy is interesting, and journalctl already records cron invocation.
  exit 0
fi

log "new HEAD on origin/main (${LOCAL:0:8} → ${REMOTE:0:8}) — deploying"
"${REPO_DIR}/infra/update-prod.sh"
log "deploy complete"
