import { db } from '../db/database.js';

type Value = string | number | null;

/**
 * UPDATE <table> SET ... for the given columns, skipping undefined values.
 * Column names come only from callers' fixed maps, never from user input.
 */
export function updateColumns(
  table: string,
  where: Record<string, Value>,
  columns: Record<string, Value | undefined>,
): number {
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined) as [string, Value][];
  if (entries.length === 0) return 0;
  const whereEntries = Object.entries(where);
  const sql = `UPDATE ${table} SET ${entries.map(([c]) => `${c} = ?`).join(', ')} WHERE ${whereEntries
    .map(([c]) => `${c} = ?`)
    .join(' AND ')}`;
  return db.prepare(sql).run(...entries.map(([, v]) => v), ...whereEntries.map(([, v]) => v)).changes;
}

/** Groups rows by project_id, preserving query order. */
export function groupByProject<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.project_id);
    if (list) list.push(row);
    else map.set(row.project_id, [row]);
  }
  return map;
}

/** `?, ?, ?` placeholders for an IN (...) list. */
export const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Today as '12 Oct 2026', the format stored in last_updated / updated_at. */
export function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
