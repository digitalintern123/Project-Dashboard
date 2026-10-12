import { db } from '../db/database.js';
import type { Page } from '../utils/paging.js';

export type NotificationRow = {
  id: string;
  recipient_id: string | null;
  type: string;
  title: string;
  message: string;
  project_id: string | null;
  link: string | null;
  read: number;
  created_at: string;
};

export type NewNotification = Omit<NotificationRow, 'read' | 'created_at'> & { read?: number; created_at?: string };

export const notificationsRepo = {
  /** Inserts a notification; an existing id is left alone. */
  insert(row: NewNotification): void {
    db.prepare(
      `INSERT OR IGNORE INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
       VALUES (@id, @type, @title, @message, @project_id, @link, @recipient_id, @read, COALESCE(@created_at, datetime('now')))`,
    ).run({ read: 0, created_at: null, ...row });
  },
  /** Notifications from before per-user inboxes (no recipient). */
  listLegacy(): NotificationRow[] {
    return db.prepare('SELECT * FROM notifications WHERE recipient_id IS NULL').all() as NotificationRow[];
  },
  deleteLegacy(): void {
    db.prepare('DELETE FROM notifications WHERE recipient_id IS NULL').run();
  },
  listForRecipient(recipientId: string, page: Page): NotificationRow[] {
    return db
      .prepare('SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(recipientId, page.limit, page.offset) as NotificationRow[];
  },
  countForRecipient(recipientId: string): number {
    return (
      db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE recipient_id = ?').get(recipientId) as { n: number }
    ).n;
  },
  unreadCount(recipientId: string): number {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM notifications WHERE recipient_id = ? AND read = 0')
      .get(recipientId) as { count: number };
    return row.count;
  },
  /** Returns false when the notification does not exist or belongs to someone else. */
  markRead(id: string, recipientId: string): boolean {
    return (
      db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND recipient_id = ?').run(id, recipientId).changes > 0
    );
  },
  markAllRead(recipientId: string): void {
    db.prepare('UPDATE notifications SET read = 1 WHERE recipient_id = ? AND read = 0').run(recipientId);
  },
  delete(id: string, recipientId: string): boolean {
    return db.prepare('DELETE FROM notifications WHERE id = ? AND recipient_id = ?').run(id, recipientId).changes > 0;
  },
};
