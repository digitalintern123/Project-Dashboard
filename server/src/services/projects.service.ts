import type { z } from 'zod';
import type * as S from '../validation/schemas.js';
import type { UserPayload } from '../middleware/auth.js';
import { projectsRepo } from '../repositories/projects.repo.js';
import { phasesRepo } from '../repositories/phases.repo.js';
import { milestonesRepo } from '../repositories/milestones.repo.js';
import { issuesRepo } from '../repositories/issues.repo.js';
import { usersRepo } from '../repositories/users.repo.js';
import { todayLabel } from '../repositories/sql.js';
import { db } from '../db/database.js';
import { broadcastNotification } from '../utils/notify.js';
import { calculateProjectStatus, type ProjectStatus } from '../utils/status.js';
import { conflict, badRequest, forbidden, notFound } from '../utils/http-error.js';
import { toProjectDto, type ProjectDto } from './project-mapper.js';

export type CreateProjectInput = z.infer<typeof S.createProjectBody>;
export type UpdateProjectInput = z.infer<typeof S.updateProjectBody>;

const DEFAULT_STAGES = [
  { name: 'Brief & scope', status: 'active', owner: 'PMO' },
  { name: 'Design development', status: 'upcoming', owner: 'Design' },
  { name: 'Procurement', status: 'upcoming', owner: 'Sourcing' },
  { name: 'Execution', status: 'upcoming', owner: 'Projects' },
  { name: 'Handover', status: 'upcoming', owner: 'Operations' },
];

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** A project with all its children, in the shape the API returns, or null. */
export function getProject(id: string): ProjectDto | null {
  const row = projectsRepo.find(id);
  if (!row) return null;
  return toProjectDto(row, projectsRepo.childrenFor([id]).get(id)!);
}

/** Like getProject, but a missing project is a 404. */
export function requireProject(id: string): ProjectDto {
  const project = getProject(id);
  if (!project) throw notFound('Project');
  return project;
}

/** Every project with its children, loaded in a fixed number of queries. */
export function listProjects(): ProjectDto[] {
  const rows = projectsRepo.listOrdered();
  const children = projectsRepo.childrenFor(rows.map((r) => r.id));
  return rows.map((row) => toProjectDto(row, children.get(row.id)!));
}

export function createProject(input: CreateProjectInput, user: UserPayload): ProjectDto {
  const id = input.id || `${slug(input.location) || 'site'}-${slug(input.name) || 'project'}-${Date.now()}`;
  if (projectsRepo.exists(id)) throw conflict('Project with this ID already exists');

  const today = todayLabel();
  const progress = input.progress ?? 0;
  const stages = input.phases && input.phases.length > 0 ? input.phases : DEFAULT_STAGES;
  const spec = input.specification as { area?: string; capacity?: string } | undefined;

  projectsRepo.insert({
    id,
    name: input.name,
    location: input.location,
    category: input.category,
    code: input.code || `${input.location.slice(0, 3).toUpperCase()}-NEW-${new Date().getFullYear() % 100}`,
    health: input.health || (progress > 0 ? 'On track' : 'Not started'),
    status: input.status || calculateProjectStatus(progress),
    progress,
    target_date: input.targetDate || '',
    target_label: input.targetLabel || input.targetDate || '',
    aop: input.aop ?? 0,
    awarded: input.awarded ?? 0,
    spent: input.spent ?? 0,
    projected_cost: input.projectedCost ?? input.projected_cost ?? input.aop ?? 0,
    area: input.area || spec?.area || null,
    pax_keys: input.paxKeys || input.pax_keys || spec?.capacity || null,
    next_milestone: input.nextMilestone || 'Project brief',
    next_milestone_date: input.nextMilestoneDate || input.startDate || '',
    lead_id: input.leadId || user.id,
    start_date: input.startDate || null,
    last_updated: today,
    specification_json: input.specification ? JSON.stringify(input.specification) : null,
    template_id: input.templateId || null,
  });

  stages.forEach((stage, index) => {
    const s = stage as {
      id?: string;
      name: string;
      status?: string;
      progress?: number | null;
      weight?: number | null;
      owner?: string | null;
    };
    phasesRepo.insert({
      id: s.id || `${id}-phase-${index}`,
      project_id: id,
      name: s.name,
      status: s.status || 'upcoming',
      progress: s.progress ?? 0,
      weight: s.weight ?? null,
      owner: s.owner || 'PMO',
      order_index: index,
      planned_start: null,
      planned_finish: null,
      actual_finish: null,
      work_completed: null,
      next_action: null,
      decision_required: null,
      updated_at: null,
    });
  });

  (input.milestones ?? []).forEach((m, index) => {
    milestonesRepo.insert({
      id: m.id || `${id}-milestone-${index}`,
      project_id: id,
      title: m.title,
      date: m.date,
      status: m.status || 'upcoming',
      stage: m.stage || null,
      owner: m.owner || null,
      approval_required: m.approvalRequired ? 1 : 0,
      approval_status: m.approvalStatus || (m.approvalRequired ? 'Pending' : 'Not required'),
      completed_date: m.completedDate || null,
      tagged_users: null,
      order_index: index,
    });
  });

  (input.issues ?? []).forEach((iss, index) => {
    issuesRepo.insert({
      id: iss.id || `${id}-issue-${index}`,
      project_id: id,
      title: iss.title,
      detail: iss.detail,
      severity: iss.severity || 'Medium',
      owner: iss.owner || user.name,
      category: iss.category || 'Other',
      status: iss.status || 'Open',
      stage: iss.stage || null,
      date_raised: iss.issueAriseDate || iss.dateRaised || today,
      due_date: iss.targetClosureDate || iss.dueDate || null,
      impact_cost: iss.impactCost || null,
      impact_schedule: iss.impactSchedule || null,
      impact_scope: iss.impactScope || null,
      action: iss.action || null,
      resolution: iss.resolution || null,
      tagged_users: null,
      order_index: index,
    });
  });

  broadcastNotification(
    'system',
    `notif-create-${id}`,
    `New Project Created: ${input.name}`,
    `${input.name} was added to the portfolio by ${user.name}.`,
    id,
    `/project/${id}`,
  );

  return requireProject(id);
}

export function updateProject(id: string, patch: UpdateProjectInput, user: UserPayload): ProjectDto {
  const current = projectsRepo.find(id);
  if (!current) throw notFound('Project');
  if (patch.leadId !== undefined && patch.leadId !== current.lead_id && user.role !== 'coordinator') {
    throw forbidden('Forbidden: Only the coordinator can reassign a project lead');
  }

  const progress = patch.progress != null ? Math.max(0, Math.min(100, patch.progress)) : undefined;
  projectsRepo.update(id, {
    last_updated: todayLabel(),
    name: patch.name,
    code: patch.code,
    location: patch.location,
    category: patch.category,
    health: patch.health,
    status:
      patch.status ??
      (progress !== undefined ? calculateProjectStatus(progress, [], current.status as ProjectStatus) : undefined),
    start_date: patch.startDate,
    progress,
    target_date: patch.targetDate,
    target_label: patch.targetLabel,
    aop: patch.aop,
    awarded: patch.awarded,
    spent: patch.spent,
    projected_cost: patch.projectedCost !== undefined ? patch.projectedCost : patch.projected_cost,
    area: patch.area,
    pax_keys: patch.paxKeys !== undefined ? patch.paxKeys : patch.pax_keys,
    next_milestone: patch.nextMilestone,
    next_milestone_date: patch.nextMilestoneDate,
    lead_id: patch.leadId,
    specification_json: patch.specification !== undefined ? JSON.stringify(patch.specification) : undefined,
  });

  for (const stage of patch.phases ?? []) {
    if (stage.id && stage.budget !== undefined) phasesRepo.update(stage.id, id, { budget: stage.budget });
  }

  return requireProject(id);
}

export function allotProject(id: string, leadId: string, user: UserPayload): ProjectDto {
  const lead = usersRepo.findLead(leadId);
  if (!lead) throw badRequest('Selected lead does not exist or is not a project lead');
  const project = projectsRepo.find(id);
  if (!project) throw notFound('Project');

  projectsRepo.update(id, { lead_id: leadId, last_updated: todayLabel() });
  broadcastNotification(
    'system',
    `notif-allot-${id}-${Date.now()}`,
    `Project Allotted: ${project.name}`,
    `${project.name} has been assigned to ${lead.name} by ${user.name}.`,
    id,
    `/project/${id}`,
  );
  return requireProject(id);
}

/** Deletes a project; returns its photo files so the caller can remove them after commit. */
export function deleteProject(id: string): { url: string; thumbnail_url: string | null }[] {
  const files = db.prepare('SELECT url, thumbnail_url FROM photos WHERE project_id = ?').all(id) as {
    url: string;
    thumbnail_url: string | null;
  }[];
  if (!projectsRepo.delete(id)) throw notFound('Project');
  return files;
}
