// Startup file for Plesk / iisnode (Windows). iisnode passes a named pipe in
// PORT; server/src/listen.ts listens on it. Runs the compiled server
// (`npm run build` first); falls back to the TypeScript source through tsx
// only where dev dependencies are installed.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

process.chdir(__dirname);

const compiled = path.join(__dirname, 'server', 'dist', 'index.js');

function start() {
  if (fs.existsSync(compiled)) return import(pathToFileURL(compiled).href);
  return import('tsx/esm/api').then(({ register }) => {
    register();
    return import(pathToFileURL(path.join(__dirname, 'server', 'src', 'index.ts')).href);
  });
}

start().catch((err) => {
  console.error('Failed to start server (did you run "npm run build"?):', err);
  process.exit(1);
});
