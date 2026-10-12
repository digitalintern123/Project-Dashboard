import type { Project, Phase, ProjectStatus } from '@/data/projects';
import { parseIsoDate } from '@/lib/date';

/**
 * Centralized calculations.
 *
 * Rule for this file: every number here is derived from real project fields
 * (dates, amounts, counts) — nothing is a fixed placeholder. If a
 * calculation cannot be produced from the data a project actually has, it
 * returns `null` and callers must render an explicit "unavailable" state
 * rather than inventing a number.
 *
 * Any page that needs one of these values should call the function here,
 * not re-derive its own copy of the arithmetic — that duplication is how
 * the dashboard and project-detail pages previously drifted (e.g. two
 * different roundings of the same award percentage).
 */

// ---------------------------------------------------------------------------
// Planned vs. actual progress
// ---------------------------------------------------------------------------

/**
 * Schedule-based planned progress: "if this project is progressing evenly
 * from its start date to its target date, what fraction of it should be
 * done by today?"
 *
 * This replaces the old placeholder `project.progress + 8`, which was not a
 * calculation — it was a fixed offset with no relationship to the project's
 * actual schedule.
 *
 * Returns `null` when there isn't enough real schedule data to compute this
 * (missing or invalid `startDate`/`targetDate`, or a zero/negative span) —
 * callers must show "Planned progress unavailable" in that case, per the
 * product rule that a missing calculation is never replaced with an
 * invented one.
 *
 * This is a linear approximation, not the phase-weighted schedule engine
 * described for Stage 2 (`docs/roadmap.md`). It answers the question
 * honestly with the fields the project actually has today.
 */
export function getPlannedProgress(project: Project, now: Date = new Date()): number | null {
  const start = parseIsoDate(project.startDate);
  const target = parseIsoDate(project.targetDate);
  if (!start || !target) return null;

  const totalSpan = target.getTime() - start.getTime();
  if (totalSpan <= 0) return null;

  const elapsed = now.getTime() - start.getTime();
  const fraction = elapsed / totalSpan;
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}

export type ProgressVariance = {
  actual: number;
  planned: number | null;
  /** `null` whenever `planned` is `null` — there is nothing to compare against. */
  variance: number | null;
};

/** Bundles actual/planned/variance so a component renders all three from one call. */
export function getProgressVariance(project: Project, now: Date = new Date()): ProgressVariance {
  const planned = getPlannedProgress(project, now);
  return {
    actual: project.progress,
    planned,
    variance: planned === null ? null : project.progress - planned,
  };
}

export type StageProgressWeight = {
  phase: Phase;
  index: number;
  phaseIndex: number;
  name: string;
  progress: number;
  weightPct: number;
  weightPercent: number;
  durationDays: number | null;
  contributionPct: number;
  contribution: number;
  isExplicitWeight: boolean;
  isCustomWeight: boolean;
};

export type WeightedProgressResult = {
  overallProgress: number;
  stages: StageProgressWeight[];
  hasTimelineData: boolean;
  totalDurationDays: number;
};

/**
 * Calculates overall project progress as a weighted summation of timeline duration
 * and stage progress.
 *
 * Priority for weighting:
 * 1. Explicit stage weight (`phase.weight` if specified and > 0)
 * 2. Timeline duration (`plannedFinish - plannedStart` in days)
 * 3. Equal distribution fallback (1 / N)
 */
export function calculateWeightedProgress(phases: Phase[]): WeightedProgressResult {
  if (!phases || phases.length === 0) {
    return {
      overallProgress: 0,
      stages: [],
      hasTimelineData: false,
      totalDurationDays: 0,
    };
  }

  // 1. Calculate duration for each phase where planned dates are provided
  const phaseDurations = phases.map((phase) => {
    const start = parseIsoDate(phase.plannedStart);
    const finish = parseIsoDate(phase.plannedFinish);
    if (start && finish && finish.getTime() >= start.getTime()) {
      const diffMs = finish.getTime() - start.getTime();
      return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }
    return null;
  });

  const totalDurationDays = phaseDurations.reduce<number>((sum, d) => sum + (d !== null ? d : 0), 0);
  const hasTimelineData = totalDurationDays > 0;

  // 2. Determine raw weights
  // If any stage has an explicit weight, honor it; otherwise proportional to timeline duration
  const hasAnyExplicitWeight = phases.some(
    (p) => typeof p.weight === 'number' && Number.isFinite(p.weight) && p.weight > 0,
  );

  const rawWeights = phases.map((phase, idx) => {
    if (typeof phase.weight === 'number' && Number.isFinite(phase.weight) && phase.weight > 0) {
      return phase.weight;
    }
    if (!hasAnyExplicitWeight && phaseDurations[idx] !== null) {
      return phaseDurations[idx]!;
    }
    return 1;
  });

  const sumRawWeights = rawWeights.reduce((sum, w) => sum + w, 0) || 1;

  // 3. Compute normalized percentage weights and contribution towards overall progress
  let totalWeightedContribution = 0;
  const stages: StageProgressWeight[] = phases.map((phase, idx) => {
    const weightPct = Number(((rawWeights[idx] / sumRawWeights) * 100).toFixed(1));
    const cleanProgress = Math.max(0, Math.min(100, Number(phase.progress) || 0));
    const contributionPct = Number(((weightPct / 100) * cleanProgress).toFixed(1));
    totalWeightedContribution += contributionPct;

    return {
      phase,
      index: idx,
      phaseIndex: idx,
      name: phase.name,
      progress: cleanProgress,
      weightPct,
      weightPercent: weightPct,
      durationDays: phaseDurations[idx],
      contributionPct,
      contribution: contributionPct,
      isExplicitWeight: typeof phase.weight === 'number' && phase.weight > 0,
      isCustomWeight: typeof phase.weight === 'number' && phase.weight > 0,
    };
  });

  const overallProgress = Math.max(0, Math.min(100, Math.round(totalWeightedContribution)));

  return {
    overallProgress,
    stages,
    hasTimelineData,
    totalDurationDays,
  };
}

export type AutoStatusResult = {
  status: ProjectStatus | null;
  isAutomatic: boolean;
  matchedStageName?: string;
  reason?: string;
};

/**
 * Project Status is fully manual and user-controlled.
 * It strictly preserves the user-defined status, defaulting to 'Yet to start' only if undefined.
 */
export function calculateProjectStatus(
  _progress?: number,
  _phases?: Phase[],
  currentStatus?: ProjectStatus,
): ProjectStatus {
  return currentStatus || 'Yet to start';
}

// ---------------------------------------------------------------------------
// Commercial
// ---------------------------------------------------------------------------

export type CommercialSummary = {
  aop: number;
  awarded: number;
  spent: number;
  projectedCost: number;
  remaining: number;
  costVariance: number;
  /** Awarded as a % of AOP. `null` when AOP is 0 (nothing to divide by). */
  awardRatePct: number | null;
  /** Spent as a % of awarded. `null` when nothing has been awarded yet. */
  spentRatePct: number | null;
  /** True when awarded exceeds AOP — flagged, never silently allowed. */
  overAwarded: boolean;
  /** True when projected cost exceeds AOP budget */
  overBudget: boolean;
  /** True when spent till date exceeds committed awarded amount */
  overSpent: boolean;
};

function ratioPct(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10; // one decimal place
}

/** The one place that turns a project's raw AOP/awarded/spent/projected into display ratios. */
export function getCommercialSummary(project: Project): CommercialSummary {
  const { aop, awarded, spent } = project;
  const projectedCost = Number.isFinite(project.projectedCost) ? (project.projectedCost as number) : aop;
  return {
    aop,
    awarded,
    spent,
    projectedCost,
    remaining: awarded - spent,
    costVariance: projectedCost - aop,
    awardRatePct: ratioPct(awarded, aop),
    spentRatePct: ratioPct(spent, awarded),
    overAwarded: Number.isFinite(aop) && Number.isFinite(awarded) && awarded > aop,
    overBudget: Number.isFinite(aop) && Number.isFinite(projectedCost) && projectedCost > aop,
    overSpent: Number.isFinite(awarded) && Number.isFinite(spent) && spent > awarded,
  };
}

export type PortfolioCommercialSummary = {
  totalAop: number;
  totalAwarded: number;
  totalSpent: number;
  totalProjectedCost: number;
  awardRatePct: number | null;
  spentRatePct: number | null;
};

/** Portfolio-level roll-up, built from the same per-project fields — never a separate estimate. */
export function getPortfolioCommercialSummary(projects: Project[]): PortfolioCommercialSummary {
  const totalAop = projects.reduce((sum, project) => sum + (Number.isFinite(project.aop) ? project.aop : 0), 0);
  const totalAwarded = projects.reduce(
    (sum, project) => sum + (Number.isFinite(project.awarded) ? project.awarded : 0),
    0,
  );
  const totalSpent = projects.reduce((sum, project) => sum + (Number.isFinite(project.spent) ? project.spent : 0), 0);
  const totalProjectedCost = projects.reduce(
    (sum, project) =>
      sum +
      (Number.isFinite(project.projectedCost)
        ? (project.projectedCost as number)
        : Number.isFinite(project.aop)
          ? project.aop
          : 0),
    0,
  );
  return {
    totalAop,
    totalAwarded,
    totalSpent,
    totalProjectedCost,
    awardRatePct: ratioPct(totalAwarded, totalAop),
    spentRatePct: ratioPct(totalSpent, totalAwarded),
  };
}

/** `x of y` as a percentage string. `null`/zero-denominator renders as "—", never "NaN%" or "Infinity%". */
export function formatRatio(pct: number | null, digits = 1): string {
  return pct === null ? '—' : `${pct.toFixed(digits)}%`;
}

// ---------------------------------------------------------------------------
// Project Prioritization (Incomplete / Active Projects First)
// ---------------------------------------------------------------------------

/**
 * Returns true if a project is incomplete (progress < 100 and status != 'Operational').
 */
export function isProjectIncomplete(project: Project): boolean {
  return (project.progress ?? 0) < 100 && project.status !== 'Operational';
}

/**
 * Sorts projects so that incomplete and active facilities appear first,
 * ranked by urgency/health, followed by 100% completed/operational projects alphabetically.
 */
export function sortProjectsIncompleteFirst(projects: Project[]): Project[] {
  const healthWeight: Record<string, number> = {
    Delayed: 3,
    'At risk': 2,
    'On track': 1,
    'Not started': 0,
  };

  return [...projects].sort((a, b) => {
    const aIncomplete = isProjectIncomplete(a);
    const bIncomplete = isProjectIncomplete(b);

    // Incomplete projects always precede completed ones
    if (aIncomplete && !bIncomplete) return -1;
    if (!aIncomplete && bIncomplete) return 1;

    // Both are incomplete: rank by health risk, then by progress, then alphabetically
    if (aIncomplete && bIncomplete) {
      const aWeight = healthWeight[a.health] ?? 0;
      const bWeight = healthWeight[b.health] ?? 0;
      if (bWeight !== aWeight) {
        return bWeight - aWeight; // Delayed & At risk first
      }
      if ((a.progress ?? 0) !== (b.progress ?? 0)) {
        return (a.progress ?? 0) - (b.progress ?? 0);
      }
      return a.name.localeCompare(b.name);
    }

    // Both are complete: rank alphabetically by facility name
    return a.name.localeCompare(b.name);
  });
}
