import { db } from '../db/database.js';
import type { MilestoneRow } from './rows.js';
import { updateColumns } from './sql.js';

export const milestonesRepo = {
  exists(id: string): boolean {
    return Boolean(db.prepare('SELECT 1 FROM milestones WHERE id = ?').get(id));
  },
  find(id: string, projectId: string): MilestoneRow | undefined {
    return db.prepare('SELECT * FROM milestones WHERE id = ? AND project_id = ?').get(id, projectId) as
      MilestoneRow | undefined;
  },
  insert(row: MilestoneRow): void {
    db.prepare(
      `INSERT INTO milestones (
        id, project_id, title, date, status, stage, owner,
        approval_required, approval_status, completed_date, tagged_users, order_index
      ) VALUES (
        @id, @project_id, @title, @date, @status, @stage, @owner,
        @approval_required, @approval_status, @completed_date, @tagged_users, @order_index
      )`,
    ).run(row);
  },
  update(
    id: string,
    projectId: string,
    columns: Partial<Record<keyof MilestoneRow, string | number | null | undefined>>,
  ): void {
    updateColumns('milestones', { id, project_id: projectId }, columns);
  },
  delete(id: string, projectId: string): boolean {
    return db.prepare('DELETE FROM milestones WHERE id = ? AND project_id = ?').run(id, projectId).changes > 0;
  },
};
