import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';

const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_JWT_SECRET = 'encalm-secret-jwt-key-2026';

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET)) {
  console.warn('[SECURITY WARNING] Running in production mode with default or unset JWT_SECRET! Please define a strong JWT_SECRET in your .env file.');
}

export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

export type UserPayload = {
  id: string;
  name: string;
  email: string;
  role: 'hod' | 'lead' | 'coordinator';
  title: string;
  initials: string;
};

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token is required' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    
    // Check if user still exists in database
    const user = db.prepare('SELECT id, name, email, role, title, initials FROM users WHERE id = ?').get(decoded.id) as UserPayload | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
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

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    const user = db.prepare('SELECT id, name, email, role, title, initials FROM users WHERE id = ?').get(decoded.id) as UserPayload | undefined;
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid token in optional auth
  }
  next();
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
