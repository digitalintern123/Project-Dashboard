/**
 * Starts the real server for Playwright on a throwaway data directory with
 * three known accounts. Never touches server/data.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encalm-e2e-'));
process.env.DATA_DIR = dataDir;
process.env.DATABASE_PATH = path.join(dataDir, 'e2e.db');
process.env.API_PORT = process.env.E2E_PORT || '5070';
process.env.JWT_SECRET = 'e2e-secret-that-is-long-enough-for-the-checks-0123456789';
process.env.LOGIN_RATE_LIMIT = '100000';
process.env.API_RATE_LIMIT = '100000';
for (const key of Object.keys(process.env)) {
  if (/^(SMTP_|MS_GRAPH_|AZURE_)/.test(key)) delete process.env[key];
}

const { db, initDatabase } = await import('../server/src/db/database.js');
const { hashPassword } = await import('../server/src/utils/passwords.js');
const { E2E_USERS } = await import('./users.js');

initDatabase();
const insert = db.prepare(`
  INSERT OR REPLACE INTO users (id, name, email, password_hash, role, title, initials, must_change_password)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0)
`);
for (const u of Object.values(E2E_USERS)) {
  insert.run(u.id, u.name, u.email, hashPassword(u.password), u.role, u.title, u.initials);
}

console.log(`[e2e] data dir ${dataDir}`);
await import('../server/src/index.js');
