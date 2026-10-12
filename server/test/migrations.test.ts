import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

// Build a database with the legacy schema *before* the app's database module is
// imported, so initDatabase() has to migrate it in place.
const legacy = new Database(process.env.DATABASE_PATH!);
legacy.pragma('foreign_keys = ON');
legacy.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, password_hash TEXT DEFAULT '',
    role TEXT NOT NULL CHECK(role IN ('hod', 'lead')), title TEXT NOT NULL, initials TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT NOT NULL, category TEXT NOT NULL, code TEXT NOT NULL,
    health TEXT NOT NULL CHECK(health IN ('On track', 'At risk', 'Delayed', 'Not started')),
    status TEXT NOT NULL DEFAULT 'Yet to start' CHECK(status IN ('Yet to start', 'In Design', 'In Tendering', 'Under Construction', 'Operational')),
    progress REAL NOT NULL DEFAULT 0, target_date TEXT NOT NULL, target_label TEXT NOT NULL,
    aop REAL NOT NULL DEFAULT 0, awarded REAL NOT NULL DEFAULT 0, spent REAL NOT NULL DEFAULT 0,
    next_milestone TEXT NOT NULL, next_milestone_date TEXT NOT NULL, lead_id TEXT NOT NULL,
    start_date TEXT, last_updated TEXT, specification_json TEXT, template_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE phases (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL, status TEXT NOT NULL, progress REAL NOT NULL DEFAULT 0, owner TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0, planned_start TEXT, planned_finish TEXT, actual_finish TEXT,
    work_completed TEXT, next_action TEXT, decision_required TEXT, updated_at TEXT
  );
  CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), revoked_at TEXT, replaced_by TEXT
  );
  INSERT INTO users (id, name, email, role, title, initials) VALUES ('u1', 'Old User', 'old@test.local', 'lead', 'Lead', 'OU');
  INSERT INTO projects (id, name, location, category, code, health, target_date, target_label, next_milestone, next_milestone_date, lead_id)
    VALUES ('p1', 'Legacy', 'Delhi', 'Lounge', 'DEL-1', 'On track', '2027', '2027', 'Brief', '2026', 'u1');
  INSERT INTO phases (id, project_id, name, status, owner) VALUES ('ph1', 'p1', 'Brief', 'active', 'PMO');
  INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ('rt1', 'u1', 'h', '2099-01-01');
`);
legacy.close();

describe('in-place schema migrations', () => {
  it('rebuilds users and projects without losing or orphaning child rows', async () => {
    const { db, initDatabase } = await import('../src/db/database.js');
    initDatabase();

    const tableSql = (t: string) => (db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(t) as { sql: string }).sql;
    expect(tableSql('projects')).toContain("'On Hold'");
    expect(tableSql('users')).toContain("'coordinator'");
    // Other tables still reference the real tables, not a renamed leftover.
    expect(tableSql('phases')).toMatch(/REFERENCES "?projects"?\(id\)/);
    expect(tableSql('refresh_tokens')).toMatch(/REFERENCES "?users"?\(id\)/);

    expect(db.prepare('SELECT COUNT(*) c FROM phases').get()).toEqual({ c: 1 });
    expect(db.prepare('SELECT COUNT(*) c FROM refresh_tokens').get()).toEqual({ c: 1 });
    expect((db.prepare("SELECT name FROM users WHERE id = 'u1'").get() as any).name).toBe('Old User');
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

    // 'On Hold' is now accepted, and cascades still work.
    db.prepare("UPDATE projects SET status = 'On Hold' WHERE id = 'p1'").run();
    db.prepare("INSERT INTO users (id, name, role, title, initials) VALUES ('c1', 'Coord', 'coordinator', 'C', 'CO')").run();
    db.prepare("DELETE FROM projects WHERE id = 'p1'").run();
    expect(db.prepare('SELECT COUNT(*) c FROM phases').get()).toEqual({ c: 0 });

    // Running again is a no-op.
    initDatabase();
    expect(db.prepare("SELECT COUNT(*) c FROM users").get()).toEqual({ c: 2 });
  });

  it('restores the committed portfolio snapshot completely into the migrated database', async () => {
    const { db } = await import('../src/db/database.js');
    const { restoreDatabaseFromJSON } = await import('../src/utils/backup.js');
    const snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/portfolio-database.json'), 'utf-8'));
    const result = restoreDatabaseFromJSON(snapshot);
    expect(result.count).toBe(snapshot.projects.length);
    expect((db.prepare('SELECT COUNT(*) c FROM projects').get() as { c: number }).c).toBe(snapshot.projects.length);
    expect((db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'On Hold'").get() as { c: number }).c).toBeGreaterThan(0);
  });
});
