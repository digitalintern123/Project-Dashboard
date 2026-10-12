import { db } from '../db/database.js';
import type { UpdateRow } from './rows.js';

export type UpdateWithProject = UpdateRow & { project_name: string; project_code: string };

export const updatesRepo = {
  insert(row: Omit<UpdateRow, 'created_at'>): void {
    db.prepare(
      `INSERT INTO updates (id, project_id, date, author, role, text, stage, kind)
       VALUES (@id, @project_id, @date, @author, @role, @text, @stage, @kind)`,
    ).run(row);
  },
  listForProject(projectId: string): UpdateRow[] {
    return db
      .prepare('SELECT * FROM updates WHERE project_id = ? ORDER BY created_at DESC, rowid DESC')
      .all(projectId) as UpdateRow[];
  },
  listRecent(limit: number): UpdateWithProject[] {
    return db
      .prepare(
        `SELECT u.*, p.name AS project_name, p.code AS project_code
         FROM updates u JOIN projects p ON u.project_id = p.id
         ORDER BY u.created_at DESC, u.rowid DESC LIMIT ?`,
      )
      .all(limit) as UpdateWithProject[];
  },
};
