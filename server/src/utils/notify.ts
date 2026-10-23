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
 * Notifies the people who oversee a project: every HOD and Coordinator, plus the
 * project's lead. The person who made the change is left out, and so is anyone
 * in `exclude` (for example people already notified because they were tagged).
 */
export function notifyProjectWatchers(input: {
  type: string;
  baseId: string;
  title: string;
  message: string;
  projectId: string;
  actorId: string;
  exclude?: string[];
}): string[] {
  const project = db.prepare('SELECT lead_id FROM projects WHERE id = ?').get(input.projectId) as
    { lead_id: string | null } | undefined;
  const rows = db
    .prepare("SELECT id FROM users WHERE role IN ('hod', 'coordinator') OR (role = 'lead' AND id = ?)")
    .all(project?.lead_id ?? '') as { id: string }[];
  const skip = new Set([input.actorId, ...(input.exclude ?? [])]);
  const recipients = [...new Set(rows.map((r) => r.id))].filter((id) => !skip.has(id));
  db.transaction(() => {
    for (const userId of recipients) {
      notificationsRepo.insert({
        id: `${input.baseId}--${userId}`,
        type: input.type,
        title: input.title,
        message: input.message,
        project_id: input.projectId,
        link: `/project/${input.projectId}`,
        recipient_id: userId,
      });
    }
  })();
  return recipients;
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
