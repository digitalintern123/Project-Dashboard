import type { Phase, Project } from '@/data/projects';
import { parseIsoDate } from '@/lib/date';

/**
 * Progress bar colour: actual % compared with where the work should be today,
 * on a straight line from its start date to its target (or planned finish)
 * date.
 *
 * - green: 100% done, on/ahead of plan, up to 10 points behind, or not due
 *   to start yet
 * - amber: 10–25 points behind
 * - red: more than 25 behind, past its date and not done, or a blocked stage
 *
 * Without usable dates there is no plan to compare with, so the colour falls
 * back to the % alone: 0–24 red, 25–49 amber, 50–100 green.
 */
export type ProgressToneKey = 'green' | 'amber' | 'red';

export type ProgressTone = {
  key: ProgressToneKey;
  /** Tailwind class for the bar fill. */
  bar: string;
  /** Plain-language reason, for the bar's tooltip. */
  reason: string;
};

const BAR: Record<ProgressToneKey, string> = {
  green: 'bg-[#3d9a7e]',
  amber: 'bg-[#d19b35]',
  red: 'bg-[#d66254]',
};

const DAY = 24 * 60 * 60 * 1000;

const tone = (key: ProgressToneKey, reason: string): ProgressTone => ({ key, bar: BAR[key], reason });

export function progressTone({
  actual,
  start,
  finish,
  blocked = false,
  now = new Date(),
}: {
  actual: number;
  start?: string | null;
  finish?: string | null;
  blocked?: boolean;
  now?: Date;
}): ProgressTone {
  const pct = Math.round(Math.max(0, Math.min(100, Number(actual) || 0)));
  if (blocked) return tone('red', `${pct}% done · blocked`);
  if (pct >= 100) return tone('green', '100% done');

  const startAt = parseIsoDate(start);
  const finishAt = parseIsoDate(finish);
  if (startAt && finishAt && finishAt > startAt) {
    if (pct === 0 && now < startAt) return tone('green', 'Not started · not due to start yet');
    // Dates are parsed at midday; the target day counts until it ends.
    if (now.getTime() > finishAt.getTime() + DAY / 2) return tone('red', `${pct}% done · past its target date`);
    const fraction = (now.getTime() - startAt.getTime()) / (finishAt.getTime() - startAt.getTime());
    const planned = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    const gap = planned - pct;
    const where = gap > 0 ? `${gap} points behind` : gap < 0 ? `${-gap} points ahead` : 'on plan';
    const reason = `${pct}% done · planned ${planned}% by today · ${where}`;
    if (gap <= 10) return tone('green', reason);
    if (gap <= 25) return tone('amber', reason);
    return tone('red', reason);
  }

  const reason = `${pct}% done · no planned dates, so coloured by progress`;
  if (pct < 25) return tone('red', reason);
  if (pct < 50) return tone('amber', reason);
  return tone('green', reason);
}

/** A project's bar: its start date to its target completion date. */
export const projectProgressTone = (project: Pick<Project, 'progress' | 'startDate' | 'targetDate'>, now?: Date) =>
  progressTone({ actual: project.progress, start: project.startDate, finish: project.targetDate, now });

/** A stage's bar: its planned start to planned finish; a blocked stage is always red. */
export const stageProgressTone = (
  phase: Pick<Phase, 'progress' | 'plannedStart' | 'plannedFinish' | 'status'>,
  now?: Date,
) =>
  progressTone({
    actual: phase.progress,
    start: phase.plannedStart,
    finish: phase.plannedFinish,
    blocked: phase.status === 'blocked',
    now,
  });
