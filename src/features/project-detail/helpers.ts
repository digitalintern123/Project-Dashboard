import { CRORE, type Project } from '@/data/projects';
import { getCommercialSummary } from '@/lib/calculations';
import { healthStyles } from './styles';
import { currentStage } from '@/lib/stage-status';

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function activePhaseLabel(project: Project) {
  return currentStage(project.phases)?.name ?? 'Not started';
}

/** Converts the crore-denominated inputs, rejecting blank or negative values. */
export function parseCroreFields(fields: {
  aop: string;
  awarded: string;
  spent: string;
  projectedCost?: string;
}): Partial<Project> | null {
  const aop = Number(fields.aop);
  const awarded = Number(fields.awarded);
  const spent = Number(fields.spent);
  const projectedCost =
    fields.projectedCost !== undefined && fields.projectedCost !== '' ? Number(fields.projectedCost) : aop;
  const values = [aop, awarded, spent, projectedCost];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  return { aop: aop * CRORE, awarded: awarded * CRORE, spent: spent * CRORE, projectedCost: projectedCost * CRORE };
}

export function openIssueLabel(project: Project): string {
  const open = project.issues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
  if (open.length === 0) return 'None open';
  const high = open.filter((issue) => issue.severity === 'High').length;
  return high ? `${open.length} open · ${high} high` : `${open.length} open`;
}

export function openIssueTone(project: Project) {
  const open = project.issues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
  if (open.length === 0) return healthStyles['On track'];
  return open.some((issue) => issue.severity === 'High') ? healthStyles.Delayed : healthStyles['At risk'];
}

/** Budget signal derived from spend against the awarded value. */
export function budgetLabel(project: Project): string {
  // Reuses the same spentRatePct as CommercialPanel/CommercialView — one
  // definition of "spend against awarded", not a third copy of the ratio.
  const { spentRatePct } = getCommercialSummary(project);
  if (spentRatePct === null) return 'Not awarded';
  if (spentRatePct > 100) return 'Over awarded value';
  if (spentRatePct > 90) return 'Near awarded value';
  return 'Within awarded value';
}

export function budgetTone(project: Project) {
  const { spentRatePct } = getCommercialSummary(project);
  if (spentRatePct === null) return healthStyles['Not started'];
  if (spentRatePct > 100) return healthStyles.Delayed;
  if (spentRatePct > 90) return healthStyles['At risk'];
  return healthStyles['On track'];
}
