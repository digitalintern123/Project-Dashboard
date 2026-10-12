import { phasesRepo } from '../repositories/phases.repo.js';
import { projectsRepo } from '../repositories/projects.repo.js';
import { todayLabel } from '../repositories/sql.js';
import type { PhaseRow } from '../repositories/rows.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Overall progress as a weighted average of stage progress. Weights: explicit
 * stage weights if any stage has one (others count 1); otherwise planned
 * duration in days; otherwise equal. Mirrors calculateWeightedProgress in the UI.
 */
export function weightedProgress(
  phases: Pick<PhaseRow, 'progress' | 'weight' | 'planned_start' | 'planned_finish'>[],
): number {
  if (phases.length === 0) return 0;
  const durations = phases.map((p) => {
    if (!p.planned_start || !p.planned_finish) return null;
    const start = new Date(p.planned_start).getTime();
    const finish = new Date(p.planned_finish).getTime();
    return !isNaN(start) && !isNaN(finish) && finish >= start
      ? Math.max(1, Math.round((finish - start) / DAY_MS))
      : null;
  });
  const hasExplicit = phases.some((p) => typeof p.weight === 'number' && p.weight > 0);
  const weights = phases.map((p, i) => {
    if (typeof p.weight === 'number' && p.weight > 0) return p.weight;
    if (!hasExplicit && durations[i] !== null) return durations[i]!;
    return 1;
  });
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const weighted = phases.reduce(
    (sum, p, i) => sum + (weights[i] / total) * Math.max(0, Math.min(100, Number(p.progress) || 0)),
    0,
  );
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

/** Recalculates and stores a project's progress from its stages. */
export function recomputeProjectProgress(projectId: string): number {
  const progress = weightedProgress(phasesRepo.listForProject(projectId));
  projectsRepo.update(projectId, { progress, last_updated: todayLabel() });
  return progress;
}
