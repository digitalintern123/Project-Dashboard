import { db } from '../db/database.js';
import type { UpdateRow } from './rows.js';
import type { Page } from '../utils/paging.js';

export type UpdateWithProject = UpdateRow & { project_name: string; project_code: string };

export const updatesRepo = {
  insert(row: Omit<UpdateRow, 'created_at'>): void {
    db.prepare(
      `INSERT INTO updates (id, project_id, date, author, role, text, stage, kind)
       VALUES (@id, @project_id, @date, @author, @role, @text, @stage, @kind)`,
    ).run(row);
  },
  listForProject(projectId: string, page: Page): UpdateRow[] {
    return db
      .prepare('SELECT * FROM updates WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?')
      .all(projectId, page.limit, page.offset) as UpdateRow[];
  },
  countForProject(projectId: string): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM updates WHERE project_id = ?').get(projectId) as { n: number }).n;
  },
  listRecent(page: Page): UpdateWithProject[] {
    return db
      .prepare(
        `SELECT u.*, p.name AS project_name, p.code AS project_code
         FROM updates u JOIN projects p ON u.project_id = p.id
         ORDER BY u.created_at DESC, u.rowid DESC LIMIT ? OFFSET ?`,
      )
      .all(page.limit, page.offset) as UpdateWithProject[];
  },
  countAll(): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM updates').get() as { n: number }).n;
  },
};
