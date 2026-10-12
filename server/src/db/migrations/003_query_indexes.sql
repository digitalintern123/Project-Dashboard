-- Indexes for the queries the API actually runs (checked with EXPLAIN QUERY PLAN).
CREATE INDEX IF NOT EXISTS idx_notifications_inbox ON notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_project ON email_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_created ON updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_taken ON photos(taken_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_lead ON projects(lead_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
