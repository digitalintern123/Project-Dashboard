import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { JWT_SECRET, requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import {
  checkPasswordPolicy,
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from '../utils/passwords.js';

const router = Router();

const INVALID_CREDENTIALS = 'Invalid email or password';

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

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare(
    "SELECT * FROM users WHERE LOWER(email) = ? AND role IN ('hod', 'lead', 'coordinator')",
  ).get(normalizedEmail) as any;

  const passwordOk = verifyPassword(password, user?.password_hash || DUMMY_HASH);
  if (!user || !passwordOk) {
    console.warn(`[Auth] Failed login for ${normalizedEmail} from ${req.ip}`);
    return res.status(401).json({ error: INVALID_CREDENTIALS });
  }

  const userPayload = toPublicUser(user);
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, title: user.title, initials: user.initials },
    JWT_SECRET,
    { expiresIn: '7d' },
  );

  return res.json({ token, user: userPayload });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  return res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/change-password - the signed-in user changes their own password
router.post('/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
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
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  return res.json({ message: 'Password changed successfully', user: toPublicUser(updated) });
});

// POST /api/auth/users/:id/reset-password - coordinator sets a temporary password
router.post('/users/:id/reset-password', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
  const target = db.prepare(
    "SELECT id, email FROM users WHERE id = ? AND role IN ('hod', 'lead', 'coordinator')",
  ).get(req.params.id) as { id: string; email: string } | undefined;
  if (!target) {
    return res.status(404).json({ error: 'User not found' });
  }

  const temporaryPassword = generateTemporaryPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(
    hashPassword(temporaryPassword),
    target.id,
  );
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
router.post('/create-lead', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
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
