import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';

const router = Router();

router.use(requireAuth);

// GET the signed-in user's notifications
router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE recipient_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId) as any[];

  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND read = 0').get(userId) as { count: number };

  return res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      projectId: n.project_id,
      link: n.link,
      read: Boolean(n.read),
      createdAt: n.created_at,
    })),
    unreadCount: unreadCount.count,
  });
});

// PATCH mark one of the user's notifications as read
router.patch('/:id/read', validate({ params: S.idParams }), (req: AuthenticatedRequest, res) => {
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND recipient_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
  return res.json({ success: true });
});

// POST mark all of the user's notifications as read
router.post('/read-all', (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE recipient_id = ? AND read = 0').run(req.user!.id);
  return res.json({ success: true });
});

// DELETE one of the user's notifications
router.delete('/:id', validate({ params: S.idParams }), (req: AuthenticatedRequest, res) => {
  const result = db.prepare('DELETE FROM notifications WHERE id = ? AND recipient_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
  return res.json({ success: true });
});

export default router;
