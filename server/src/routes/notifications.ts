import { Router } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { notificationsRepo } from '../repositories/notifications.repo.js';

const router = Router();

router.use(requireAuth);

// GET the signed-in user's notifications
router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  res.json({
    notifications: notificationsRepo.listForRecipient(userId, 50).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      projectId: n.project_id,
      link: n.link,
      read: Boolean(n.read),
      createdAt: n.created_at,
    })),
    unreadCount: notificationsRepo.unreadCount(userId),
  });
});

// PATCH mark one of the user's notifications as read
router.patch('/:id/read', validate({ params: S.idParams }), (req: AuthenticatedRequest, res) => {
  if (!notificationsRepo.markRead(req.params.id as string, req.user!.id)) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  return res.json({ success: true });
});

// POST mark all of the user's notifications as read
router.post('/read-all', (req: AuthenticatedRequest, res) => {
  notificationsRepo.markAllRead(req.user!.id);
  res.json({ success: true });
});

// DELETE one of the user's notifications
router.delete('/:id', validate({ params: S.idParams }), (req: AuthenticatedRequest, res) => {
  if (!notificationsRepo.delete(req.params.id as string, req.user!.id)) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  return res.json({ success: true });
});

export default router;
