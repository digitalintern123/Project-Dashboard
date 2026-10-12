import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

// Development-only fallback. In production the server refuses to start without a
// strong JWT_SECRET (see config.ts).
const DEV_JWT_SECRET = 'encalm-secret-jwt-key-2026';

export const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;

export type UserPayload = {
  id: string;
  name: string;
  email: string;
  role: 'hod' | 'lead' | 'coordinator';
  title: string;
  initials: string;
  mustChangePassword?: boolean;
};

// Routes a user may still call while their password must be changed.
const PASSWORD_CHANGE_ALLOWED = new Set(['/api/auth/me', '/api/auth/change-password', '/api/auth/logout', '/api/auth/logout-all']);

/** Cookie holding the short-lived access JWT (set by utils/session.ts). */
export const ACCESS_COOKIE_NAME = 'encalm_at';

type UserRow = Omit<UserPayload, 'mustChangePassword'> & { must_change_password: number; token_version: number };

function loadUser(id: string): (UserPayload & { tokenVersion: number }) | undefined {
  const row = db
    .prepare('SELECT id, name, email, role, title, initials, must_change_password, token_version FROM users WHERE id = ?')
    .get(id) as UserRow | undefined;
  if (!row) return undefined;
  const { must_change_password, token_version, ...rest } = row;
  return { ...rest, mustChangePassword: Boolean(must_change_password), tokenVersion: token_version };
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Authentication is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: string; tv?: number };
    if (!decoded.id || typeof decoded.tv !== 'number') {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    // The user must still exist and the token must not have been revoked.
    const user = loadUser(decoded.id);
    if (!user || user.tokenVersion !== decoded.tv) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    if (user.mustChangePassword && !PASSWORD_CHANGE_ALLOWED.has(`${req.baseUrl}${req.path}`)) {
      return res.status(403).json({ error: 'You must change your password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }

    const { tokenVersion: _tv, ...publicUser } = user;
    req.user = publicUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}

export function requireRole(allowedRoles: ('hod' | 'lead' | 'coordinator')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Action restricted to ${allowedRoles.join(' or ')} role(s). Current role is ${req.user.role}.`
      });
    }

    next();
  };
}

/**
 * Checks whether an authenticated user has permission to modify a project:
 * - 'coordinator': Full supervisory permissions across all projects.
 * - 'lead': Can only edit projects allotted to them or unassigned.
 * - 'hod': Strictly read-only across all projects.
 */
export function canUserEditProject(projectId: string, user: UserPayload): boolean {
  if (user.role === 'coordinator') return true;
  if (user.role === 'hod') return false;
  if (user.role === 'lead') {
    const project = db.prepare('SELECT lead_id FROM projects WHERE id = ?').get(projectId) as { lead_id: string | null } | undefined;
    if (!project) return false;
    return !project.lead_id || project.lead_id === user.id;
  }
  return false;
}

export function requireProjectAccess(projectIdParam: string = 'id') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const projectId = req.params[projectIdParam] || req.body?.projectId || req.params.projectId || req.params.id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const exists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId);
    if (!exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!canUserEditProject(projectId, req.user)) {
      return res.status(403).json({
        error: req.user.role === 'hod'
          ? 'Forbidden: HOD role has strict view-only oversight'
          : 'Forbidden: You can only edit projects allotted to you',
      });
    }

    next();
  };
}
