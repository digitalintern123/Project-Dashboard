import { describe, expect, it } from 'vitest';
import type { Phase, Project } from '@/data/projects';
import {
  calculateProjectStatus,
  calculateWeightedProgress,
  formatRatio,
  getCommercialSummary,
  getPlannedProgress,
  getPortfolioCommercialSummary,
  getProgressVariance,
  isProjectIncomplete,
  sortProjectsIncompleteFirst,
} from '@/lib/calculations';

const project = (overrides: Partial<Project> = {}): Project =>
  ({
    id: 'p',
    name: 'Project',
    progress: 0,
    status: 'In Design',
    health: 'On track',
    aop: 100,
    awarded: 50,
    spent: 25,
    phases: [],
    milestones: [],
    issues: [],
    updates: [],
    ...overrides,
  }) as unknown as Project;

const phase = (p: Partial<Phase>): Phase => ({ name: 'Stage', status: 'upcoming', progress: 0, owner: 'PMO', ...p }) as Phase;

describe('getPlannedProgress', () => {
  const p = project({ startDate: '2026-01-01', targetDate: '2026-12-31' });

  it('interpolates linearly between start and target', () => {
    expect(getPlannedProgress(p, new Date('2026-07-02T12:00:00'))).toBe(50);
  });

  it('clamps before the start and after the target', () => {
    expect(getPlannedProgress(p, new Date('2025-06-01'))).toBe(0);
    expect(getPlannedProgress(p, new Date('2027-06-01'))).toBe(100);
  });

  it('returns null without a usable schedule', () => {
    expect(getPlannedProgress(project({ startDate: '2026-01-01' }))).toBeNull();
    expect(getPlannedProgress(project({ startDate: '2026-05-01', targetDate: '2026-01-01' }))).toBeNull();
    expect(getPlannedProgress(project({ startDate: 'garbage', targetDate: '2026-01-01' }))).toBeNull();
  });

  it('reports variance only when a plan exists', () => {
    expect(getProgressVariance(project({ ...p, progress: 60 }), new Date('2026-07-02T12:00:00'))).toEqual({ actual: 60, planned: 50, variance: 10 });
    expect(getProgressVariance(project({ progress: 10 })).variance).toBeNull();
  });
});

describe('calculateWeightedProgress', () => {
  it('returns zero for no stages', () => {
    expect(calculateWeightedProgress([]).overallProgress).toBe(0);
  });

  it('weights stages equally by default', () => {
    const r = calculateWeightedProgress([phase({ progress: 100 }), phase({ progress: 0 })]);
    expect(r.overallProgress).toBe(50);
    expect(r.hasTimelineData).toBe(false);
    expect(r.stages[0].weightPct).toBe(50);
  });

  it('weights by planned duration when no explicit weights exist', () => {
    const r = calculateWeightedProgress([
      phase({ progress: 100, plannedStart: '2026-01-01', plannedFinish: '2026-01-31' }),
      phase({ progress: 0, plannedStart: '2026-02-01', plannedFinish: '2026-02-11' }),
    ]);
    expect(r.totalDurationDays).toBe(40);
    expect(r.overallProgress).toBe(75);
  });

  it('prefers explicit weights; unweighted stages count as 1', () => {
    const r = calculateWeightedProgress([phase({ progress: 50, weight: 3 }), phase({ progress: 0, plannedStart: '2026-01-01', plannedFinish: '2026-12-31' })]);
    expect(r.overallProgress).toBe(38);
    expect(r.stages[0].isExplicitWeight).toBe(true);
  });

  it('clamps out-of-range progress', () => {
    expect(calculateWeightedProgress([phase({ progress: 150 }), phase({ progress: -20 })]).overallProgress).toBe(50);
  });
});

describe('status and ordering', () => {
  it('keeps the manual status', () => {
    expect(calculateProjectStatus(80, [], 'Operational')).toBe('Operational');
    expect(calculateProjectStatus()).toBe('Yet to start');
  });

  it('treats operational or 100% projects as complete', () => {
    expect(isProjectIncomplete(project({ progress: 100 }))).toBe(false);
    expect(isProjectIncomplete(project({ status: 'Operational' }))).toBe(false);
    expect(isProjectIncomplete(project({ progress: 40 }))).toBe(true);
  });

  it('sorts open projects by risk, then progress, then name; completed ones by name', () => {
    const sorted = sortProjectsIncompleteFirst([
      project({ name: 'Zeta done', progress: 100 }),
      project({ name: 'Alpha done', status: 'Operational' }),
      project({ name: 'B on track 40', progress: 40 }),
      project({ name: 'A on track 40', progress: 40 }),
      project({ name: 'C on track 10', progress: 10 }),
      project({ name: 'Delayed', health: 'Delayed', progress: 90 }),
      project({ name: 'At risk', health: 'At risk', progress: 90 }),
    ]);
    expect(sorted.map((p) => p.name)).toEqual([
      'Delayed', 'At risk', 'C on track 10', 'A on track 40', 'B on track 40', 'Alpha done', 'Zeta done',
    ]);
  });
});

describe('commercial summaries', () => {
  it('derives ratios and flags', () => {
    const s = getCommercialSummary(project({ aop: 100, awarded: 120, spent: 130, projectedCost: 150 }));
    expect(s).toMatchObject({ remaining: -10, costVariance: 50, awardRatePct: 120, overAwarded: true, overBudget: true, overSpent: true });
    expect(s.spentRatePct).toBeCloseTo(108.3);
  });

  it('falls back to AOP for projected cost and never divides by zero', () => {
    const s = getCommercialSummary(project({ aop: 0, awarded: 0, spent: 0 }));
    expect(s.projectedCost).toBe(0);
    expect(s.awardRatePct).toBeNull();
    expect(s.spentRatePct).toBeNull();
  });

  it('rolls up a portfolio', () => {
    const s = getPortfolioCommercialSummary([project({ aop: 100, awarded: 50, spent: 10 }), project({ aop: 100, awarded: 50, spent: 40, projectedCost: 120 })]);
    expect(s).toMatchObject({ totalAop: 200, totalAwarded: 100, totalSpent: 50, totalProjectedCost: 220, awardRatePct: 50, spentRatePct: 50 });
  });

  it('formats ratios', () => {
    expect(formatRatio(12.345)).toBe('12.3%');
    expect(formatRatio(null)).toBe('—');
  });
});
