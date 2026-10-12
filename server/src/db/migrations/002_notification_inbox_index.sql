-- Per-user notification inbox lookups (recipient_id is added to older
-- databases during adoption, so this index cannot live in 001).
DROP INDEX IF EXISTS idx_notifications_read;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read, created_at DESC);
