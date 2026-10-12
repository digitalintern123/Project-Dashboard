import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Every test file gets its own throwaway data directory and SQLite database,
// so tests never touch server/data.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encalm-test-'));
process.env.DATA_DIR = dir;
process.env.DATABASE_PATH = path.join(dir, 'test.db');
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-the-checks-0123456789';
process.env.NODE_ENV = 'test';
// Many logins per test file come from the same address; keep the limiters out of the way.
process.env.LOGIN_RATE_LIMIT = '100000';
process.env.API_RATE_LIMIT = '100000';
// Never let tests reach a real mail server or Microsoft Graph: with nothing
// configured, every email lands in the in-app outbox.
for (const key of Object.keys(process.env)) {
  if (/^(SMTP_|MS_GRAPH_|AZURE_)/.test(key)) delete process.env[key];
}
delete process.env.APP_BASE_URL;
