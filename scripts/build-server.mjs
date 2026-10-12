// Compiles the server to plain JavaScript in server/dist so production runs
// `node server/dist/index.js` with no TypeScript tooling installed.
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const outdir = 'server/dist';
fs.rmSync(outdir, { recursive: true, force: true });

await build({
  entryPoints: {
    index: 'server/src/index.ts',
    'create-user': 'server/src/scripts/create-user.ts',
  },
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Dependencies are installed with `npm ci --omit=dev` and loaded at runtime
  // (better-sqlite3 and sharp are native modules and cannot be bundled).
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

// Migrations are read from disk at startup.
fs.cpSync('server/src/db/migrations', path.join(outdir, 'migrations'), { recursive: true });
console.log(`Copied migrations to ${outdir}/migrations`);
