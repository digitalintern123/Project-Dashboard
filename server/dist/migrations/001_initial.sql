-- Baseline schema. Every statement is idempotent so this also runs safely on
-- databases created before versioned migrations existed; the runner then
-- brings older tables up to this shape (see adoptLegacySchema in migrate.ts).

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
  token_version INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
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

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  code TEXT NOT NULL,
  health TEXT NOT NULL CHECK(health IN ('On track', 'At risk', 'Delayed', 'Not started')),
  status TEXT NOT NULL DEFAULT 'Yet to start' CHECK(status IN ('Yet to start', 'In Design', 'In Tendering', 'Under Construction', 'Operational', 'On Hold')),
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
  updated_at TEXT,
  weight REAL,
  tagged_users TEXT
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
  order_index INTEGER NOT NULL DEFAULT 0,
  tagged_users TEXT
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
  order_index INTEGER NOT NULL DEFAULT 0,
  tagged_users TEXT
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  recipient_id TEXT
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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  thumbnail_url TEXT
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

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes on columns every version of the schema has. Indexes on columns that
-- older databases gain during adoption live in later migrations.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, date);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id, severity);
CREATE INDEX IF NOT EXISTS idx_updates_project ON updates(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_project ON photos(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
