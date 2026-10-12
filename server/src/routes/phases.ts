import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { fetchFullProject, parseTaggedUsers } from './projects.js';
import { broadcastNotification } from '../utils/notify.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { dispatchTagNotifications } from '../services/notifications.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';

const router = Router({ mergeParams: true });

export function recomputeProjectProgress(projectId: string): number {
  const phases = db.prepare('SELECT name, status, progress, weight, planned_start, planned_finish FROM phases WHERE project_id = ? ORDER BY order_index ASC').all(projectId) as any[];
  if (!phases || phases.length === 0) return 0;

  // Calculate durations
  const phaseDurations = phases.map((p) => {
    if (p.planned_start && p.planned_finish) {
      const d1 = new Date(p.planned_start).getTime();
      const d2 = new Date(p.planned_finish).getTime();
      if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
        return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      }
    }
    return null;
  });

  const hasExplicit = phases.some((p) => typeof p.weight === 'number' && p.weight > 0);
  const rawWeights = phases.map((p, idx) => {
    if (typeof p.weight === 'number' && p.weight > 0) return p.weight;
    if (!hasExplicit && phaseDurations[idx] !== null) return phaseDurations[idx]!;
    return 1;
  });

  const sumWeights = rawWeights.reduce((sum, w) => sum + w, 0) || 1;
  let totalWeighted = 0;
  phases.forEach((p, idx) => {
    const wPct = (rawWeights[idx] / sumWeights) * 100;
    const prog = Math.max(0, Math.min(100, Number(p.progress) || 0));
    totalWeighted += (wPct / 100) * prog;
  });

  const computed = Math.max(0, Math.min(100, Math.round(totalWeighted)));

  db.prepare('UPDATE projects SET progress = ?, last_updated = ? WHERE id = ?').run(
    computed,
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    projectId,
  );
  saveDatabaseSnapshot();
  return computed;
}

// POST add phase
router.post('/', requireAuth, requireProjectAccess(), validate({ params: S.projectParams, body: S.createPhaseBody }), async (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const project = fetchFullProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const body = req.body;
  const phaseId = body.id || `${projectId}-phase-${Date.now()}`;
  const maxOrder = db.prepare('SELECT MAX(order_index) as max_idx FROM phases WHERE project_id = ?').get(projectId) as { max_idx: number | null };
  const nextOrder = (maxOrder.max_idx ?? -1) + 1;
  const taggedUsers = Array.isArray(body.taggedUsers) ? body.taggedUsers : [];

  db.prepare(`
    INSERT INTO phases (
      id, project_id, name, status, progress, weight, budget, owner, order_index,
      planned_start, planned_finish, actual_finish, work_completed, next_action,
      decision_required, tagged_users, updated_at
    ) VALUES (
      @id, @project_id, @name, @status, @progress, @weight, @budget, @owner, @order_index,
      @planned_start, @planned_finish, @actual_finish, @work_completed, @next_action,
      @decision_required, @tagged_users, @updated_at
    )
  `).run({
    id: phaseId,
    project_id: projectId,
    name: body.name || 'New stage',
    status: body.status || 'upcoming',
    progress: body.progress || 0,
    weight: body.weight !== undefined && body.weight !== '' && body.weight !== null ? Number(body.weight) : null,
    budget: body.budget !== undefined && body.budget !== '' && body.budget !== null ? Number(body.budget) : null,
    owner: body.owner || 'PMO',
    order_index: nextOrder,
    planned_start: body.plannedStart || null,
    planned_finish: body.plannedFinish || null,
    actual_finish: body.actualFinish || null,
    work_completed: body.workCompleted || null,
    next_action: body.nextAction || null,
    decision_required: body.decisionRequired || null,
    tagged_users: JSON.stringify(taggedUsers),
    updated_at: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  });

  const origin = req.headers.origin || 'http://localhost:5173';
  const authorName = req.user?.name || body.owner || 'Project Lead';

  if (taggedUsers.length > 0) {
    await dispatchTagNotifications({
      taggedUserIds: taggedUsers,
      taggedBy: authorName,
      entityType: 'Stage',
      entityTitle: body.name || 'Stage',
      entityContext: body.nextAction || body.workCompleted || undefined,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  recomputeProjectProgress(projectId);

  const updatedProject = fetchFullProject(projectId);
  return res.status(201).json({ project: updatedProject });
});

// PATCH update phase
router.patch('/:phaseId', requireAuth, requireProjectAccess(), validate({ params: S.phaseParams, body: S.updatePhaseBody }), async (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const phaseId = req.params.phaseId as string;
  const phase = db.prepare('SELECT * FROM phases WHERE id = ? AND project_id = ?').get(phaseId, projectId) as any;
  if (!phase) return res.status(404).json({ error: 'Stage not found' });

  const project = fetchFullProject(projectId);
  const patch = req.body;
  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })];

  if (patch.name !== undefined) { updates.push('name = ?'); values.push(patch.name); }
  if (patch.status !== undefined) { updates.push('status = ?'); values.push(patch.status); }
  if (patch.progress !== undefined) { updates.push('progress = ?'); values.push(patch.progress); }
  if (patch.weight !== undefined) {
    updates.push('weight = ?');
    values.push(patch.weight === '' || patch.weight === null ? null : Number(patch.weight));
  }
  if (patch.budget !== undefined) {
    updates.push('budget = ?');
    values.push(patch.budget === '' || patch.budget === null ? null : Number(patch.budget));
  }
  if (patch.owner !== undefined) { updates.push('owner = ?'); values.push(patch.owner); }
  if (patch.plannedStart !== undefined) { updates.push('planned_start = ?'); values.push(patch.plannedStart); }
  if (patch.plannedFinish !== undefined) { updates.push('planned_finish = ?'); values.push(patch.plannedFinish); }
  if (patch.actualFinish !== undefined) { updates.push('actual_finish = ?'); values.push(patch.actualFinish); }
  if (patch.workCompleted !== undefined) { updates.push('work_completed = ?'); values.push(patch.workCompleted); }
  if (patch.nextAction !== undefined) { updates.push('next_action = ?'); values.push(patch.nextAction); }
  if (patch.decisionRequired !== undefined) {
    updates.push('decision_required = ?');
    values.push(patch.decisionRequired);

    if (patch.decisionRequired) {
      broadcastNotification(
      'system',
      
        `notif-dec-${phaseId}-${Date.now()}`,
        `Decision Needed: ${phase.name}`,
        `${req.user?.name || 'Project Lead'} requested a decision on stage "${phase.name}": ${patch.decisionRequired}`,
        projectId,
        `/project/${projectId}`
      );
    }
  }

  let newlyTaggedUsers: string[] = [];
  if (patch.taggedUsers !== undefined) {
    const updatedTagged: string[] = Array.isArray(patch.taggedUsers) ? patch.taggedUsers : [];
    const prevTagged = parseTaggedUsers(phase.tagged_users);
    newlyTaggedUsers = updatedTagged.filter((u) => !prevTagged.includes(u));

    updates.push('tagged_users = ?');
    values.push(JSON.stringify(updatedTagged));
  }

  values.push(phaseId);
  values.push(projectId);

  db.prepare(`UPDATE phases SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`).run(...values);

  const origin = req.headers.origin || 'http://localhost:5173';
  const authorName = req.user?.name || phase.owner || 'Project Lead';

  // Notify newly tagged users only when explicitly requested
  if (patch.notify && newlyTaggedUsers.length > 0 && project) {
    await dispatchTagNotifications({
      taggedUserIds: newlyTaggedUsers,
      taggedBy: authorName,
      entityType: 'Stage',
      entityTitle: patch.name || phase.name,
      entityContext: patch.nextAction || patch.workCompleted || phase.work_completed || undefined,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  recomputeProjectProgress(projectId);

  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

// DELETE remove phase
router.delete('/:phaseId', requireAuth, requireProjectAccess(), validate({ params: S.phaseParams }), (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const phaseId = req.params.phaseId as string;
  const count = db.prepare('SELECT COUNT(*) as count FROM phases WHERE project_id = ?').get(projectId) as { count: number };
  if (count.count <= 1) {
    return res.status(400).json({ error: 'A project must retain at least one stage' });
  }

  db.prepare('DELETE FROM phases WHERE id = ? AND project_id = ?').run(phaseId, projectId);

  // Re-index remaining phases sequentially
  const remaining = db.prepare('SELECT id FROM phases WHERE project_id = ? ORDER BY order_index ASC').all(projectId) as any[];
  const reindexTx = db.transaction(() => {
    remaining.forEach((ph, idx) => {
      db.prepare('UPDATE phases SET order_index = ? WHERE id = ?').run(idx, ph.id);
    });
  });
  reindexTx();

  recomputeProjectProgress(projectId);

  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

// POST move phase order
router.post('/move', requireAuth, requireProjectAccess(), validate({ params: S.projectParams, body: S.movePhaseBody }), (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const { phaseIndex, direction } = req.body;

  const phases = db.prepare('SELECT * FROM phases WHERE project_id = ? ORDER BY order_index ASC').all(projectId) as any[];
  const targetIndex = phaseIndex + direction;

  if (phaseIndex < 0 || phaseIndex >= phases.length || targetIndex < 0 || targetIndex >= phases.length) {
    return res.status(400).json({ error: 'Invalid move target' });
  }

  const p1 = phases[phaseIndex];
  const p2 = phases[targetIndex];

  db.transaction(() => {
    db.prepare('UPDATE phases SET order_index = ? WHERE id = ?').run(targetIndex, p1.id);
    db.prepare('UPDATE phases SET order_index = ? WHERE id = ?').run(phaseIndex, p2.id);
  })();

  recomputeProjectProgress(projectId);

  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

export default router;
