import { db } from '../db/database.js';
import type { NotificationRow } from './notifications.repo.js';

const COUNTED_TABLES = ['projects', 'users', 'phases', 'milestones', 'issues', 'updates'] as const;
export type CountedTable = (typeof COUNTED_TABLES)[number];

export const systemRepo = {
  /** True when the database answers a trivial query. */
  ping(): boolean {
    const row = db.prepare('SELECT 1 AS alive').get() as { alive: number } | undefined;
    return row?.alive === 1;
  },
  rowCounts(): Record<CountedTable, number> {
    return Object.fromEntries(
      COUNTED_TABLES.map((table) => [
        table,
        (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
      ]),
    ) as Record<CountedTable, number>;
  },
  recentNotifications(limit: number): NotificationRow[] {
    return db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?').all(limit) as NotificationRow[];
  },
};
