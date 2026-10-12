#!/usr/bin/env bash
# Verifies the backup -> damage -> restore round trip on a throwaway data
# directory, with the database being written to while the backup runs.
# Usage: scripts/test-backup-restore.sh   (needs sqlite3, node, npm deps)
set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
WRITER_PID=""
cleanup() {
  if [ -n "$WRITER_PID" ]; then kill "$WRITER_PID" 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
export DATA_DIR="$TMP/data" BACKUP_DIR="$TMP/backups" RETENTION_DAYS=30
mkdir -p "$DATA_DIR/uploads"
DB="$DATA_DIR/encalm.db"
fail() { echo "FAIL: $*"; exit 1; }

echo "1. Create a database with the real schema, a project and an uploaded file"
cat > "$TMP/seed.mts" <<TS
import { db, initDatabase } from '$PWD/server/src/db/database.ts';
initDatabase();
db.prepare("INSERT INTO projects (id, name, location, category, code, health, target_date, target_label, next_milestone, next_milestone_date, lead_id) VALUES ('rt-1', 'Round trip', 'Delhi', 'Lounge', 'RT', 'On track', '2027', '2027', 'x', 'x', '')").run();
TS
npx tsx "$TMP/seed.mts"
echo "photo-bytes" > "$DATA_DIR/uploads/rt-photo.webp"

echo "2. Back up while another process keeps writing"
cat > "$TMP/writer.mts" <<TS
import { db } from '$PWD/server/src/db/database.ts';
let i = 0;
setInterval(() => db.prepare("INSERT INTO system_settings (key, value) VALUES (?, 'x')").run('writer-' + i++), 5);
TS
npx tsx "$TMP/writer.mts" &
WRITER_PID=$!
sleep 2
scripts/backup.sh
kill "$WRITER_PID"; wait "$WRITER_PID" 2>/dev/null || true; WRITER_PID=""

ls "$BACKUP_DIR"/encalm-*.db.gz >/dev/null || fail "no database backup written"
ls "$BACKUP_DIR"/encalm-*-uploads.tar.gz >/dev/null || fail "no uploads archive written"
(cd "$BACKUP_DIR" && sha256sum -c encalm-*.sha256 >/dev/null) || fail "checksums do not verify"

echo "3. Damage the live data"
sqlite3 "$DB" "DELETE FROM projects WHERE id = 'rt-1';"
rm "$DATA_DIR/uploads/rt-photo.webp"

echo "4. Restore the latest backup"
scripts/restore.sh latest --yes

echo "5. Check everything came back and nothing was thrown away"
[ "$(sqlite3 "$DB" "SELECT name FROM projects WHERE id = 'rt-1';")" = "Round trip" ] || fail "project not restored"
[ "$(sqlite3 "$DB" 'PRAGMA integrity_check;')" = "ok" ] || fail "restored database fails integrity_check"
[ "$(cat "$DATA_DIR/uploads/rt-photo.webp")" = "photo-bytes" ] || fail "upload not restored"
[ "$(sqlite3 "$DB" 'SELECT COUNT(*) FROM schema_migrations;')" -ge 1 ] || fail "schema_migrations missing"
ls -d "$DATA_DIR"/pre-restore-*/encalm.db >/dev/null || fail "previous database was not kept"

echo "6. Retention removes only old backups"
touch -d '40 days ago' "$BACKUP_DIR/encalm-19990101T000000Z.db.gz"
sleep 1
scripts/backup.sh >/dev/null
[ ! -e "$BACKUP_DIR/encalm-19990101T000000Z.db.gz" ] || fail "old backup not pruned"
[ "$(ls "$BACKUP_DIR"/encalm-*.db.gz | wc -l)" -eq 2 ] || fail "recent backups were pruned"

echo "PASS: backup/restore round trip verified"
