#!/usr/bin/env bash
# Encalm Project Dashboard: deploy a commit to the VPS, with a health gate and
# automatic rollback. Runs on the VPS as the app user (encalm). The GitHub
# "Deploy" workflow pipes this file over SSH; it can also be run by hand:
#
#   deploy.sh <production|staging> [git-ref]        (ref defaults to main)
#   DRY_RUN=1 deploy.sh production v1.4.0           print every step, change nothing
#
# Steps:
#   1. fetch the ref into /opt/encalm/repo and unpack it as a new release
#   2. npm ci, build, drop dev dependencies
#   3. back up the database (scripts/backup.sh)
#   4. run migrations (npm run migrate); a failure stops here, old release untouched
#   5. point /opt/encalm/<env>/current at the new release and reload PM2
#   6. health gate: /api/system/ready must answer and report the new release
#   7. on failure: point current back, restore the pre-deploy database if a
#      migration ran, reload, and exit non-zero
set -euo pipefail

ENV_NAME="${1:-}"
REF="${2:-main}"
case "$ENV_NAME" in
  production) PORT=5000 ;;
  staging) PORT=5001 ;;
  *) echo "Usage: $0 <production|staging> [git-ref]" >&2; exit 2 ;;
esac

ROOT="${ENCALM_ROOT:-/opt/encalm}"
REPO="$ROOT/repo"
ENV_DIR="$ROOT/$ENV_NAME"
RELEASES="$ENV_DIR/releases"
CURRENT="$ENV_DIR/current"
ETC_DIR="${ENCALM_ETC:-/etc/encalm}"
ENV_FILE="$ETC_DIR/$ENV_NAME.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/encalm/$ENV_NAME}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"  # each release has its own node_modules
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-90}"
PM2_APP="encalm-$ENV_NAME"
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
die() { log "ERROR: $*"; exit 1; }
run() {
  if [ "$DRY_RUN" = 1 ]; then echo "  + $*"; else "$@"; fi
}

# DATA_DIR comes from the environment's env file; that is where the database lives.
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -1 | tr -d '"'"'"; }
DATA_DIR="$(env_value DATA_DIR)"
DATA_DIR="${DATA_DIR:-/var/lib/encalm/$ENV_NAME}"
DB_FILE="$DATA_DIR/encalm.db"

[ "$DRY_RUN" = 1 ] && log "DRY RUN: commands are printed, nothing is changed"
[ "$(id -un)" != root ] || die "run as the app user, not root"
[ -d "$REPO/.git" ] || die "$REPO is not a git clone (run deploy/setup-vps.sh first)"
[ -r "$ENV_FILE" ] || die "cannot read $ENV_FILE"
command -v pm2 >/dev/null || die "pm2 is not installed"

# 1. Fetch and unpack -------------------------------------------------------
log "Fetching $REF"
run git -C "$REPO" fetch --prune --tags origin
SHA="$(git -C "$REPO" rev-parse --verify "origin/$REF^{commit}" 2>/dev/null || git -C "$REPO" rev-parse --verify "$REF^{commit}")" \
  || die "unknown ref: $REF"

# Always deploy with the deploy script of the commit being deployed, whichever
# copy was started (a stale checkout, a pipe from CI, an older release).
if [ -z "${ENCALM_DEPLOY_SCRIPT_SHA:-}" ]; then
  SELF="$(mktemp)"
  if git -C "$REPO" show "$SHA:deploy/deploy.sh" > "$SELF" 2>/dev/null; then
    log "Re-running deploy.sh from $SHA"
    exec env ENCALM_DEPLOY_SCRIPT_SHA="$SHA" bash "$SELF" "$ENV_NAME" "$SHA"
  fi
  rm -f "$SELF"
fi

# One deploy per environment at a time.
mkdir -p "$ENV_DIR"
exec 9>"$ENV_DIR/.deploy.lock"
flock -n 9 || die "another deploy of $ENV_NAME is running"
RELEASE="$(date -u +%Y%m%d%H%M%S)-${SHA:0:8}"
NEW="$RELEASES/$RELEASE"
PREVIOUS=""
[ -L "$CURRENT" ] && PREVIOUS="$(readlink -f "$CURRENT")"
log "Deploying $SHA as $RELEASE to $ENV_NAME (previous: ${PREVIOUS:-none})"

run mkdir -p "$NEW"
if [ "$DRY_RUN" = 1 ]; then
  echo "  + git -C $REPO archive $SHA | tar -x -C $NEW"
else
  git -C "$REPO" archive "$SHA" | tar -x -C "$NEW"
  echo "$RELEASE" > "$NEW/RELEASE"
fi

# A release that failed is kept for inspection but never chosen by rollback.sh,
# and is removed by the next successful deploy.
mark_failed() { [ "$DRY_RUN" = 1 ] || touch "$NEW/.failed"; }

# 2. Install and build -----------------------------------------------------
log "Installing and building"
cd "$NEW" 2>/dev/null || [ "$DRY_RUN" = 1 ]
run npm ci --no-audit --no-fund
run npm run build
run npm prune --omit=dev --no-audit --no-fund

# 3. Back up ---------------------------------------------------------------
SCHEMA_BEFORE=""
BACKUP_STAMP=""
if [ -f "$DB_FILE" ]; then
  log "Backing up $DB_FILE"
  SCHEMA_BEFORE="$(sqlite3 "$DB_FILE" 'SELECT MAX(version) FROM schema_migrations' 2>/dev/null || echo 0)"
  run env DATA_DIR="$DATA_DIR" BACKUP_DIR="$BACKUP_DIR" "$NEW/scripts/backup.sh"
  if [ "$DRY_RUN" != 1 ]; then
    BACKUP_STAMP="$(ls -1t "$BACKUP_DIR"/encalm-*.db.gz | head -1 | sed -E 's#.*/encalm-(.*)\.db\.gz#\1#')"
    log "Pre-deploy backup: $BACKUP_STAMP"
  fi
else
  log "No database yet at $DB_FILE (first deploy)"
fi

# 4. Migrate (old release still serving) --------------------------------------
log "Running migrations"
if ! run env DOTENV_CONFIG_PATH="$ENV_FILE" NODE_ENV=production node "$NEW/server/dist/migrate.js"; then
  mark_failed
  die "migration failed; $ENV_NAME is still on ${PREVIOUS:-nothing}. Release left at $NEW for inspection."
fi
SCHEMA_AFTER="$( [ -f "$DB_FILE" ] && sqlite3 "$DB_FILE" 'SELECT MAX(version) FROM schema_migrations' 2>/dev/null || echo 0)"

# 5. Switch and reload -----------------------------------------------------
switch_to() {
  run ln -sfn "$1" "$CURRENT.tmp"
  run mv -T "$CURRENT.tmp" "$CURRENT"
  # The ecosystem file reads the RELEASE file, so --update-env passes the new id.
  run pm2 startOrReload "$ROOT/ecosystem.config.cjs" --only "$PM2_APP" --update-env
}

# Ready, and (when a release id is given) served by that release, not a stale process.
health_ok() {
  local want="$1" deadline=$((SECONDS + HEALTH_TIMEOUT)) body
  [ "$DRY_RUN" = 1 ] && { echo "  + poll http://127.0.0.1:$PORT/api/system/ready and /api/client-config (release $want)"; return 0; }
  while [ $SECONDS -lt $deadline ]; do
    if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/system/ready" >/dev/null 2>&1; then
      body="$(curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/client-config" 2>/dev/null || true)"
      if [ -z "$want" ] || [[ "$body" == *"\"release\":\"$want\""* ]]; then return 0; fi
    fi
    sleep 2
  done
  return 1
}

log "Switching $ENV_NAME to $RELEASE"
switch_to "$NEW"

# 6. Health gate -----------------------------------------------------------
if health_ok "$RELEASE"; then
  run pm2 save
  log "Healthy. $ENV_NAME is on $RELEASE"
  # Drop failed releases, then keep the newest good ones (never the live or previous one).
  if [ "$DRY_RUN" != 1 ]; then
    for old in "$RELEASES"/*/; do
      old="${old%/}"
      if [ -e "$old/.failed" ] && [ "$old" != "$NEW" ]; then rm -rf "$old"; fi
    done
    find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r | tail -n +"$((KEEP_RELEASES + 1))" |
      while read -r old; do
        old="$RELEASES/$old"
        [ "$old" = "$NEW" ] || [ "$old" = "$PREVIOUS" ] || rm -rf "$old"
      done
  fi
  exit 0
fi

# 7. Roll back -------------------------------------------------------------
log "Health check failed for $RELEASE; rolling back"
mark_failed
run pm2 logs "$PM2_APP" --lines 40 --nostream || true
if [ -z "$PREVIOUS" ] || [ ! -d "$PREVIOUS" ]; then
  run pm2 stop "$PM2_APP" || true
  die "no previous release to roll back to; $PM2_APP stopped"
fi

if [ -n "$BACKUP_STAMP" ] && [ "$SCHEMA_AFTER" != "$SCHEMA_BEFORE" ]; then
  # The new release changed the schema; the old code may not understand it.
  # Writes since the backup (seconds ago, against a failing app) are moved aside, not deleted.
  log "Schema changed ($SCHEMA_BEFORE -> $SCHEMA_AFTER); restoring pre-deploy database $BACKUP_STAMP"
  run pm2 stop "$PM2_APP"
  run env DATA_DIR="$DATA_DIR" BACKUP_DIR="$BACKUP_DIR" "$PREVIOUS/scripts/restore.sh" "$BACKUP_STAMP" --no-uploads --yes
fi

# Releases from before this script have no RELEASE file; then readiness alone counts.
PREVIOUS_RELEASE="$(cat "$PREVIOUS/RELEASE" 2>/dev/null || true)"
switch_to "$PREVIOUS"
if health_ok "$PREVIOUS_RELEASE"; then
  run pm2 save
  die "deploy of $RELEASE failed; rolled back to ${PREVIOUS_RELEASE:-$PREVIOUS} (healthy)"
fi
die "deploy of $RELEASE failed AND the rollback to ${PREVIOUS_RELEASE:-$PREVIOUS} is unhealthy; check 'pm2 logs $PM2_APP' now"
