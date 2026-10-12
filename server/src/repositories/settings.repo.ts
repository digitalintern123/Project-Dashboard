import { db } from '../db/database.js';

const upsertSql = `INSERT INTO system_settings (key, value, updated_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`;

/** Key/value rows in `system_settings`. */
export const settingsRepo = {
  get(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  },
  set(key: string, value: string): void {
    db.prepare(upsertSql).run(key, value);
  },
  /** Writes several settings atomically. */
  setMany(entries: Array<[key: string, value: string]>): void {
    const upsert = db.prepare(upsertSql);
    db.transaction(() => entries.forEach(([key, value]) => upsert.run(key, value)))();
  },
};
