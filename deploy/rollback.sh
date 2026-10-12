#!/usr/bin/env bash
# Encalm Project Dashboard: switch an environment back to an earlier release.
# For problems found after a deploy passed its health check (deploy.sh already
# rolls back by itself when the health check fails). Runs as the app user.
#
#   rollback.sh production                 list releases, then switch to the previous one
#   rollback.sh production <release-id>    switch to that release
#   rollback.sh production <release-id> --restore-db <backup-stamp>
#                                          also restore the database (use when the bad
#                                          release changed the schema; writes since that
#                                          backup are moved aside, not deleted)
#   DRY_RUN=1 rollback.sh ...              print the steps only
set -euo pipefail

ENV_NAME="${1:-}"
TARGET="${2:-}"
RESTORE_STAMP=""
if [ "${3:-}" = "--restore-db" ]; then RESTORE_STAMP="${4:?backup stamp required after --restore-db}"; fi
case "$ENV_NAME" in
  production) PORT=5000 ;;
  staging) PORT=5001 ;;
  *) echo "Usage: $0 <production|staging> [release-id] [--restore-db <backup-stamp>]" >&2; exit 2 ;;
esac

ROOT="${ENCALM_ROOT:-/opt/encalm}"
RELEASES="$ROOT/$ENV_NAME/releases"
CURRENT="$ROOT/$ENV_NAME/current"
ENV_FILE="${ENCALM_ETC:-/etc/encalm}/$ENV_NAME.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/encalm/$ENV_NAME}"
PM2_APP="encalm-$ENV_NAME"
DRY_RUN="${DRY_RUN:-0}"

log() { echo "[$(date -u +%H:%M:%S)] $*"; }
die() { log "ERROR: $*"; exit 1; }
run() { if [ "$DRY_RUN" = 1 ]; then echo "  + $*"; else "$@"; fi; }

LIVE="$(basename "$(readlink -f "$CURRENT" 2>/dev/null || echo none)")"
# Release ids start with a UTC timestamp, so name order is deploy order.
mapfile -t IDS < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort -r)
echo "Releases for $ENV_NAME (newest first; * live, x failed):"
for id in "${IDS[@]}"; do
  mark=" "
  [ -e "$RELEASES/$id/.failed" ] && mark="x"
  [ "$id" = "$LIVE" ] && mark="*"
  echo "  $mark $id"
done

if [ -z "$TARGET" ]; then
  # The newest good release deployed before the live one.
  for id in "${IDS[@]}"; do
    if [[ "$id" < "$LIVE" ]] && [ ! -e "$RELEASES/$id/.failed" ]; then TARGET="$id"; break; fi
  done
  [ -n "$TARGET" ] || die "no earlier good release to roll back to"
fi
[ -d "$RELEASES/$TARGET" ] || die "unknown release: $TARGET"
[ "$TARGET" != "$LIVE" ] || die "$TARGET is already live"
[ ! -e "$RELEASES/$TARGET/.failed" ] || log "WARNING: $TARGET failed when it was deployed"

log "Rolling $ENV_NAME back from $LIVE to $TARGET"
exec 9>"$ROOT/$ENV_NAME/.deploy.lock"
flock -n 9 || die "a deploy of $ENV_NAME is running"

if [ -n "$RESTORE_STAMP" ]; then
  DATA_DIR="$(sed -n 's/^DATA_DIR=//p' "$ENV_FILE" | tail -1)"
  DATA_DIR="${DATA_DIR:-/var/lib/encalm/$ENV_NAME}"
  run pm2 stop "$PM2_APP"
  run env DATA_DIR="$DATA_DIR" BACKUP_DIR="$BACKUP_DIR" "$RELEASES/$TARGET/scripts/restore.sh" "$RESTORE_STAMP" --yes
fi

if [ -f "$RELEASES/$TARGET/deploy/ecosystem.config.cjs" ]; then
  run install -m 0644 "$RELEASES/$TARGET/deploy/ecosystem.config.cjs" "$ROOT/ecosystem.config.cjs"
fi
run ln -sfn "$RELEASES/$TARGET" "$CURRENT.tmp"
run mv -T "$CURRENT.tmp" "$CURRENT"
run pm2 startOrReload "$ROOT/ecosystem.config.cjs" --only "$PM2_APP" --update-env

if [ "$DRY_RUN" != 1 ]; then
  for _ in $(seq 45); do
    if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/system/ready" >/dev/null 2>&1; then
      pm2 save >/dev/null
      log "Healthy. $ENV_NAME is on $TARGET"
      exit 0
    fi
    sleep 2
  done
  die "$TARGET did not become ready; check 'pm2 logs $PM2_APP'"
fi
