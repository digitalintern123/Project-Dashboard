import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { fetchFullProject, parseTaggedUsers } from './projects.js';
import { broadcastNotification } from '../utils/notify.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { dispatchTagNotifications, dispatchMilestoneApprovalAlert } from '../services/notifications.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';

const router = Router({ mergeParams: true });

// POST add milestone
router.post('/', requireAuth, requireProjectAccess(), validate({ params: S.projectParams, body: S.createMilestoneBody }), async (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const project = fetchFullProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const body = req.body;
  const milestoneId = body.id || `${projectId}-milestone-${Date.now()}`;
  const maxOrder = db.prepare('SELECT MAX(order_index) as max_idx FROM milestones WHERE project_id = ?').get(projectId) as { max_idx: number | null };
  const nextOrder = (maxOrder.max_idx ?? -1) + 1;
  const taggedUsers = Array.isArray(body.taggedUsers) ? body.taggedUsers : [];

  db.prepare(`
    INSERT INTO milestones (
      id, project_id, title, date, status, stage, owner,
      approval_required, approval_status, completed_date, tagged_users, order_index
    ) VALUES (
      @id, @project_id, @title, @date, @status, @stage, @owner,
      @approval_required, @approval_status, @completed_date, @tagged_users, @order_index
    )
  `).run({
    id: milestoneId,
    project_id: projectId,
    title: body.title,
    date: body.date,
    status: body.status || 'upcoming',
    stage: body.stage || null,
    owner: body.owner || 'Project Lead',
    approval_required: body.approvalRequired ? 1 : 0,
    approval_status: body.approvalStatus || (body.approvalRequired ? 'Pending' : 'Not required'),
    completed_date: body.completedDate || null,
    tagged_users: JSON.stringify(taggedUsers),
    order_index: nextOrder,
  });

  const origin = req.headers.origin || 'http://localhost:5173';
  const authorName = req.user?.name || body.owner || 'Project Lead';

  // 1. Notify tagged users
  if (taggedUsers.length > 0) {
    await dispatchTagNotifications({
      taggedUserIds: taggedUsers,
      taggedBy: authorName,
      entityType: 'Milestone',
      entityTitle: body.title,
      entityContext: `Target date: ${body.date}${body.stage ? ` • Stage: ${body.stage}` : ''}`,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  // 2. If requires approval, alert Coordinator
  if (body.approvalRequired) {
    broadcastNotification(
      'approval_required',
      
      `notif-appr-${milestoneId}`,
      `Approval Requested: ${body.title}`,
      `${project.name} requires milestone approval from Coordinator.`,
      projectId,
      `/project/${projectId}`
    );

    await dispatchMilestoneApprovalAlert({
      milestoneTitle: body.title,
      targetDate: body.date,
      stage: body.stage,
      requestedBy: authorName,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  saveDatabaseSnapshot();

  const updatedProject = fetchFullProject(projectId);
  return res.status(201).json({ project: updatedProject });
});

// PATCH update milestone
router.patch('/:milestoneId', requireAuth, requireProjectAccess(), validate({ params: S.milestoneParams, body: S.updateMilestoneBody }), async (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const milestoneId = req.params.milestoneId as string;
  const milestone = db.prepare('SELECT * FROM milestones WHERE id = ? AND project_id = ?').get(milestoneId, projectId) as any;
  if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

  const project = fetchFullProject(projectId);
  const patch = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (patch.title !== undefined) { updates.push('title = ?'); values.push(patch.title); }
  if (patch.date !== undefined) { updates.push('date = ?'); values.push(patch.date); }
  if (patch.status !== undefined) { updates.push('status = ?'); values.push(patch.status); }
  if (patch.stage !== undefined) { updates.push('stage = ?'); values.push(patch.stage); }
  if (patch.owner !== undefined) { updates.push('owner = ?'); values.push(patch.owner); }
  if (patch.approvalRequired !== undefined) { updates.push('approval_required = ?'); values.push(patch.approvalRequired ? 1 : 0); }
  if (patch.approvalStatus !== undefined) {
    if (req.user && req.user.role !== 'coordinator') {
      return res.status(403).json({ error: 'Only Project Coordinators can approve or reject milestones' });
    }
    updates.push('approval_status = ?');
    values.push(patch.approvalStatus);
  }
  if (patch.completedDate !== undefined) { updates.push('completed_date = ?'); values.push(patch.completedDate); }

  let newlyTaggedUsers: string[] = [];
  if (patch.taggedUsers !== undefined) {
    const updatedTagged: string[] = Array.isArray(patch.taggedUsers) ? patch.taggedUsers : [];
    const prevTagged = parseTaggedUsers(milestone.tagged_users);
    newlyTaggedUsers = updatedTagged.filter((u) => !prevTagged.includes(u));

    updates.push('tagged_users = ?');
    values.push(JSON.stringify(updatedTagged));
  }

  if (updates.length > 0) {
    values.push(milestoneId);
    values.push(projectId);
    db.prepare(`UPDATE milestones SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`).run(...values);
  }

  const origin = req.headers.origin || 'http://localhost:5173';
  const authorName = req.user?.name || milestone.owner || 'Project Lead';

  // Notify newly tagged users only when explicitly requested
  if (patch.notify && newlyTaggedUsers.length > 0 && project) {
    await dispatchTagNotifications({
      taggedUserIds: newlyTaggedUsers,
      taggedBy: authorName,
      entityType: 'Milestone',
      entityTitle: patch.title || milestone.title,
      entityContext: `Target date: ${patch.date || milestone.date}`,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  saveDatabaseSnapshot();

  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

// DELETE milestone
router.delete('/:milestoneId', requireAuth, requireProjectAccess(), validate({ params: S.milestoneParams }), (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const milestoneId = req.params.milestoneId as string;
  db.prepare('DELETE FROM milestones WHERE id = ? AND project_id = ?').run(milestoneId, projectId);
  saveDatabaseSnapshot();
  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

export default router;
