import { Router } from 'express';
import { db } from '../db/database.js';
import { removePhotoFiles } from './photos.js';
import { requireAuth, requireRole, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { calculateProjectStatus } from '../utils/status.js';
import { broadcastNotification } from '../utils/notify.js';
import { saveDatabaseSnapshot, restoreDatabaseFromJSON } from '../utils/backup.js';

const router = Router();

export function parseTaggedUsers(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function fetchFullProject(projectId: string) {
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
      budget: ph.budget != null ? Number(ph.budget) : undefined,
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
    issues: issues.map((iss) => ({
      id: iss.id,
      title: iss.title,
      detail: iss.detail,
      severity: iss.severity,
      owner: iss.owner,
      category: iss.category,
      status: iss.status,
      stage: iss.stage,
      dateRaised: iss.date_raised,
      dueDate: iss.due_date,
      issueAriseDate: iss.date_raised,
      targetClosureDate: iss.due_date,
      impactCost: iss.impact_cost,
      impactSchedule: iss.impact_schedule,
      impactScope: iss.impact_scope,
      action: iss.action,
      resolution: iss.resolution,
      taggedUsers: parseTaggedUsers(iss.tagged_users),
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

// GET all projects
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id FROM projects 
    ORDER BY 
      CASE WHEN (status != 'Operational' AND COALESCE(progress, 0) < 100) THEN 0 ELSE 1 END ASC,
      CASE health 
        WHEN 'Delayed' THEN 0 
        WHEN 'At risk' THEN 1 
        WHEN 'On track' THEN 2 
        ELSE 3 
      END ASC,
      COALESCE(progress, 0) ASC,
      name ASC
  `).all() as { id: string }[];
  const projects = rows.map((r) => fetchFullProject(r.id)).filter(Boolean);
  return res.json({ projects });
});

// GET single project
router.get('/:id', requireAuth, (req, res) => {
  const id = req.params.id as string;
  const project = fetchFullProject(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  return res.json({ project });
});

// POST bulk sync projects from client cache or external source
router.post('/sync', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
  const { projects, explicit } = req.body;

  // Protect clean database state from being contaminated by stale browser local caches
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  if (currentCount.count === 0 && !explicit) {
    console.warn('[Sync Guard] Blocked automatic client sync from resurrecting projects into empty database.');
    return res.json({ success: true, count: 0, message: 'Database is empty; automatic sync bypassed to protect clean state.' });
  }

  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: 'Invalid payload: projects array is required' });
  }

  const result = restoreDatabaseFromJSON({ projects });
  return res.json({ success: true, count: result.count, message: `Synced ${result.count} projects successfully` });
});

// POST create project
router.post('/', requireAuth, requireRole(['coordinator', 'lead']), (req: AuthenticatedRequest, res) => {
  const body = req.body;
  if (!body.name || !body.location || !body.category) {
    return res.status(400).json({ error: 'Name, location, and category are required' });
  }

  const id = body.id || `${body.location.toLowerCase()}-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
  
  const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (existing) {
    return res.status(409).json({ error: 'Project with this ID already exists' });
  }

  const code = body.code || `${body.location.slice(0, 3).toUpperCase()}-NEW-${new Date().getFullYear() % 100}`;
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const insertProject = db.prepare(`
    INSERT INTO projects (
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
    INSERT INTO phases (
      id, project_id, name, status, progress, weight, owner, order_index
    ) VALUES (
      @id, @project_id, @name, @status, @progress, @weight, @owner, @order_index
    )
  `);

  const transaction = db.transaction(() => {
    const defaultPhases = Array.isArray(body.phases) && body.phases.length > 0 ? body.phases : [
      { name: 'Brief & scope', status: 'active', progress: 0, owner: 'PMO' },
      { name: 'Design development', status: 'upcoming', progress: 0, owner: 'Design' },
      { name: 'Procurement', status: 'upcoming', progress: 0, owner: 'Sourcing' },
      { name: 'Execution', status: 'upcoming', progress: 0, owner: 'Projects' },
      { name: 'Handover', status: 'upcoming', progress: 0, owner: 'Operations' },
    ];
    const initialProgress = Number(body.progress) || 0;
    const resolvedStatus = body.status || calculateProjectStatus(initialProgress, defaultPhases);

    insertProject.run({
      id,
      name: body.name,
      location: body.location,
      category: body.category,
      code,
      health: body.health || (initialProgress > 0 ? 'On track' : 'Not started'),
      status: resolvedStatus,
      progress: initialProgress,
      target_date: body.targetDate || '',
      target_label: body.targetLabel || body.targetDate || '',
      aop: body.aop || 0,
      awarded: body.awarded || 0,
      spent: body.spent || 0,
      projected_cost: body.projectedCost ?? body.projected_cost ?? body.aop ?? 0,
      area: body.area || body.specification?.area || null,
      pax_keys: body.paxKeys || body.pax_keys || body.specification?.capacity || null,
      next_milestone: body.nextMilestone || 'Project brief',
      next_milestone_date: body.nextMilestoneDate || body.startDate || '',
      lead_id: body.leadId || req.user?.id || 'user-chinmay-saxena',
      start_date: body.startDate || null,
      last_updated: todayFormatted,
      specification_json: body.specification ? JSON.stringify(body.specification) : null,
      template_id: body.templateId || null,
    });

    defaultPhases.forEach((ph: any, idx: number) => {
      insertPhase.run({
        id: ph.id || `${id}-phase-${idx}`,
        project_id: id,
        name: ph.name,
        status: ph.status || 'upcoming',
        progress: ph.progress || 0,
        weight: ph.weight || null,
        owner: ph.owner || 'PMO',
        order_index: idx,
      });
    });

    if (Array.isArray(body.milestones) && body.milestones.length > 0) {
      const insertMilestone = db.prepare(`
        INSERT INTO milestones (
          id, project_id, title, date, status, stage, owner,
          approval_required, approval_status, completed_date, order_index
        ) VALUES (
          @id, @project_id, @title, @date, @status, @stage, @owner,
          @approval_required, @approval_status, @completed_date, @order_index
        )
      `);
      body.milestones.forEach((m: any, idx: number) => {
        insertMilestone.run({
          id: m.id || `${id}-milestone-${idx}`,
          project_id: id,
          title: m.title,
          date: m.date,
          status: m.status || 'upcoming',
          stage: m.stage || null,
          owner: m.owner || null,
          approval_required: m.approvalRequired ? 1 : 0,
          approval_status: m.approvalStatus || (m.approvalRequired ? 'Pending' : 'Not required'),
          completed_date: m.completedDate || null,
          order_index: idx,
        });
      });
    }

    if (Array.isArray(body.issues) && body.issues.length > 0) {
      const insertIssue = db.prepare(`
        INSERT INTO issues (
          id, project_id, title, detail, severity, owner, category, status,
          stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
          action, resolution, order_index
        ) VALUES (
          @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
          @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
          @action, @resolution, @order_index
        )
      `);
      body.issues.forEach((iss: any, idx: number) => {
        insertIssue.run({
          id: iss.id || `${id}-issue-${idx}`,
          project_id: id,
          title: iss.title,
          detail: iss.detail,
          severity: iss.severity || 'Medium',
          owner: iss.owner || req.user!.name,
          category: iss.category || 'Other',
          status: iss.status || 'Open',
          stage: iss.stage || null,
          date_raised: iss.issueAriseDate || iss.dateRaised || todayFormatted,
          due_date: iss.targetClosureDate || iss.dueDate || null,
          impact_cost: iss.impactCost || null,
          impact_schedule: iss.impactSchedule || null,
          impact_scope: iss.impactScope || null,
          action: iss.action || null,
          resolution: iss.resolution || null,
          order_index: idx,
        });
      });
    }

    // Notify about new project
    broadcastNotification(
      'system',
      
      `notif-create-${id}`,
      `New Project Created: ${body.name}`,
      `${body.name} was added to the portfolio by ${req.user?.name || 'Project Lead'}.`,
      id,
      `/project/${id}`
    );
  });

  transaction();
  saveDatabaseSnapshot();

  const created = fetchFullProject(id);
  return res.status(201).json({ project: created });
});

// PATCH allot project (Coordinator only)
router.patch('/:id/allot', requireAuth, requireRole(['coordinator']), (req: AuthenticatedRequest, res) => {
  const id = req.params.id as string;
  const { leadId } = req.body;
  if (!leadId) {
    return res.status(400).json({ error: 'leadId is required' });
  }

  // Validate lead exists and has role 'lead'
  const lead = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(leadId, 'lead') as any;
  if (!lead) {
    return res.status(400).json({ error: 'Selected lead does not exist or is not a project lead' });
  }

  const project = fetchFullProject(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  db.prepare('UPDATE projects SET lead_id = ?, last_updated = ? WHERE id = ?').run(
    leadId,
    todayFormatted,
    id
  );

  // Add notification
  broadcastNotification(
      'system',
      
    `notif-allot-${id}-${Date.now()}`,
    `Project Allotted: ${project.name}`,
    `${project.name} has been assigned to ${lead.name} by ${req.user?.name || 'Coordinator'}.`,
    id,
    `/project/${id}`
  );

  saveDatabaseSnapshot();

  const updated = fetchFullProject(id);
  return res.json({ project: updated });
});

// PATCH update project
router.patch('/:id', requireAuth, requireProjectAccess(), (req: AuthenticatedRequest, res) => {
  const id = req.params.id as string;
  const project = fetchFullProject(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const patch = req.body;
  if (patch.leadId !== undefined && patch.leadId !== project.leadId && req.user!.role !== 'coordinator') {
    return res.status(403).json({ error: 'Forbidden: Only the coordinator can reassign a project lead' });
  }
  const todayFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const updates: string[] = ['last_updated = ?'];
  const values: any[] = [todayFormatted];

  if (patch.name !== undefined) { updates.push('name = ?'); values.push(patch.name); }
  if (patch.code !== undefined) { updates.push('code = ?'); values.push(patch.code); }
  if (patch.location !== undefined) { updates.push('location = ?'); values.push(patch.location); }
  if (patch.category !== undefined) { updates.push('category = ?'); values.push(patch.category); }
  if (patch.health !== undefined) { updates.push('health = ?'); values.push(patch.health); }
  if (patch.status !== undefined) { updates.push('status = ?'); values.push(patch.status); }
  if (patch.startDate !== undefined) { updates.push('start_date = ?'); values.push(patch.startDate); }
  if (patch.progress !== undefined) {
    const newProgress = Math.max(0, Math.min(100, Number(patch.progress) || 0));
    updates.push('progress = ?');
    values.push(newProgress);
    if (patch.status === undefined) {
      const computedStatus = calculateProjectStatus(newProgress, project.phases, project.status);
      updates.push('status = ?');
      values.push(computedStatus);
    }
  }
  if (patch.targetDate !== undefined) { updates.push('target_date = ?'); values.push(patch.targetDate); }
  if (patch.targetLabel !== undefined) { updates.push('target_label = ?'); values.push(patch.targetLabel); }
  if (patch.aop !== undefined) { updates.push('aop = ?'); values.push(patch.aop); }
  if (patch.awarded !== undefined) { updates.push('awarded = ?'); values.push(patch.awarded); }
  if (patch.spent !== undefined) { updates.push('spent = ?'); values.push(patch.spent); }
  if (patch.projectedCost !== undefined) { updates.push('projected_cost = ?'); values.push(patch.projectedCost); }
  else if (patch.projected_cost !== undefined) { updates.push('projected_cost = ?'); values.push(patch.projected_cost); }
  if (patch.area !== undefined) { updates.push('area = ?'); values.push(patch.area); }
  if (patch.paxKeys !== undefined) { updates.push('pax_keys = ?'); values.push(patch.paxKeys); }
  else if (patch.pax_keys !== undefined) { updates.push('pax_keys = ?'); values.push(patch.pax_keys); }
  if (patch.nextMilestone !== undefined) { updates.push('next_milestone = ?'); values.push(patch.nextMilestone); }
  if (patch.nextMilestoneDate !== undefined) { updates.push('next_milestone_date = ?'); values.push(patch.nextMilestoneDate); }
  if (patch.leadId !== undefined) { updates.push('lead_id = ?'); values.push(patch.leadId); }
  if (patch.specification !== undefined) { updates.push('specification_json = ?'); values.push(JSON.stringify(patch.specification)); }

  values.push(id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  if (Array.isArray(patch.phases)) {
    for (const ph of patch.phases) {
      if (ph.id) {
        const phUpdates: string[] = [];
        const phValues: any[] = [];
        if (ph.budget !== undefined) {
          phUpdates.push('budget = ?');
          phValues.push(ph.budget === '' || ph.budget === null ? null : Number(ph.budget));
        }
        if (phUpdates.length > 0) {
          phValues.push(ph.id);
          phValues.push(id);
          db.prepare(`UPDATE phases SET ${phUpdates.join(', ')} WHERE id = ? AND project_id = ?`).run(...phValues);
        }
      }
    }
  }

  saveDatabaseSnapshot();

  const updated = fetchFullProject(id);
  return res.json({ project: updated });
});

// DELETE project
router.delete('/:id', requireAuth, requireRole(['coordinator']), (req, res) => {
  const id = req.params.id as string;

  const projectPhotos = db.prepare('SELECT url, thumbnail_url FROM photos WHERE project_id = ?').all(id) as { url: string; thumbnail_url: string | null }[];

  db.prepare('DELETE FROM photos WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM notifications WHERE project_id = ?').run(id);
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }
  projectPhotos.forEach(removePhotoFiles);
  saveDatabaseSnapshot();
  return res.json({ message: 'Project deleted successfully' });
});

export default router;
