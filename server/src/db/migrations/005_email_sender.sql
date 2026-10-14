-- Who an email is sent as: the signed-in user who caused it. NULL (older rows,
-- system emails) means the configured system mailbox. Additive only.
ALTER TABLE email_logs ADD COLUMN from_email TEXT;
ALTER TABLE email_logs ADD COLUMN from_name TEXT;
