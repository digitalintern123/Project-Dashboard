import { db } from '../db/database.js';

/** Users who can sign in and therefore have a notification inbox. */
function inboxUserIds(): string[] {
  const rows = db.prepare("SELECT id FROM users WHERE role IN ('coordinator', 'lead', 'hod')").all() as {
    id: string;
  }[];
  return rows.map((r) => r.id);
}

/**
 * Creates one notification row per signed-in user so that read/delete state is
 * tracked per recipient. `baseId` is suffixed with the user id.
 */
export function broadcastNotification(
  type: string,
  baseId: string,
  title: string,
  message: string,
  projectId: string | null,
  link: string | null,
): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `);
  db.transaction(() => {
    for (const userId of inboxUserIds()) {
      insert.run(`${baseId}--${userId}`, type, title, message, projectId, link, userId);
    }
  })();
}

/**
 * One-off migration: legacy notifications were global (recipient_id NULL).
 * Copy each one into every inbox and drop the global row, keeping its read flag.
 */
export function fanOutLegacyNotifications(): void {
  const legacy = db.prepare('SELECT * FROM notifications WHERE recipient_id IS NULL').all() as any[];
  if (legacy.length === 0) return;
  const users = inboxUserIds();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO notifications (id, type, title, message, project_id, link, recipient_id, read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const n of legacy) {
      for (const userId of users) {
        insert.run(
          `${n.id}--${userId}`,
          n.type,
          n.title,
          n.message,
          n.project_id,
          n.link,
          userId,
          n.read,
          n.created_at,
        );
      }
    }
    db.prepare('DELETE FROM notifications WHERE recipient_id IS NULL').run();
  })();
  console.log(`✓ Migrated ${legacy.length} global notifications to per-user inboxes.`);
}
