import type { Phase } from '@/data/projects';

/**
 * The status a stage is shown with. Progress decides, so the colour and label
 * always match the percentage: 100% is Complete, 1-99% is In progress. Blocked
 * is a deliberate call and always shows; at 0% the saved status shows.
 */
export function effectiveStageStatus(phase: Pick<Phase, 'status' | 'progress'>): Phase['status'] {
  if (phase.status === 'blocked') return 'blocked';
  const progress = Number(phase.progress) || 0;
  if (progress >= 100) return 'complete';
  if (progress > 0) return 'active';
  return phase.status === 'complete' ? 'upcoming' : phase.status;
}

/** The stage being worked on now: the first one in progress. */
export function currentStage<T extends Pick<Phase, 'status' | 'progress'>>(phases: T[]): T | undefined {
  return phases.find((phase) => effectiveStageStatus(phase) === 'active');
}
