-- migrate:foreign-keys-off
-- Adds the strictly view-only 'viewer' role. SQLite cannot change a CHECK
-- constraint in place, so users is rebuilt with every row copied unchanged.
-- refresh_tokens references users(id); with foreign keys off during the
-- rebuild its rows survive, and the runner verifies foreign_key_check after.
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT DEFAULT '',
  role TEXT NOT NULL CHECK(role IN ('hod', 'lead', 'coordinator', 'stakeholder', 'viewer')),
  title TEXT NOT NULL,
  initials TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
INSERT INTO users_new (
  id, name, email, password_hash, role, title, initials, created_at,
  must_change_password, token_version, failed_attempts, locked_until
)
SELECT
  id, name, email, password_hash, role, title, initials, created_at,
  must_change_password, token_version, failed_attempts, locked_until
FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
