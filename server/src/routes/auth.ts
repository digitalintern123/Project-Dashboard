import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  startSession,
} from '../utils/session.js';
import {
  checkPasswordPolicy,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from '../utils/passwords.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';

const router = Router();

// One message for every failure (unknown email, wrong password, locked account)
// so responses do not reveal which accounts exist or are locked.
const INVALID_CREDENTIALS = 'Invalid email or password. After repeated failed attempts, sign-in is paused for 15 minutes.';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Compared against when the email is unknown so response timing does not reveal
// which accounts exist.
const DUMMY_HASH = hashPassword(generateTemporaryPassword());

function toPublicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    initials: user.initials,
    mustChangePassword: Boolean(user.must_change_password),
  };
}

router.post('/login', validate({ body: S.loginBody }), (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare(
    "SELECT * FROM users WHERE LOWER(email) = ? AND role IN ('hod', 'lead', 'coordinator')",
  ).get(normalizedEmail) as any;

  const passwordOk = verifyPassword(password, user?.password_hash || DUMMY_HASH);
  const locked = Boolean(user?.locked_until && new Date(user.locked_until).getTime() > Date.now());

  if (!user || locked || !passwordOk) {
    if (user && !locked) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        db.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(
          new Date(Date.now() + LOCKOUT_MS).toISOString(),
          user.id,
        );
        console.warn(`[Auth] Account ${normalizedEmail} locked for 15 minutes after ${attempts} failed attempts (ip ${req.ip})`);
      } else {
        db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
      }
    }
    console.warn(`[Auth] Failed login for ${normalizedEmail} from ${req.ip}${locked ? ' (account locked)' : ''}`);
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }

  if (user.failed_attempts || user.locked_until) {
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  }

  startSession(res, user.id);
  return res.json({ user: toPublicUser(user) });
});

// POST /api/auth/refresh - rotate the refresh token and issue a new access token
router.post('/refresh', (req, res) => {
  const result = rotateSession(res, req.cookies?.[REFRESH_COOKIE]);
  if (result.status === 'raced') {
    // Another tab just rotated this token; its new cookies are already in the browser.
    return res.json({ retry: true });
  }
  if (result.status === 'invalid') {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.userId);
  return res.json({ user: toPublicUser(user) });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  revokeSession(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  return res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/logout-all - end every session for the signed-in user, on all devices
router.post('/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
  revokeAllSessions(req.user!.id);
  clearSessionCookies(res);
  return res.json({ message: 'Signed out of all sessions' });
});

// POST /api/auth/change-password - the signed-in user changes their own password
router.post('/change-password', requireAuth, validate({ body: S.changePasswordBody }), (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user!.id) as
    | { id: string; password_hash: string }
    | undefined;

  if (!user || typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  const policyError = checkPasswordPolicy(newPassword);
  if (policyError) {
    return res.status(400).json({ error: policyError });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'New password must be different from the current password' });
  }

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
    hashPassword(newPassword),
    user.id,
  );
  // Sign out every other session, then give this browser a fresh one.
  revokeAllSessions(user.id);
  startSession(res, user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return res.json({ message: 'Password changed successfully', user: toPublicUser(updated) });
});

// POST /api/auth/users/:id/reset-password - coordinator sets a temporary password
router.post('/users/:id/reset-password', requireAuth, requireRole(['coordinator']), validate({ params: S.idParams }), (req: AuthenticatedRequest, res) => {
  const target = db.prepare(
    "SELECT id, email FROM users WHERE id = ? AND role IN ('hod', 'lead', 'coordinator')",
  ).get(req.params.id) as { id: string; email: string } | undefined;
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const temporaryPassword = generateTemporaryPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(
    hashPassword(temporaryPassword),
    target.id,
  );
  revokeAllSessions(target.id);
  console.log(`[Auth] ${req.user!.email} reset the password for ${target.email}`);

  return res.json({
    message: 'Temporary password set. Share it securely; the user must change it at next sign-in.',
    temporaryPassword,
  });
});

router.get('/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, title, initials FROM users ORDER BY name ASC').all();
  return res.json({ users });
});

// GET /api/auth/leads - List all project leads
router.get('/leads', requireAuth, (_req, res) => {
  const leads = db.prepare('SELECT id, name, email, role, title, initials FROM users WHERE role = ? ORDER BY name ASC').all('lead');
  return res.json({ leads });
});

// POST /api/auth/create-lead - Coordinator can create new Project Leads with real credentials
router.post('/create-lead', requireAuth, requireRole(['coordinator']), validate({ body: S.createLeadBody }), (req: AuthenticatedRequest, res) => {
  const { name, email, password, title } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  const policyError = checkPasswordPolicy(password);
  if (policyError) {
    return res.status(400).json({ error: policyError });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const leadTitle = (title && title.trim()) || 'Project Lead';

  // Check if email already exists
  const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'A user with this email address already exists' });
  }

  // Derive initials
  const parts = trimmedName.split(/\s+/).filter(Boolean);
  let initials = 'PL';
  if (parts.length >= 2) {
    initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2).toUpperCase();
  }

  const id = `user-lead-${Date.now()}`;

  // The coordinator chose this password, so the lead must replace it at first sign-in.
  db.prepare(`
    INSERT INTO users (id, name, email, role, title, initials, password_hash, must_change_password)
    VALUES (?, ?, ?, 'lead', ?, ?, ?, 1)
  `).run(id, trimmedName, normalizedEmail, leadTitle, initials, hashPassword(password));

  const newLead = {
    id,
    name: trimmedName,
    email: normalizedEmail,
    role: 'lead',
    title: leadTitle,
    initials,
  };

  return res.status(201).json({
    message: 'Project Lead created successfully',
    lead: newLead,
  });
});

export default router;
