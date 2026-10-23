-- People saved from the Microsoft 365 directory (no password: they cannot sign
-- in) used to get an app role guessed from their job title, e.g. "Manager" made
-- them a Project Lead. They are only tagged and emailed, so they become
-- stakeholders. Accounts with a password are untouched; nobody is deleted.
UPDATE users
SET role = 'stakeholder'
WHERE (password_hash IS NULL OR password_hash = '')
  AND role IN ('lead', 'hod', 'coordinator');
