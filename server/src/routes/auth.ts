import { Router } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  startSession,
} from '../utils/session.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { audited, writeAudit } from '../utils/audit.js';
import { transactional } from '../utils/tx.js';
import { usersRepo } from '../repositories/users.repo.js';
import { authenticate, changePassword, createLead, resetPassword, toPublicUser } from '../services/auth.service.js';

const router = Router();

router.post('/login', validate({ body: S.loginBody }), (req, res) => {
  const user = authenticate(req.body.email, req.body.password, req.ip);
  startSession(res, user.id);
  res.json({ user: toPublicUser(user) });
});

// Rotate the refresh token and issue a new access token
router.post('/refresh', (req, res) => {
  const result = rotateSession(res, req.cookies?.[REFRESH_COOKIE]);
  if (result.status === 'raced') {
    // Another tab just rotated this token; its new cookies are already in the browser.
    return res.json({ retry: true });
  }
  const user = result.status === 'rotated' ? usersRepo.find(result.userId) : undefined;
  if (!user) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  return res.json({ user: toPublicUser(user) });
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  const userId = revokeSession(req.cookies?.[REFRESH_COOKIE]);
  if (userId) writeAudit({ userId, action: 'logout', entityType: 'user', entityId: userId, ip: req.ip });
  clearSessionCookies(res);
  res.json({ message: 'Logged out successfully' });
});

// End every session for the signed-in user, on all devices
router.post('/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
  revokeAllSessions(req.user!.id);
  clearSessionCookies(res);
  writeAudit({ userId: req.user!.id, action: 'logout_all', entityType: 'user', entityId: req.user!.id, ip: req.ip });
  res.json({ message: 'Signed out of all sessions' });
});

// The signed-in user changes their own password; other sessions are signed out.
router.post(
  '/change-password',
  requireAuth,
  validate({ body: S.changePasswordBody }),
  transactional((req: AuthenticatedRequest, res) => {
    const user = changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, req.ip);
    startSession(res, user.id);
    res.json({ message: 'Password changed successfully', user: toPublicUser(user) });
  }),
);

// Coordinator sets a temporary password
router.post(
  '/users/:id/reset-password',
  requireAuth,
  requireRole(['coordinator']),
  validate({ params: S.idParams }),
  transactional((req: AuthenticatedRequest, res) => {
    const temporaryPassword = resetPassword(req.params.id as string, req.user!, req.ip);
    res.json({
      message: 'Temporary password set. Share it securely; the user must change it at next sign-in.',
      temporaryPassword,
    });
  }),
);

router.get('/users', requireAuth, (_req, res) => {
  res.json({ users: usersRepo.listPublic() });
});

router.get('/leads', requireAuth, (_req, res) => {
  res.json({ leads: usersRepo.listLeads() });
});

router.post(
  '/create-lead',
  requireAuth,
  requireRole(['coordinator']),
  validate({ body: S.createLeadBody }),
  audited({ action: 'create', entityType: 'user', table: 'users' }),
  (req: AuthenticatedRequest, res) => {
    const lead = createLead(req.body);
    res.locals.auditEntityId = lead.id;
    res.status(201).json({ message: 'Project Lead created successfully', lead });
  },
);

export default router;
