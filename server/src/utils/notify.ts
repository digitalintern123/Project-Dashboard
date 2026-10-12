import { db } from '../db/database.js';
import { notificationsRepo } from '../repositories/notifications.repo.js';
import { usersRepo } from '../repositories/users.repo.js';
import { logger } from '../logger.js';

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
  db.transaction(() => {
    for (const userId of usersRepo.inboxUserIds()) {
      notificationsRepo.insert({
        id: `${baseId}--${userId}`,
        type,
        title,
        message,
        project_id: projectId,
        link,
        recipient_id: userId,
      });
    }
  })();
}

/**
 * One-off migration: legacy notifications were global (recipient_id NULL).
 * Copy each one into every inbox and drop the global row, keeping its read flag.
 */
export function fanOutLegacyNotifications(): void {
  const legacy = notificationsRepo.listLegacy();
  if (legacy.length === 0) return;
  const users = usersRepo.inboxUserIds();
  db.transaction(() => {
    for (const n of legacy) {
      for (const userId of users) {
        notificationsRepo.insert({ ...n, id: `${n.id}--${userId}`, recipient_id: userId });
      }
    }
    notificationsRepo.deleteLegacy();
  })();
  logger.info(`✓ Migrated ${legacy.length} global notifications to per-user inboxes.`);
}
