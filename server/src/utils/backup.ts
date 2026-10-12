import fs from 'node:fs';
import path from 'node:path';
import { db, dataDir } from '../db/database.js';

/**
 * Disaster Recovery & Export Backup Snapshot.
 * NOTE: The SQLite database (`encalm.db`) is the live single source of truth.
 * This JSON file is an asynchronous point-in-time snapshot for cold-start recovery or manual exports.
 */
export const SNAPSHOT_FILE_PATH = path.join(dataDir, 'portfolio-database.json');

function parseTaggedUsers(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Fetch full project tree for a given project ID directly from database.
 */
export function getFullProjectRecord(projectId: string) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
  if (!row) return null;

  const phases = db.prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY order_index ASC').all(projectId) as any[];
  const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY order_index ASC, date ASC').all(projectId) as any[];
  const issues = db.prepare('SELECT * FROM issues WHERE project_id = ? ORDER BY order_index ASC, id DESC').all(projectId) as any[];
  const updates = db.prepare('SELECT * FROM updates WHERE project_id = ? ORDER BY created_at DESC').all(projectId) as any[];
  const photos = db.prepare('SELECT * FROM photos WHERE project_id = ? ORDER BY taken_date DESC, created_at DESC').all(projectId) as any[];

  return {
    id: row.id,
    name: row.name,
    location: row.location,
    category: row.category,
    code: row.code,
    health: row.health,
    status: row.status || 'Yet to start',
    progress: row.progress,
    targetDate: row.target_date,
    targetLabel: row.target_label,
    aop: row.aop,
    awarded: row.awarded,
    spent: row.spent,
    projectedCost: row.projected_cost ?? 0,
    area: row.area || undefined,
    paxKeys: row.pax_keys || undefined,
    nextMilestone: row.next_milestone,
    nextMilestoneDate: row.next_milestone_date,
    leadId: row.lead_id,
    startDate: row.start_date,
    lastUpdated: row.last_updated,
    templateId: row.template_id,
    specification: row.specification_json ? JSON.parse(row.specification_json) : undefined,
    phases: phases.map((ph) => ({
      id: ph.id,
      name: ph.name,
      status: ph.status,
      progress: ph.progress,
      owner: ph.owner,
      plannedStart: ph.planned_start,
      plannedFinish: ph.planned_finish,
      actualFinish: ph.actual_finish,
      workCompleted: ph.work_completed,
      nextAction: ph.next_action,
      decisionRequired: ph.decision_required,
      weight: ph.weight ?? null,
      taggedUsers: parseTaggedUsers(ph.tagged_users),
      updatedAt: ph.updated_at,
    })),
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.date,
      status: m.status,
      stage: m.stage,
      owner: m.owner,
      approvalRequired: Boolean(m.approval_required),
      approvalStatus: m.approval_status,
      completedDate: m.completed_date,
      taggedUsers: parseTaggedUsers(m.tagged_users),
    })),
    issues: issues.map((i) => ({
      id: i.id,
      title: i.title,
      detail: i.detail,
      severity: i.severity,
      owner: i.owner,
      category: i.category,
      status: i.status,
      stage: i.stage,
      dateRaised: i.date_raised,
      dueDate: i.due_date,
      impactCost: i.impact_cost,
      impactSchedule: i.impact_schedule,
      impactScope: i.impact_scope,
      action: i.action,
      resolution: i.resolution,
      taggedUsers: parseTaggedUsers(i.tagged_users),
    })),
    updates: updates.map((u) => ({
      id: u.id,
      date: u.date,
      author: u.author,
      role: u.role,
      text: u.text,
      stage: u.stage,
      kind: u.kind,
    })),
    photos: photos.map((p) => ({
      id: p.id,
      projectId: p.project_id,
      url: p.url,
      thumbnailUrl: p.thumbnail_url || undefined,
      caption: p.caption,
      stage: p.stage,
      category: p.category,
      takenDate: p.taken_date,
      uploadedBy: p.uploaded_by,
      role: p.role,
      fileSize: p.file_size,
      createdAt: p.created_at,
    })),
  };
}

/**
 * Saves a complete snapshot of all projects to disk as formatted JSON.
 */
export function saveDatabaseSnapshot(): void {
  try {
    const rows = db.prepare('SELECT id FROM projects ORDER BY name ASC').all() as { id: string }[];
    const projects = rows.map((r) => getFullProjectRecord(r.id)).filter(Boolean);

    const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100').all();

    const snapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projectCount: projects.length,
      projects,
      notifications,
    };

    fs.writeFileSync(SNAPSHOT_FILE_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[Backup] Saved snapshot with ${projects.length} projects to ${SNAPSHOT_FILE_PATH}`);
  } catch (err) {
    console.warn('[Backup] Failed to save snapshot:', err);
  }
}

/**
 * Restores projects into SQLite from a JSON payload (or backup file).
 */
export function restoreDatabaseFromJSON(data: { projects?: any[]; notifications?: any[] }): { success: boolean; count: number } {
  const projects = Array.isArray(data.projects) ? data.projects : [];
  if (projects.length === 0) {
    return { success: true, count: 0 };
  }

  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects (
      id, name, location, category, code, health, status, progress, target_date, target_label,
      aop, awarded, spent, projected_cost, area, pax_keys, next_milestone, next_milestone_date, lead_id, start_date,
      last_updated, specification_json, template_id
    ) VALUES (
      @id, @name, @location, @category, @code, @health, @status, @progress, @target_date, @target_label,
      @aop, @awarded, @spent, @projected_cost, @area, @pax_keys, @next_milestone, @next_milestone_date, @lead_id, @start_date,
      @last_updated, @specification_json, @template_id
    )
  `);

  const insertPhase = db.prepare(`
    INSERT OR REPLACE INTO phases (
      id, project_id, name, status, progress, weight, owner, order_index,
      planned_start, planned_finish, actual_finish, work_completed, next_action, decision_required, tagged_users, updated_at
    ) VALUES (
      @id, @project_id, @name, @status, @progress, @weight, @owner, @order_index,
      @planned_start, @planned_finish, @actual_finish, @work_completed, @next_action, @decision_required, @tagged_users, @updated_at
    )
  `);

  const insertMilestone = db.prepare(`
    INSERT OR REPLACE INTO milestones (
      id, project_id, title, date, status, stage, owner,
      approval_required, approval_status, completed_date, tagged_users, order_index
    ) VALUES (
      @id, @project_id, @title, @date, @status, @stage, @owner,
      @approval_required, @approval_status, @completed_date, @tagged_users, @order_index
    )
  `);

  const insertIssue = db.prepare(`
    INSERT OR REPLACE INTO issues (
      id, project_id, title, detail, severity, owner, category, status,
      stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
      action, resolution, tagged_users, order_index
    ) VALUES (
      @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
      @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
      @action, @resolution, @tagged_users, @order_index
    )
  `);

  const insertUpdate = db.prepare(`
    INSERT OR REPLACE INTO updates (
      id, project_id, date, author, role, text, stage, kind
    ) VALUES (
      @id, @project_id, @date, @author, @role, @text, @stage, @kind
    )
  `);

  const insertPhoto = db.prepare(`
    INSERT OR REPLACE INTO photos (
      id, project_id, url, thumbnail_url, caption, stage, category, taken_date, uploaded_by, role, file_size, created_at
    ) VALUES (
      @id, @project_id, @url, @thumbnail_url, @caption, @stage, @category, @taken_date, @uploaded_by, @role, @file_size, @created_at
    )
  `);

  const tx = db.transaction(() => {
    for (const p of projects) {
      insertProject.run({
        id: p.id,
        name: p.name,
        location: p.location || 'Delhi',
        category: p.category || 'Airport Lounge',
        code: p.code || 'ENC-PRJ',
        health: p.health || 'On track',
        status: p.status || 'Yet to start',
        progress: Number(p.progress) || 0,
        target_date: p.targetDate || '',
        target_label: p.targetLabel || p.targetDate || '',
        aop: Number(p.aop) || 0,
        awarded: Number(p.awarded) || 0,
        spent: Number(p.spent) || 0,
        projected_cost: Number(p.projectedCost ?? p.projected_cost ?? p.aop ?? 0),
        area: p.area || p.specification?.area || null,
        pax_keys: p.paxKeys || p.pax_keys || p.specification?.capacity || null,
        next_milestone: p.nextMilestone || 'Project brief',
        next_milestone_date: p.nextMilestoneDate || p.startDate || '',
        lead_id: p.leadId || 'user-lead-1',
        start_date: p.startDate || null,
        last_updated: p.lastUpdated || new Date().toLocaleDateString('en-GB'),
        specification_json: p.specification ? JSON.stringify(p.specification) : null,
        template_id: p.templateId || null,
      });

      // Clear existing project sub-items to avoid duplicates on replace
      db.prepare('DELETE FROM phases WHERE project_id = ?').run(p.id);
      db.prepare('DELETE FROM milestones WHERE project_id = ?').run(p.id);
      db.prepare('DELETE FROM issues WHERE project_id = ?').run(p.id);
      db.prepare('DELETE FROM updates WHERE project_id = ?').run(p.id);
      db.prepare('DELETE FROM photos WHERE project_id = ?').run(p.id);

      if (Array.isArray(p.phases)) {
        p.phases.forEach((ph: any, idx: number) => {
          insertPhase.run({
            id: ph.id || `${p.id}-phase-${idx}`,
            project_id: p.id,
            name: ph.name,
            status: ph.status || 'upcoming',
            progress: Number(ph.progress) || 0,
            weight: ph.weight || null,
            owner: ph.owner || 'PMO',
            order_index: idx,
            planned_start: ph.plannedStart || ph.planned_start || null,
            planned_finish: ph.plannedFinish || ph.planned_finish || null,
            actual_finish: ph.actualFinish || ph.actual_finish || null,
            work_completed: ph.workCompleted || ph.work_completed || null,
            next_action: ph.nextAction || ph.next_action || null,
            decision_required: ph.decisionRequired || ph.decision_required || null,
            tagged_users: JSON.stringify(parseTaggedUsers(ph.taggedUsers || ph.tagged_users)),
            updated_at: ph.updatedAt || ph.updated_at || null,
          });
        });
      }

      if (Array.isArray(p.milestones)) {
        p.milestones.forEach((m: any, idx: number) => {
          insertMilestone.run({
            id: m.id || `${p.id}-milestone-${idx}`,
            project_id: p.id,
            title: m.title,
            date: m.date,
            status: m.status || 'upcoming',
            stage: m.stage || null,
            owner: m.owner || null,
            approval_required: m.approvalRequired ? 1 : 0,
            approval_status: m.approvalStatus || 'Not required',
            completed_date: m.completedDate || m.completed_date || null,
            tagged_users: JSON.stringify(parseTaggedUsers(m.taggedUsers || m.tagged_users)),
            order_index: idx,
          });
        });
      }

      if (Array.isArray(p.issues)) {
        p.issues.forEach((iss: any, idx: number) => {
          insertIssue.run({
            id: iss.id || `${p.id}-issue-${idx}`,
            project_id: p.id,
            title: iss.title,
            detail: iss.detail,
            severity: iss.severity || 'Medium',
            owner: iss.owner || 'Project Lead',
            category: iss.category || 'Other',
            status: iss.status || 'Open',
            stage: iss.stage || null,
            date_raised: iss.dateRaised || iss.date_raised || new Date().toLocaleDateString('en-GB'),
            due_date: iss.dueDate || iss.due_date || null,
            impact_cost: iss.impactCost || iss.impact_cost || null,
            impact_schedule: iss.impactSchedule || iss.impact_schedule || null,
            impact_scope: iss.impactScope || iss.impact_scope || null,
            action: iss.action || null,
            resolution: iss.resolution || null,
            tagged_users: JSON.stringify(parseTaggedUsers(iss.taggedUsers || iss.tagged_users)),
            order_index: idx,
          });
        });
      }

      if (Array.isArray(p.updates)) {
        p.updates.forEach((u: any, idx: number) => {
          insertUpdate.run({
            id: u.id || `${p.id}-update-${idx}`,
            project_id: p.id,
            date: u.date || new Date().toLocaleDateString('en-GB'),
            author: u.author || 'Project Lead',
            role: u.role || 'Project Lead',
            text: u.text,
            stage: u.stage || null,
            kind: u.kind || 'General',
          });
        });
      }

      if (Array.isArray(p.photos)) {
        p.photos.forEach((ph: any, idx: number) => {
          insertPhoto.run({
            id: ph.id || `${p.id}-photo-${idx}`,
            project_id: p.id,
            url: ph.url,
            thumbnail_url: ph.thumbnailUrl || ph.thumbnail_url || null,
            caption: ph.caption || '',
            stage: ph.stage || null,
            category: ph.category || 'Progress',
            taken_date: ph.takenDate || ph.taken_date || null,
            uploaded_by: ph.uploadedBy || ph.uploaded_by || 'PMO',
            role: ph.role || 'Lead',
            file_size: ph.fileSize || ph.file_size || null,
            created_at: ph.createdAt || ph.created_at || new Date().toISOString(),
          });
        });
      }
    }
  });

  tx();
  saveDatabaseSnapshot();
  return { success: true, count: projects.length };
}

/**
 * On server boot, if the database has fewer than 68 projects, automatically restores from snapshot.
 */
export function autoRestoreSnapshotIfEmpty(): void {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
    if (row && row.count < 68) {
      if (fs.existsSync(SNAPSHOT_FILE_PATH)) {
        const raw = fs.readFileSync(SNAPSHOT_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.projects) && data.projects.length >= 68) {
          console.log(`[Auto-Restore] SQLite database has ${row.count} projects (< 68). Auto-restoring ${data.projects.length} authentic facilities from ${SNAPSHOT_FILE_PATH}...`);
          restoreDatabaseFromJSON(data);
          console.log(`[Auto-Restore] Successfully restored full portfolio with ${data.projects.length} projects!`);
        }
      }
    }
  } catch (err) {
    console.warn('[Auto-Restore] Check failed:', err);
  }
}
