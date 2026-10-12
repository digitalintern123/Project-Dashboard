-- Outgoing email is queued and delivered by a background worker with retries.
-- email_logs gains a 'queued' status and reply_to. Nothing references
-- email_logs, so it can be rebuilt inside the normal migration transaction.
CREATE TABLE email_logs_new (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  reply_to TEXT,
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL,
  project_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('queued', 'sent', 'failed', 'outbox')),
  html_content TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO email_logs_new (id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at)
  SELECT id, recipient_email, recipient_name, subject, template_type, project_id, status, html_content, error, created_at FROM email_logs;
DROP TABLE email_logs;
ALTER TABLE email_logs_new RENAME TO email_logs;
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_project ON email_logs(project_id, created_at DESC);

-- One row per email waiting to be (re)delivered. The message itself lives in email_logs.
CREATE TABLE IF NOT EXISTS email_queue (
  log_id TEXT PRIMARY KEY REFERENCES email_logs(id) ON DELETE CASCADE,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_attempt_at TEXT NOT NULL,
  locked_until TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_email_queue_due ON email_queue(next_attempt_at);
