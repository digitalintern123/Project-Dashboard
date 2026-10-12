import { db } from '../db/database.js';
import type { PhaseRow } from './rows.js';
import { updateColumns } from './sql.js';

export const phasesRepo = {
  exists(id: string): boolean {
    return Boolean(db.prepare('SELECT 1 FROM phases WHERE id = ?').get(id));
  },
  find(id: string, projectId: string): PhaseRow | undefined {
    return db.prepare('SELECT * FROM phases WHERE id = ? AND project_id = ?').get(id, projectId) as
      PhaseRow | undefined;
  },
  listForProject(projectId: string): PhaseRow[] {
    return db.prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY order_index').all(projectId) as PhaseRow[];
  },
  nextOrderIndex(projectId: string): number {
    const row = db.prepare('SELECT MAX(order_index) AS m FROM phases WHERE project_id = ?').get(projectId) as {
      m: number | null;
    };
    return (row.m ?? -1) + 1;
  },
  insert(
    row: Omit<PhaseRow, 'budget' | 'weight' | 'tagged_users'> &
      Partial<Pick<PhaseRow, 'budget' | 'weight' | 'tagged_users'>>,
  ): void {
    db.prepare(
      `INSERT INTO phases (
        id, project_id, name, status, progress, weight, budget, owner, order_index,
        planned_start, planned_finish, actual_finish, work_completed, next_action,
        decision_required, tagged_users, updated_at
      ) VALUES (
        @id, @project_id, @name, @status, @progress, @weight, @budget, @owner, @order_index,
        @planned_start, @planned_finish, @actual_finish, @work_completed, @next_action,
        @decision_required, @tagged_users, @updated_at
      )`,
    ).run({ budget: null, weight: null, tagged_users: null, ...row });
  },
  update(
    id: string,
    projectId: string,
    columns: Partial<Record<keyof PhaseRow, string | number | null | undefined>>,
  ): void {
    updateColumns('phases', { id, project_id: projectId }, columns);
  },
  delete(id: string, projectId: string): boolean {
    return db.prepare('DELETE FROM phases WHERE id = ? AND project_id = ?').run(id, projectId).changes > 0;
  },
  /** Rewrites order_index as 0..n-1 in the given order. */
  setOrder(ids: string[]): void {
    const stmt = db.prepare('UPDATE phases SET order_index = ? WHERE id = ?');
    ids.forEach((id, idx) => stmt.run(idx, id));
  },
};
