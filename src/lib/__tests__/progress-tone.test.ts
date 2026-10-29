import { describe, expect, it } from 'vitest';
import { progressTone, projectProgressTone, stageProgressTone } from '@/lib/progress-tone';

// Plan runs 1 Jan → 31 Dec 2026; on 2 Jul it should be about 50% done.
const start = '2026-01-01';
const finish = '2026-12-31';
const midYear = new Date('2026-07-02T12:00:00');
const at = (actual: number, now = midYear) => progressTone({ actual, start, finish, now });

describe('progressTone against the schedule', () => {
  it('is green ahead of plan and yellow exactly on plan', () => {
    expect(at(51).key).toBe('green');
    expect(at(70).key).toBe('green');
    expect(at(70).reason).toBe('70% done · planned 50% by today · 20 points ahead');
    expect(at(50).key).toBe('yellow');
    expect(at(50).reason).toBe('50% done · planned 50% by today · on plan');
  });

  it('is red as soon as it falls behind plan', () => {
    expect(at(49).key).toBe('red'); // 1 behind
    expect(at(30).key).toBe('red');
    expect(at(30).reason).toBe('30% done · planned 50% by today · 20 points behind');
  });

  it('is red once the target date has passed and work is not done, green when done', () => {
    expect(at(95, new Date('2027-01-02T09:00:00')).key).toBe('red');
    expect(at(95, new Date('2027-01-02T09:00:00')).reason).toBe('95% done · past its target date');
    expect(at(100, new Date('2027-03-01')).key).toBe('green');
    // The target day itself still counts as on time.
    expect(at(95, new Date('2026-12-31T18:00:00')).reason).not.toMatch(/past its target date/);
  });

  it('is blank when not due to start yet', () => {
    expect(at(0, new Date('2025-12-15')).key).toBe('blank');
    expect(at(0, new Date('2025-12-15')).bar).toBe('bg-transparent');
    expect(at(0, new Date('2025-12-15')).reason).toBe('Not started · not due to start yet');
    expect(at(5, new Date('2025-12-15')).key).toBe('green');
  });

  it('without usable dates shows work in progress as yellow', () => {
    const noDates = (actual: number) => progressTone({ actual, now: midYear }).key;
    expect([noDates(0), noDates(1), noDates(50), noDates(99), noDates(100)]).toEqual([
      'blank',
      'yellow',
      'yellow',
      'yellow',
      'green',
    ]);
    expect(progressTone({ actual: 60, start: finish, finish: start, now: midYear }).key).toBe('yellow');
  });
});

describe('project and stage bars', () => {
  it('uses a project start and target date', () => {
    const tone = projectProgressTone({ progress: 20, startDate: start, targetDate: finish }, midYear);
    expect(tone.key).toBe('red');
  });

  it('uses a stage planned dates, and a blocked stage is always red', () => {
    const phase = { progress: 50, plannedStart: start, plannedFinish: finish, status: 'active' as const };
    expect(stageProgressTone(phase, midYear).key).toBe('yellow');
    expect(stageProgressTone({ ...phase, status: 'blocked' }, midYear).key).toBe('red');
    expect(stageProgressTone({ ...phase, progress: 100, status: 'blocked' }, midYear).reason).toBe(
      '100% done · blocked',
    );
  });
});
