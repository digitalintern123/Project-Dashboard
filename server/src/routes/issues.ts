import { Router } from 'express';
import { db } from '../db/database.js';
import { requireAuth, requireProjectAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { fetchFullProject, parseTaggedUsers } from './projects.js';
import { broadcastNotification } from '../utils/notify.js';
import { saveDatabaseSnapshot } from '../utils/backup.js';
import { dispatchTagNotifications, dispatchCriticalIssueAlert } from '../services/notifications.js';
import { validate } from '../validation/validate.js';
import * as S from '../validation/schemas.js';
import { publicBaseUrl } from '../config.js';
import { audited } from '../utils/audit.js';

const router = Router({ mergeParams: true });

// POST add issue
router.post('/', requireAuth, requireProjectAccess(), validate({ params: S.projectParams, body: S.createIssueBody }), audited({ action: 'create', entityType: 'issue', table: 'issues' }), async (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const project = fetchFullProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const body = req.body;
  const issueId = body.id || `${projectId}-issue-${Date.now()}`;
  if (db.prepare('SELECT 1 FROM issues WHERE id = ?').get(issueId)) {
    return res.status(409).json({ error: 'Issue with this id already exists' });
  }
  res.locals.auditEntityId = issueId;
  const maxOrder = db.prepare('SELECT MAX(order_index) as max_idx FROM issues WHERE project_id = ?').get(projectId) as { max_idx: number | null };
  const nextOrder = (maxOrder.max_idx ?? -1) + 1;
  const taggedUsers = Array.isArray(body.taggedUsers) ? body.taggedUsers : [];

  db.prepare(`
    INSERT INTO issues (
      id, project_id, title, detail, severity, owner, category, status,
      stage, date_raised, due_date, impact_cost, impact_schedule, impact_scope,
      action, resolution, tagged_users, order_index
    ) VALUES (
      @id, @project_id, @title, @detail, @severity, @owner, @category, @status,
      @stage, @date_raised, @due_date, @impact_cost, @impact_schedule, @impact_scope,
      @action, @resolution, @tagged_users, @order_index
    )
  `).run({
    id: issueId,
    project_id: projectId,
    title: body.title,
    detail: body.detail,
    severity: body.severity || 'Medium',
    owner: body.owner || 'Project Lead',
    category: body.category || 'Other',
    status: body.status || 'Open',
    stage: body.stage || null,
    date_raised: body.issueAriseDate || body.dateRaised || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    due_date: body.targetClosureDate || body.dueDate || null,
    impact_cost: body.impactCost || null,
    impact_schedule: body.impactSchedule || null,
    impact_scope: body.impactScope || null,
    action: body.action || null,
    resolution: body.resolution || null,
    tagged_users: JSON.stringify(taggedUsers),
    order_index: nextOrder,
  });

  const origin = publicBaseUrl(req);
  const authorName = req.user?.name || body.owner || 'Project Lead';

  // 1. Notify tagged users if any
  if (taggedUsers.length > 0) {
    await dispatchTagNotifications({
      taggedUserIds: taggedUsers,
      taggedBy: authorName,
      entityType: 'Issue',
      entityTitle: body.title,
      entityContext: body.detail,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  // 2. High severity / Critical issue alerts
  if (body.severity === 'High') {
    broadcastNotification(
      'high_issue',
      
      `notif-iss-${issueId}`,
      `Critical Issue: ${body.title}`,
      `High priority issue logged on ${project.name}: ${body.detail}`,
      projectId,
      `/project/${projectId}`
    );

    await dispatchCriticalIssueAlert({
      issueTitle: body.title,
      severity: body.severity,
      category: body.category,
      detail: body.detail,
      raisedBy: authorName,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  saveDatabaseSnapshot();

  const updatedProject = fetchFullProject(projectId);
  return res.status(201).json({ project: updatedProject });
});

// PATCH update issue
router.patch('/:issueId', requireAuth, requireProjectAccess(), validate({ params: S.issueParams, body: S.updateIssueBody }), audited({ action: 'update', entityType: 'issue', table: 'issues', id: (req) => req.params.issueId as string }), async (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const issueId = req.params.issueId as string;
  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND project_id = ?').get(issueId, projectId) as any;
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  const project = fetchFullProject(projectId);
  const patch = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (patch.title !== undefined) { updates.push('title = ?'); values.push(patch.title); }
  if (patch.detail !== undefined) { updates.push('detail = ?'); values.push(patch.detail); }
  if (patch.severity !== undefined) { updates.push('severity = ?'); values.push(patch.severity); }
  if (patch.owner !== undefined) { updates.push('owner = ?'); values.push(patch.owner); }
  if (patch.category !== undefined) { updates.push('category = ?'); values.push(patch.category); }
  if (patch.status !== undefined) { updates.push('status = ?'); values.push(patch.status); }
  if (patch.stage !== undefined) { updates.push('stage = ?'); values.push(patch.stage); }
  if (patch.dueDate !== undefined) { updates.push('due_date = ?'); values.push(patch.dueDate); }
  else if (patch.targetClosureDate !== undefined) { updates.push('due_date = ?'); values.push(patch.targetClosureDate); }
  if (patch.dateRaised !== undefined) { updates.push('date_raised = ?'); values.push(patch.dateRaised); }
  else if (patch.issueAriseDate !== undefined) { updates.push('date_raised = ?'); values.push(patch.issueAriseDate); }
  if (patch.impactCost !== undefined) { updates.push('impact_cost = ?'); values.push(patch.impactCost); }
  if (patch.impactSchedule !== undefined) { updates.push('impact_schedule = ?'); values.push(patch.impactSchedule); }
  if (patch.impactScope !== undefined) { updates.push('impact_scope = ?'); values.push(patch.impactScope); }
  if (patch.action !== undefined) { updates.push('action = ?'); values.push(patch.action); }
  if (patch.resolution !== undefined) { updates.push('resolution = ?'); values.push(patch.resolution); }

  let newlyTaggedUsers: string[] = [];
  if (patch.taggedUsers !== undefined) {
    const updatedTagged: string[] = Array.isArray(patch.taggedUsers) ? patch.taggedUsers : [];
    const prevTagged = parseTaggedUsers(issue.tagged_users);
    newlyTaggedUsers = updatedTagged.filter((u) => !prevTagged.includes(u));

    updates.push('tagged_users = ?');
    values.push(JSON.stringify(updatedTagged));
  }

  if (updates.length > 0) {
    values.push(issueId);
    values.push(projectId);
    db.prepare(`UPDATE issues SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`).run(...values);
  }

  const origin = publicBaseUrl(req);
  const authorName = req.user?.name || issue.owner || 'Project Lead';

  // Notify newly tagged users only when explicitly requested
  if (patch.notify && newlyTaggedUsers.length > 0 && project) {
    await dispatchTagNotifications({
      taggedUserIds: newlyTaggedUsers,
      taggedBy: authorName,
      entityType: 'Issue',
      entityTitle: patch.title || issue.title,
      entityContext: patch.detail || issue.detail,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  // Trigger alert if newly elevated to High severity
  if (patch.severity === 'High' && issue.severity !== 'High' && project) {
    await dispatchCriticalIssueAlert({
      issueTitle: patch.title || issue.title,
      severity: 'High',
      category: patch.category || issue.category,
      detail: patch.detail || issue.detail,
      raisedBy: authorName,
      projectId,
      projectName: project.name,
      origin,
    });
  }

  saveDatabaseSnapshot();

  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

// DELETE issue
router.delete('/:issueId', requireAuth, requireProjectAccess(), validate({ params: S.issueParams }), audited({ action: 'delete', entityType: 'issue', table: 'issues', id: (req) => req.params.issueId as string }), (req: AuthenticatedRequest, res) => {
  const projectId = req.params.id as string;
  const issueId = req.params.issueId as string;
  db.prepare('DELETE FROM issues WHERE id = ? AND project_id = ?').run(issueId, projectId);
  saveDatabaseSnapshot();
  const updatedProject = fetchFullProject(projectId);
  return res.json({ project: updatedProject });
});

export default router;
