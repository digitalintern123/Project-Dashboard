import { db } from '../db/database.js';
import type { IssueRow } from './rows.js';
import { updateColumns } from './sql.js';

export const issuesRepo = {
  exists(id: string): boolean {
    return Boolean(db.prepare('SELECT 1 FROM issues WHERE id = ?').get(id));
  },
  find(id: string, projectId: string): IssueRow | undefined {
    return db.prepare('SELECT * FROM issues WHERE id = ? AND project_id = ?').get(id, projectId) as
      IssueRow | undefined;
  },
  insert(row: IssueRow): void {
    db.prepare(
      `INSERT INTO issues (
        id, project_id, title, detail, severity, owner, category, status,
        stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
        action, resolution, tagged_users, order_index
      ) VALUES (
        @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
        @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
        @action, @resolution, @tagged_users, @order_index
      )`,
    ).run(row);
  },
  update(
    id: string,
    projectId: string,
    columns: Partial<Record<keyof IssueRow, string | number | null | undefined>>,
  ): void {
    updateColumns('issues', { id, project_id: projectId }, columns);
  },
  delete(id: string, projectId: string): boolean {
    return db.prepare('DELETE FROM issues WHERE id = ? AND project_id = ?').run(id, projectId).changes > 0;
  },
};
