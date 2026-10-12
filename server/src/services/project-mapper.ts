import type { ProjectChildren } from '../repositories/projects.repo.js';
import type { IssueRow, MilestoneRow, PhaseRow, PhotoRow, ProjectRow, UpdateRow } from '../repositories/rows.js';

/** Tagged user ids are stored as a JSON array (older rows: comma-separated). */
export function parseTaggedUsers(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function parseJson(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export const toPhaseDto = (ph: PhaseRow) => ({
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
});

export const toMilestoneDto = (m: MilestoneRow) => ({
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
});

export const toIssueDto = (iss: IssueRow) => ({
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
});

export const toUpdateDto = (u: UpdateRow) => ({
  id: u.id,
  date: u.date,
  author: u.author,
  role: u.role,
  text: u.text,
  stage: u.stage,
  kind: u.kind,
});

export const toPhotoDto = (p: PhotoRow) => ({
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
});

export function toProjectDto(row: ProjectRow, children: ProjectChildren) {
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
    specification: parseJson(row.specification_json),
    phases: children.phases.map(toPhaseDto),
    milestones: children.milestones.map(toMilestoneDto),
    issues: children.issues.map(toIssueDto),
    updates: children.updates.map(toUpdateDto),
    photos: children.photos.map(toPhotoDto),
  };
}

export type ProjectDto = ReturnType<typeof toProjectDto>;
