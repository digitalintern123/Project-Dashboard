import { describe, expect, it } from 'vitest';
import { currentStage, effectiveStageStatus } from '@/lib/stage-status';

describe('effectiveStageStatus', () => {
  it.each([
    ['upcoming', 0, 'upcoming'],
    ['active', 0, 'active'],
    ['complete', 0, 'upcoming'],
    ['upcoming', 50, 'active'],
    ['active', 50, 'active'],
    ['complete', 50, 'active'],
    ['upcoming', 100, 'complete'],
    ['active', 100, 'complete'],
    ['complete', 100, 'complete'],
    ['blocked', 0, 'blocked'],
    ['blocked', 50, 'blocked'],
    ['blocked', 100, 'blocked'],
  ] as const)('%s at %i%% shows as %s', (status, progress, expected) => {
    expect(effectiveStageStatus({ status, progress })).toBe(expected);
  });
});

describe('currentStage', () => {
  it('is the first stage in progress, never a finished one', () => {
    const phases = [
      { name: 'Brief', status: 'active' as const, progress: 100 },
      { name: 'Design', status: 'upcoming' as const, progress: 40 },
      { name: 'Build', status: 'active' as const, progress: 0 },
    ];
    expect(currentStage(phases)?.name).toBe('Design');
    expect(currentStage([{ name: 'X', status: 'upcoming' as const, progress: 0 }])).toBeUndefined();
  });
});
