#!/usr/bin/env bash
# Encalm Project Dashboard: backup of the SQLite database and uploaded photos.
#
# Safe while the app is running: uses SQLite's online backup API (.backup),
# which produces a consistent copy even with WAL and concurrent writes.
#
# Environment (all optional):
#   DATA_DIR        data directory holding encalm.db and uploads/  (default: ./server/data)
#   DB_FILE         database file                                   (default: $DATA_DIR/encalm.db)
#   BACKUP_DIR      where backups are written                       (default: /var/backups/encalm)
#   RETENTION_DAYS  local copies older than this are deleted        (default: 30)
#   RCLONE_REMOTE   e.g. "b2:encalm-backups/prod"; if set, each backup is copied there
#   RCLONE_RETENTION_DAYS  remote copies older than this are deleted (default: RETENTION_DAYS)
#
# Cron (daily at 02:15, as the app user):
#   15 2 * * * cd /opt/encalm && ./scripts/backup.sh >> /var/log/encalm/backup.log 2>&1
set -euo pipefail

DATA_DIR="${DATA_DIR:-./server/data}"
DB_FILE="${DB_FILE:-$DATA_DIR/encalm.db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/encalm}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_RETENTION_DAYS="${RCLONE_RETENTION_DAYS:-$RETENTION_DAYS}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }
die() { log "ERROR: $*"; exit 1; }

command -v sqlite3 >/dev/null || die "sqlite3 is not installed (apt install sqlite3)"
[ -f "$DB_FILE" ] || die "database not found: $DB_FILE"
mkdir -p "$BACKUP_DIR"

# Never run two backups at once.
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || die "another backup is already running"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="encalm-$STAMP"
[ ! -e "$BACKUP_DIR/$NAME.db.gz" ] || die "a backup named $NAME already exists; try again in a second"
WORK="$(mktemp -d "$BACKUP_DIR/.tmp-$STAMP-XXXX")"
trap 'rm -rf "$WORK"' EXIT

log "Backing up $DB_FILE"
sqlite3 "$DB_FILE" ".timeout 10000" ".backup '$WORK/$NAME.db'"
CHECK="$(sqlite3 "$WORK/$NAME.db" 'PRAGMA integrity_check;')"
[ "$CHECK" = "ok" ] || die "integrity check failed on the backup copy: $CHECK"
gzip -9 "$WORK/$NAME.db"

if [ -d "$DATA_DIR/uploads" ]; then
  log "Archiving uploads"
  tar -C "$DATA_DIR" -czf "$WORK/$NAME-uploads.tar.gz" uploads
fi

(cd "$WORK" && sha256sum "$NAME"* > "$NAME.sha256")
mv "$WORK"/"$NAME"* "$BACKUP_DIR"/
log "Wrote $(ls "$BACKUP_DIR"/"$NAME"* | xargs -n1 basename | tr '\n' ' ')"

log "Removing local backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'encalm-*' -mtime "+$RETENTION_DAYS" -print -delete

if [ -n "$RCLONE_REMOTE" ]; then
  command -v rclone >/dev/null || die "RCLONE_REMOTE is set but rclone is not installed"
  log "Copying to $RCLONE_REMOTE"
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "$NAME*"
  rclone delete "$RCLONE_REMOTE" --min-age "${RCLONE_RETENTION_DAYS}d" --include 'encalm-*'
fi

log "Backup $NAME complete"
