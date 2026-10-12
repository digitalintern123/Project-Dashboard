import { db } from '../db/database.js';
import type { IssueRow, MilestoneRow, PhaseRow, PhotoRow, ProjectRow, UpdateRow } from './rows.js';
import { groupByProject, placeholders, updateColumns } from './sql.js';

export type ProjectChildren = {
  phases: PhaseRow[];
  milestones: MilestoneRow[];
  issues: IssueRow[];
  updates: UpdateRow[];
  photos: PhotoRow[];
};

export const projectsRepo = {
  find(id: string): ProjectRow | undefined {
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  },

  exists(id: string): boolean {
    return Boolean(db.prepare('SELECT 1 FROM projects WHERE id = ?').get(id));
  },

  count(): number {
    return (db.prepare('SELECT COUNT(*) AS c FROM projects').get() as { c: number }).c;
  },

  /** All projects: open ones first, then by risk, progress and name. */
  listOrdered(): ProjectRow[] {
    return db
      .prepare(
        `SELECT * FROM projects
         ORDER BY
           CASE WHEN (status != 'Operational' AND COALESCE(progress, 0) < 100) THEN 0 ELSE 1 END,
           CASE health WHEN 'Delayed' THEN 0 WHEN 'At risk' THEN 1 WHEN 'On track' THEN 2 ELSE 3 END,
           COALESCE(progress, 0),
           name`,
      )
      .all() as ProjectRow[];
  },

  /** Child rows for many projects in five queries, whatever the number of projects. */
  childrenFor(projectIds: string[]): Map<string, ProjectChildren> {
    const result = new Map<string, ProjectChildren>();
    for (const id of projectIds) result.set(id, { phases: [], milestones: [], issues: [], updates: [], photos: [] });
    if (projectIds.length === 0) return result;

    const inList = placeholders(projectIds.length);
    const load = <T extends { project_id: string }>(sql: string) =>
      groupByProject(db.prepare(sql.replace('(:ids)', `(${inList})`)).all(...projectIds) as T[]);

    const phases = load<PhaseRow>('SELECT * FROM phases WHERE project_id IN (:ids) ORDER BY order_index');
    const milestones = load<MilestoneRow>(
      'SELECT * FROM milestones WHERE project_id IN (:ids) ORDER BY order_index, date',
    );
    const issues = load<IssueRow>('SELECT * FROM issues WHERE project_id IN (:ids) ORDER BY order_index, id DESC');
    const updates = load<UpdateRow>(
      'SELECT * FROM updates WHERE project_id IN (:ids) ORDER BY created_at DESC, rowid DESC',
    );
    const photos = load<PhotoRow>(
      'SELECT * FROM photos WHERE project_id IN (:ids) ORDER BY taken_date DESC, created_at DESC',
    );

    for (const [id, children] of result) {
      children.phases = phases.get(id) ?? [];
      children.milestones = milestones.get(id) ?? [];
      children.issues = issues.get(id) ?? [];
      children.updates = updates.get(id) ?? [];
      children.photos = photos.get(id) ?? [];
    }
    return result;
  },

  insert(row: Omit<ProjectRow, 'created_at'>): void {
    db.prepare(
      `INSERT INTO projects (
        id, name, location, category, code, health, status, progress, target_date, target_label,
        aop, awarded, spent, projected_cost, area, pax_keys, next_milestone, next_milestone_date, lead_id, start_date,
        last_updated, specification_json, template_id
      ) VALUES (
        @id, @name, @location, @category, @code, @health, @status, @progress, @target_date, @target_label,
        @aop, @awarded, @spent, @projected_cost, @area, @pax_keys, @next_milestone, @next_milestone_date, @lead_id, @start_date,
        @last_updated, @specification_json, @template_id
      )`,
    ).run(row);
  },

  update(id: string, columns: Partial<Record<keyof ProjectRow, string | number | null | undefined>>): void {
    updateColumns('projects', { id }, columns);
  },

  /** Deletes the project with its photos and notifications (other children cascade). */
  delete(id: string): boolean {
    db.prepare('DELETE FROM photos WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM notifications WHERE project_id = ?').run(id);
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
  },
};
