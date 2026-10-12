import { db } from '../db/database.js';

export type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_json: string | null;
  after_json: string | null;
  ip: string | null;
  created_at: string;
};

export type AuditFilter = { userId?: string; entityType?: string; entityId?: string; action?: string };

const FILTER_COLUMNS: Record<keyof AuditFilter, string> = {
  userId: 'a.user_id',
  entityType: 'a.entity_type',
  entityId: 'a.entity_id',
  action: 'a.action',
};

function whereClause(filter: AuditFilter): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  for (const [key, column] of Object.entries(FILTER_COLUMNS) as [keyof AuditFilter, string][]) {
    const value = filter[key];
    if (value) {
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export const auditRepo = {
  insert(row: Omit<AuditRow, 'created_at'>): void {
    db.prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, before_json, after_json, ip, created_at)
       VALUES (@id, @user_id, @action, @entity_type, @entity_id, @before_json, @after_json, @ip,
               strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    ).run(row);
  },
  count(filter: AuditFilter): number {
    const where = whereClause(filter);
    const row = db.prepare(`SELECT COUNT(*) AS count FROM audit_log a ${where.sql}`).get(...where.params) as {
      count: number;
    };
    return row.count;
  },
  /** Newest first, with the acting user's name and email. */
  list(
    filter: AuditFilter,
    limit: number,
    offset: number,
  ): Array<AuditRow & { user_name: string | null; user_email: string | null }> {
    const where = whereClause(filter);
    return db
      .prepare(
        `SELECT a.*, u.name AS user_name, u.email AS user_email
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         ${where.sql}
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...where.params, limit, offset) as Array<AuditRow & { user_name: string | null; user_email: string | null }>;
  },
  /** The current row of `table` (a fixed, trusted table name). */
  findRow(table: string, id: string): Record<string, unknown> | undefined {
    return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  },
};
