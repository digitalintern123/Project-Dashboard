#!/usr/bin/env bash
# Encalm Project Dashboard: restore a backup made by scripts/backup.sh.
#
# Usage:
#   scripts/restore.sh                     list available backups
#   scripts/restore.sh <STAMP|latest> [--no-uploads] [--yes]
#
# STOP THE APP FIRST (sudo -u encalm pm2 stop encalm-production / docker compose stop).
# Nothing is deleted: the current database and uploads are moved to
# $DATA_DIR/pre-restore-<time>/ before the backup is put in place.
#
# Environment: DATA_DIR, DB_FILE, BACKUP_DIR as in backup.sh.
set -euo pipefail

DATA_DIR="${DATA_DIR:-./server/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/encalm.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/encalm}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*"; exit 1; }

if [ $# -eq 0 ]; then
  echo "Available backups in $BACKUP_DIR:"
  ls -1 "$BACKUP_DIR"/encalm-*.db.gz 2>/dev/null | sed -E 's#.*/encalm-(.*)\.db\.gz#  \1#' || echo "  (none)"
  echo "Usage: $0 <STAMP|latest> [--no-uploads] [--yes]"
  exit 0
fi

TARGET="$1"; shift
RESTORE_UPLOADS=1; ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --no-uploads) RESTORE_UPLOADS=0 ;;
    --yes) ASSUME_YES=1 ;;
    *) die "unknown option: $arg" ;;
  esac
done

if [ "$TARGET" = "latest" ]; then
  TARGET="$(ls -1 "$BACKUP_DIR"/encalm-*.db.gz 2>/dev/null | sort | tail -n1 | sed -E 's#.*/encalm-(.*)\.db\.gz#\1#')"
  [ -n "$TARGET" ] || die "no backups found in $BACKUP_DIR"
fi
NAME="encalm-$TARGET"
DB_GZ="$BACKUP_DIR/$NAME.db.gz"
UPLOADS_TGZ="$BACKUP_DIR/$NAME-uploads.tar.gz"
[ -f "$DB_GZ" ] || die "backup not found: $DB_GZ"
command -v sqlite3 >/dev/null || die "sqlite3 is not installed (apt install sqlite3)"

if [ -f "$BACKUP_DIR/$NAME.sha256" ]; then
  log "Verifying checksums"
  (cd "$BACKUP_DIR" && sha256sum -c "$NAME.sha256") || die "checksum mismatch: the backup is damaged"
fi

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Restore $NAME over $DB_FILE? The app must be stopped. [y/N] " answer
  [ "$answer" = "y" ] || [ "$answer" = "Y" ] || die "aborted"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
gunzip -c "$DB_GZ" > "$WORK/encalm.db"
CHECK="$(sqlite3 "$WORK/encalm.db" 'PRAGMA integrity_check;')"
[ "$CHECK" = "ok" ] || die "integrity check failed on the backup: $CHECK"

ASIDE="$DATA_DIR/pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$ASIDE"
log "Moving the current database aside to $ASIDE"
for f in "$DB_FILE" "$DB_FILE-wal" "$DB_FILE-shm"; do
  [ -f "$f" ] && mv "$f" "$ASIDE/"
done
mv "$WORK/encalm.db" "$DB_FILE"

if [ "$RESTORE_UPLOADS" -eq 1 ] && [ -f "$UPLOADS_TGZ" ]; then
  log "Restoring uploads"
  [ -d "$DATA_DIR/uploads" ] && mv "$DATA_DIR/uploads" "$ASIDE/uploads"
  tar -C "$DATA_DIR" -xzf "$UPLOADS_TGZ"
fi

log "Restored $NAME. Previous data kept in $ASIDE. Start the app again."
