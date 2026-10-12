import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { JWT_SECRET, requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === 'coordinator@encalm.com' || normalizedEmail === 'coordinator') {
    normalizedEmail = 'digital.intern@encalm.com';
  }
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(normalizedEmail) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isValidPassword = bcrypt.compareSync(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const userPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    initials: user.initials,
  };

  const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    token,
    user: userPayload,
  });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  return res.json({ message: 'Logged out successfully' });
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
  const { name, email, password, title } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
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
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, name, email, role, title, initials, password_hash)
    VALUES (?, ?, ?, 'lead', ?, ?, ?)
  `).run(id, trimmedName, normalizedEmail, leadTitle, initials, passwordHash);

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
