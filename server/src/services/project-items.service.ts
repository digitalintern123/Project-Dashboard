import type { z } from 'zod';
import type * as S from '../validation/schemas.js';
import type { UserPayload } from '../middleware/auth.js';
import { db } from '../db/database.js';
import { phasesRepo } from '../repositories/phases.repo.js';
import { milestonesRepo } from '../repositories/milestones.repo.js';
import { issuesRepo } from '../repositories/issues.repo.js';
import { updatesRepo } from '../repositories/updates.repo.js';
import { projectsRepo } from '../repositories/projects.repo.js';
import { todayLabel } from '../repositories/sql.js';
import { broadcastNotification } from '../utils/notify.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error.js';
import {
  dispatchCriticalIssueAlert,
  dispatchMilestoneApprovalAlert,
  dispatchTagNotifications,
} from './notifications.js';
import { parseTaggedUsers } from './project-mapper.js';
import { recomputeProjectProgress } from './progress.js';

/** Who is making the change, and the base URL for links in emails. */
export type Actor = { user: UserPayload; origin: string };

const nextOrder = (table: 'milestones' | 'issues', projectId: string) =>
  ((
    db.prepare(`SELECT MAX(order_index) AS m FROM ${table} WHERE project_id = ?`).get(projectId) as { m: number | null }
  ).m ?? -1) + 1;

function projectName(projectId: string): string {
  const project = projectsRepo.find(projectId);
  if (!project) throw notFound('Project');
  return project.name;
}

/** Ids in `next` that were not in the stored tag list. */
function newlyTagged(stored: string | null, next: string[] | undefined): string[] {
  if (!next) return [];
  const before = parseTaggedUsers(stored);
  return next.filter((id) => !before.includes(id));
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export function addStage(projectId: string, input: z.infer<typeof S.createPhaseBody>, actor: Actor): string {
  const name = projectName(projectId);
  const id = input.id || `${projectId}-phase-${Date.now()}`;
  if (phasesRepo.exists(id)) throw conflict('Stage with this id already exists');
  const tagged = input.taggedUsers ?? [];

  phasesRepo.insert({
    id,
    project_id: projectId,
    name: input.name || 'New stage',
    status: input.status || 'upcoming',
    progress: input.progress ?? 0,
    weight: input.weight ?? null,
    budget: input.budget ?? null,
    owner: input.owner || 'PMO',
    order_index: phasesRepo.nextOrderIndex(projectId),
    planned_start: input.plannedStart || null,
    planned_finish: input.plannedFinish || null,
    actual_finish: input.actualFinish || null,
    work_completed: input.workCompleted || null,
    next_action: input.nextAction || null,
    decision_required: input.decisionRequired || null,
    tagged_users: JSON.stringify(tagged),
    updated_at: todayLabel(),
  });

  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor.user.name,
      entityType: 'Stage',
      entityTitle: input.name || 'Stage',
      entityContext: input.nextAction || input.workCompleted || undefined,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  recomputeProjectProgress(projectId);
  return id;
}

export function updateStage(
  projectId: string,
  stageId: string,
  patch: z.infer<typeof S.updatePhaseBody>,
  actor: Actor,
): void {
  const stage = phasesRepo.find(stageId, projectId);
  if (!stage) throw notFound('Stage');
  const name = projectName(projectId);
  const tagged = newlyTagged(stage.tagged_users, patch.taggedUsers);

  phasesRepo.update(stageId, projectId, {
    updated_at: todayLabel(),
    name: patch.name,
    status: patch.status,
    progress: patch.progress ?? undefined,
    weight: patch.weight,
    budget: patch.budget,
    owner: patch.owner,
    planned_start: patch.plannedStart,
    planned_finish: patch.plannedFinish,
    actual_finish: patch.actualFinish,
    work_completed: patch.workCompleted,
    next_action: patch.nextAction,
    decision_required: patch.decisionRequired,
    tagged_users: patch.taggedUsers !== undefined ? JSON.stringify(patch.taggedUsers) : undefined,
  });

  if (patch.decisionRequired) {
    broadcastNotification(
      'system',
      `notif-dec-${stageId}-${Date.now()}`,
      `Decision Needed: ${stage.name}`,
      `${actor.user.name} requested a decision on stage "${stage.name}": ${patch.decisionRequired}`,
      projectId,
      `/project/${projectId}`,
    );
  }
  if (patch.notify && tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor.user.name,
      entityType: 'Stage',
      entityTitle: patch.name || stage.name,
      entityContext: patch.nextAction || patch.workCompleted || stage.work_completed || undefined,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  recomputeProjectProgress(projectId);
}

export function removeStage(projectId: string, stageId: string): void {
  if (!phasesRepo.find(stageId, projectId)) throw notFound('Stage');
  const stages = phasesRepo.listForProject(projectId);
  if (stages.length <= 1) throw badRequest('A project must retain at least one stage');
  phasesRepo.delete(stageId, projectId);
  phasesRepo.setOrder(stages.filter((s) => s.id !== stageId).map((s) => s.id));
  recomputeProjectProgress(projectId);
}

export function moveStage(projectId: string, index: number, direction: -1 | 1): void {
  projectName(projectId);
  const ids = phasesRepo.listForProject(projectId).map((s) => s.id);
  const target = index + direction;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) throw badRequest('Invalid move target');
  [ids[index], ids[target]] = [ids[target], ids[index]];
  phasesRepo.setOrder(ids);
  recomputeProjectProgress(projectId);
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export function addMilestone(projectId: string, input: z.infer<typeof S.createMilestoneBody>, actor: Actor): string {
  const name = projectName(projectId);
  const id = input.id || `${projectId}-milestone-${Date.now()}`;
  if (milestonesRepo.exists(id)) throw conflict('Milestone with this id already exists');
  const tagged = input.taggedUsers ?? [];

  milestonesRepo.insert({
    id,
    project_id: projectId,
    title: input.title,
    date: input.date,
    status: input.status || 'upcoming',
    stage: input.stage || null,
    owner: input.owner || 'Project Lead',
    approval_required: input.approvalRequired ? 1 : 0,
    approval_status: input.approvalStatus || (input.approvalRequired ? 'Pending' : 'Not required'),
    completed_date: input.completedDate || null,
    tagged_users: JSON.stringify(tagged),
    order_index: nextOrder('milestones', projectId),
  });

  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor.user.name,
      entityType: 'Milestone',
      entityTitle: input.title,
      entityContext: `Target date: ${input.date}${input.stage ? ` • Stage: ${input.stage}` : ''}`,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  if (input.approvalRequired) {
    broadcastNotification(
      'approval_required',
      `notif-appr-${id}`,
      `Approval Requested: ${input.title}`,
      `${name} requires milestone approval from Coordinator.`,
      projectId,
      `/project/${projectId}`,
    );
    dispatchMilestoneApprovalAlert({
      milestoneTitle: input.title,
      targetDate: input.date,
      stage: input.stage ?? undefined,
      requestedBy: actor.user.name,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  return id;
}

export function updateMilestone(
  projectId: string,
  milestoneId: string,
  patch: z.infer<typeof S.updateMilestoneBody>,
  actor: Actor,
): void {
  const milestone = milestonesRepo.find(milestoneId, projectId);
  if (!milestone) throw notFound('Milestone');
  if (patch.approvalStatus !== undefined && actor.user.role !== 'coordinator') {
    throw forbidden('Only Project Coordinators can approve or reject milestones');
  }
  const name = projectName(projectId);
  const tagged = newlyTagged(milestone.tagged_users, patch.taggedUsers);

  milestonesRepo.update(milestoneId, projectId, {
    title: patch.title,
    date: patch.date,
    status: patch.status,
    stage: patch.stage,
    owner: patch.owner,
    approval_required: patch.approvalRequired !== undefined ? (patch.approvalRequired ? 1 : 0) : undefined,
    approval_status: patch.approvalStatus,
    completed_date: patch.completedDate,
    tagged_users: patch.taggedUsers !== undefined ? JSON.stringify(patch.taggedUsers) : undefined,
  });

  if (patch.notify && tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor.user.name,
      entityType: 'Milestone',
      entityTitle: patch.title || milestone.title,
      entityContext: `Target date: ${patch.date || milestone.date}`,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
}

export function removeMilestone(projectId: string, milestoneId: string): void {
  if (!milestonesRepo.delete(milestoneId, projectId)) throw notFound('Milestone');
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export function addIssue(projectId: string, input: z.infer<typeof S.createIssueBody>, actor: Actor): string {
  const name = projectName(projectId);
  const id = input.id || `${projectId}-issue-${Date.now()}`;
  if (issuesRepo.exists(id)) throw conflict('Issue with this id already exists');
  const tagged = input.taggedUsers ?? [];

  issuesRepo.insert({
    id,
    project_id: projectId,
    title: input.title,
    detail: input.detail,
    severity: input.severity || 'Medium',
    owner: input.owner || 'Project Lead',
    category: input.category || 'Other',
    status: input.status || 'Open',
    stage: input.stage || null,
    date_raised: input.issueAriseDate || input.dateRaised || todayLabel(),
    due_date: input.targetClosureDate || input.dueDate || null,
    impact_cost: input.impactCost || null,
    impact_schedule: input.impactSchedule || null,
    impact_scope: input.impactScope || null,
    action: input.action || null,
    resolution: input.resolution || null,
    tagged_users: JSON.stringify(tagged),
    order_index: nextOrder('issues', projectId),
  });

  if (tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor.user.name,
      entityType: 'Issue',
      entityTitle: input.title,
      entityContext: input.detail,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  if (input.severity === 'High') {
    broadcastNotification(
      'high_issue',
      `notif-iss-${id}`,
      `Critical Issue: ${input.title}`,
      `High priority issue logged on ${name}: ${input.detail}`,
      projectId,
      `/project/${projectId}`,
    );
    dispatchCriticalIssueAlert({
      issueTitle: input.title,
      severity: 'High',
      category: input.category ?? undefined,
      detail: input.detail,
      raisedBy: actor.user.name,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  return id;
}

export function updateIssue(
  projectId: string,
  issueId: string,
  patch: z.infer<typeof S.updateIssueBody>,
  actor: Actor,
): void {
  const issue = issuesRepo.find(issueId, projectId);
  if (!issue) throw notFound('Issue');
  const name = projectName(projectId);
  const tagged = newlyTagged(issue.tagged_users, patch.taggedUsers);

  issuesRepo.update(issueId, projectId, {
    title: patch.title,
    detail: patch.detail,
    severity: patch.severity,
    owner: patch.owner,
    category: patch.category,
    status: patch.status,
    stage: patch.stage,
    due_date: patch.dueDate !== undefined ? patch.dueDate : patch.targetClosureDate,
    date_raised: patch.dateRaised !== undefined ? patch.dateRaised : patch.issueAriseDate,
    impact_cost: patch.impactCost,
    impact_schedule: patch.impactSchedule,
    impact_scope: patch.impactScope,
    action: patch.action,
    resolution: patch.resolution,
    tagged_users: patch.taggedUsers !== undefined ? JSON.stringify(patch.taggedUsers) : undefined,
  });

  if (patch.notify && tagged.length > 0) {
    dispatchTagNotifications({
      taggedUserIds: tagged,
      taggedBy: actor.user.name,
      entityType: 'Issue',
      entityTitle: patch.title || issue.title,
      entityContext: patch.detail || issue.detail,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
  // Alert leadership when an issue is escalated to High.
  if (patch.severity === 'High' && issue.severity !== 'High') {
    dispatchCriticalIssueAlert({
      issueTitle: patch.title || issue.title,
      severity: 'High',
      category: patch.category || issue.category || undefined,
      detail: patch.detail || issue.detail,
      raisedBy: actor.user.name,
      projectId,
      projectName: name,
      origin: actor.origin,
      sender: { email: actor.user.email, name: actor.user.name },
    });
  }
}

export function removeIssue(projectId: string, issueId: string): void {
  if (!issuesRepo.delete(issueId, projectId)) throw notFound('Issue');
}

// ---------------------------------------------------------------------------
// Updates feed
// ---------------------------------------------------------------------------

export function addUpdate(projectId: string, input: z.infer<typeof S.createUpdateBody>, actor: Actor): string {
  projectName(projectId);
  const id = `${projectId}-update-${Date.now()}`;
  const today = todayLabel();
  updatesRepo.insert({
    id,
    project_id: projectId,
    date: input.date || today,
    // Always the signed-in user: the client cannot post under someone else's name.
    author: actor.user.name,
    role: actor.user.title || 'Project Lead',
    text: input.text,
    stage: input.stage || null,
    kind: input.kind || 'General',
  });
  projectsRepo.update(projectId, { last_updated: today });
  return id;
}
