import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * ============================================================================
 * ARCHITECTURAL SINGLE SOURCE OF TRUTH (SSOT)
 * ============================================================================
 * The SQLite Database (`encalm.db`) is the canonical, authoritative master for
 * all portfolio data (projects, phases, milestones, issues, photos, updates,
 * notifications, and user authentications).
 *
 * Secondary artifacts (`portfolio-database.json` and client bundle fallbacks)
 * are derived point-in-time snapshots and must never override live database records.
 * ============================================================================
 */
export const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'encalm.db');
export const db = new Database(dbPath);

// Performance & data integrity pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('busy_timeout = 5000');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT DEFAULT '',
      role TEXT NOT NULL CHECK(role IN ('hod', 'lead', 'coordinator', 'stakeholder')),
      title TEXT NOT NULL,
      initials TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      must_change_password INTEGER NOT NULL DEFAULT 0,
      token_version INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      replaced_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      category TEXT NOT NULL,
      code TEXT NOT NULL,
      health TEXT NOT NULL CHECK(health IN ('On track', 'At risk', 'Delayed', 'Not started')),
      status TEXT NOT NULL DEFAULT 'Yet to start' CHECK(status IN ('Yet to start', 'In Design', 'In Tendering', 'Under Construction', 'Operational')),
      progress REAL NOT NULL DEFAULT 0,
      target_date TEXT NOT NULL,
      target_label TEXT NOT NULL,
      aop REAL NOT NULL DEFAULT 0,
      awarded REAL NOT NULL DEFAULT 0,
      spent REAL NOT NULL DEFAULT 0,
      projected_cost REAL NOT NULL DEFAULT 0,
      area TEXT,
      pax_keys TEXT,
      next_milestone TEXT NOT NULL,
      next_milestone_date TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      start_date TEXT,
      last_updated TEXT,
      specification_json TEXT,
      template_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('upcoming', 'active', 'blocked', 'complete')),
      progress REAL NOT NULL DEFAULT 0,
      owner TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      planned_start TEXT,
      planned_finish TEXT,
      actual_finish TEXT,
      work_completed TEXT,
      next_action TEXT,
      decision_required TEXT,
      budget REAL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('upcoming', 'complete', 'late')),
      stage TEXT,
      owner TEXT,
      approval_required INTEGER NOT NULL DEFAULT 0,
      approval_status TEXT DEFAULT 'Not required',
      completed_date TEXT,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('High', 'Medium', 'Low')),
      owner TEXT NOT NULL,
      category TEXT DEFAULT 'Other',
      status TEXT NOT NULL DEFAULT 'Open',
      stage TEXT,
      date_raised TEXT,
      due_date TEXT,
      impact_cost TEXT,
      impact_schedule TEXT,
      impact_scope TEXT,
      action TEXT,
      resolution TEXT,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS updates (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      author TEXT NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      stage TEXT,
      kind TEXT NOT NULL DEFAULT 'General',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      project_id TEXT,
      link TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      caption TEXT NOT NULL,
      stage TEXT,
      category TEXT DEFAULT 'Progress',
      taken_date TEXT,
      uploaded_by TEXT NOT NULL,
      role TEXT,
      file_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      template_type TEXT NOT NULL,
      project_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('sent', 'failed', 'outbox')),
      html_content TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, date);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id, severity);
    CREATE INDEX IF NOT EXISTS idx_updates_project ON updates(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
  `);

  // Safe migrations for projects, phases, milestones, issues, and notifications tables
  try {
    const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
    const colNames = new Set(projectColumns.map((c) => c.name));
    if (!colNames.has('status')) {
      db.prepare("ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'Yet to start'").run();
    }
    if (!colNames.has('projected_cost')) {
      db.prepare("ALTER TABLE projects ADD COLUMN projected_cost REAL NOT NULL DEFAULT 0").run();
    }
    if (!colNames.has('area')) {
      db.prepare("ALTER TABLE projects ADD COLUMN area TEXT").run();
    }
    if (!colNames.has('pax_keys')) {
      db.prepare("ALTER TABLE projects ADD COLUMN pax_keys TEXT").run();
    }

    const phaseColumns = db.prepare("PRAGMA table_info(phases)").all() as { name: string }[];
    const phaseColNames = new Set(phaseColumns.map((c) => c.name));
    if (!phaseColNames.has('weight')) {
      db.prepare("ALTER TABLE phases ADD COLUMN weight REAL").run();
    }
    if (!phaseColNames.has('tagged_users')) {
      db.prepare("ALTER TABLE phases ADD COLUMN tagged_users TEXT").run();
    }
    if (!phaseColNames.has('budget')) {
      db.prepare("ALTER TABLE phases ADD COLUMN budget REAL").run();
    }

    const milestoneColumns = db.prepare("PRAGMA table_info(milestones)").all() as { name: string }[];
    const milestoneColNames = new Set(milestoneColumns.map((c) => c.name));
    if (!milestoneColNames.has('tagged_users')) {
      db.prepare("ALTER TABLE milestones ADD COLUMN tagged_users TEXT").run();
    }

    const issueColumns = db.prepare("PRAGMA table_info(issues)").all() as { name: string }[];
    const issueColNames = new Set(issueColumns.map((c) => c.name));
    if (!issueColNames.has('tagged_users')) {
      db.prepare("ALTER TABLE issues ADD COLUMN tagged_users TEXT").run();
    }

    const notificationColumns = db.prepare("PRAGMA table_info(notifications)").all() as { name: string }[];
    const notificationColNames = new Set(notificationColumns.map((c) => c.name));
    if (!notificationColNames.has('recipient_id')) {
      db.prepare("ALTER TABLE notifications ADD COLUMN recipient_id TEXT").run();
    }
    db.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC)').run();

    const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const userColNames = new Set(userColumns.map((c) => c.name));
    if (!userColNames.has('must_change_password')) {
      db.prepare("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!userColNames.has('token_version')) {
      db.prepare("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0").run();
    }

    // Safe migration of legacy 'Build & install' phase names to 'Execution'
    db.prepare("UPDATE phases SET name = 'Execution' WHERE name IN ('Build & install', 'Build and install', 'Build & installation')").run();

    // Safe migration for users table CHECK constraint to support coordinator and stakeholder roles
    const userTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql?: string } | undefined;
    if (userTableInfo?.sql && (!userTableInfo.sql.includes('stakeholder') || !userTableInfo.sql.includes('coordinator'))) {
      db.exec(`
        ALTER TABLE users RENAME TO users_old;

        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT DEFAULT '',
          role TEXT NOT NULL CHECK(role IN ('hod', 'lead', 'coordinator', 'stakeholder')),
          title TEXT NOT NULL,
          initials TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          must_change_password INTEGER NOT NULL DEFAULT 0,
          token_version INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO users (id, name, email, password_hash, role, title, initials, created_at, must_change_password, token_version)
        SELECT id, name, email, password_hash, role, title, initials, created_at, must_change_password, token_version FROM users_old;

        DROP TABLE users_old;
      `);
      console.log('✓ Migrated users table schema to support coordinator and stakeholder roles.');
    }
  } catch (err) {
    console.warn('Column migration note:', err);
  }
}
