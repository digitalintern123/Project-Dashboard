#!/bin/bash
# Starts the sample server on a fresh throwaway database (port 5073) and seeds it.
# Sample data only: it never touches server/data. Run from anywhere.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
fuser -k 5073/tcp >/dev/null 2>&1 || true
sleep 1
mkdir -p "$HERE/.out/runs"
DIR=$(mktemp -d "$HERE/.out/runs/db-XXXX")
cd "$ROOT"
E2E_PORT=5073 KEEP_DIR=$DIR nohup npx tsx docs/video/video-server.mts > "$HERE/.out/server.log" 2>&1 &
for i in $(seq 1 40); do curl -sf -o /dev/null http://localhost:5073/api/client-config && break; sleep 1; done
npx playwright test -c docs/video/video.config.ts video-seed --reporter=dot >/dev/null
npx playwright test -c docs/video/video.config.ts video-prep --reporter=dot >/dev/null
# Chapter 1 shows a first sign-in, so Priya must be asked for a new password.
node -e "
const D=require('better-sqlite3');const db=new D('$DIR/e2e.db');
db.prepare(\"update users set must_change_password=1 where id='u-priya'\").run();"
echo "reset: $DIR"
