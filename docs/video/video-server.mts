/**
 * Starts the real server for Playwright on a throwaway data directory with
 * the sample accounts in users.mjs. Never touches server/data.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = process.env.KEEP_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'encalm-e2e-'));
process.env.DATA_DIR = dataDir;
process.env.DATABASE_PATH = path.join(dataDir, 'e2e.db');
process.env.API_PORT = process.env.E2E_PORT || '5070';
process.env.JWT_SECRET = 'e2e-secret-that-is-long-enough-for-the-checks-0123456789';
process.env.LOGIN_RATE_LIMIT = '100000';
process.env.API_RATE_LIMIT = '100000';
for (const key of Object.keys(process.env)) {
  if (/^(SMTP_|MS_GRAPH_|AZURE_)/.test(key)) delete process.env[key];
}

const { db, initDatabase } = await import(new URL('../../server/src/db/database.js', import.meta.url).href);
const { hashPassword } = await import(new URL('../../server/src/utils/passwords.js', import.meta.url).href);
const { E2E_USERS } = await import('./users.mjs');

initDatabase();
const insert = db.prepare(`
  INSERT OR REPLACE INTO users (id, name, email, password_hash, role, title, initials, must_change_password)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);
for (const u of Object.values(E2E_USERS)) {
  insert.run(u.id, u.name, u.email, hashPassword(u.password), u.role, u.title, u.initials);
}

console.log(`[e2e] data dir ${dataDir}`);
await import(new URL('../../server/src/index.js', import.meta.url).href);
