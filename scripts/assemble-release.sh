#!/usr/bin/env bash
# Collects a built app (after `npm run build`) into a folder that runs with
# production dependencies only: `npm ci --omit=dev` then `node server.cjs`.
# Used by .github/workflows/plesk-release.yml to publish the plesk-release
# branch, so servers that cannot build (Plesk on Windows) never have to.
#
#   scripts/assemble-release.sh <output-dir> [source-commit]
set -euo pipefail

OUT="${1:?usage: $0 <output-dir> [source-commit]}"
COMMIT="${2:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"

[ -f dist/index.html ] || { echo "dist/ missing: run npm run build first" >&2; exit 1; }
[ -f server/dist/index.js ] || { echo "server/dist/ missing: run npm run build first" >&2; exit 1; }

mkdir -p "$OUT"
# Replace everything except the output's own .git (the branch history).
find "$OUT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

cp package.json package-lock.json .npmrc server.cjs iisnode.yml "$OUT/"
mkdir -p "$OUT/server"
cp -R dist "$OUT/dist"
cp -R server/dist "$OUT/server/dist"

cat > "$OUT/.gitignore" <<'IGNORE'
node_modules/
iisnode/
IGNORE

cat > "$OUT/README.md" <<README
# Encalm Project Dashboard: built release

Generated from commit \`$COMMIT\` by the "Plesk release" workflow. Do not edit:
change the source on \`main\` instead.

Install and start (no build step, no Python or C++ tools needed):

    npm ci --omit=dev
    node server.cjs        # Plesk/iisnode: startup file server.cjs

Setup and environment variables: PRODUCTION.md on \`main\`, section 15.
README
echo "$COMMIT" > "$OUT/SOURCE_COMMIT"
echo "Assembled release of $COMMIT in $OUT"
