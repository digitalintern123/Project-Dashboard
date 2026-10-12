import { parseIsoDate } from '@/lib/date';

/** Progress arrives from free-text edits and saved payloads, so clamp it. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Builds the donut gradient representing overall portfolio progress and health distribution. */
export function buildHealthGradient(stats: {
  total: number;
  averageProgress: number;
  onTrackCount: number;
  atRiskCount: number;
  delayedCount: number;
  notStartedCount: number;
}): string {
  const avg = Math.max(0, Math.min(100, stats.averageProgress));
  const trackColor = '#e4e4d9';

  if (stats.total === 0 || avg === 0) return trackColor;

  const activeCount = stats.onTrackCount + stats.atRiskCount + stats.delayedCount;

  // Fallback if no projects are marked onTrack/atRisk/delayed yet:
  if (activeCount === 0) {
    return `conic-gradient(#3d9a7e 0% ${avg}%, ${trackColor} ${avg}% 100%)`;
  }

  const segments: [string, number][] = [
    ['#3d9a7e', stats.onTrackCount],
    ['#d19b35', stats.atRiskCount],
    ['#d66254', stats.delayedCount],
  ];

  const stops: string[] = [];
  let cursor = 0;
  for (const [colour, count] of segments) {
    if (count <= 0) continue;
    const slice = (count / activeCount) * avg;
    const end = cursor + slice;
    stops.push(`${colour} ${cursor.toFixed(1)}% ${end.toFixed(1)}%`);
    cursor = end;
  }

  if (cursor < 100) {
    stops.push(`${trackColor} ${cursor.toFixed(1)}% 100%`);
  }

  return `conic-gradient(${stops.join(', ')})`;
}

/** Describes how soon a milestone falls, relative to today. */
export function milestoneWindowLabel(isoDate: string): string {
  const target = parseIsoDate(isoDate);
  if (!target) return 'Date not set';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - startOfToday.getTime()) / 86400000);

  if (days < 0) return 'Overdue';
  if (days <= 7) return 'This week';
  if (days <= 30) return 'Next 30 days';
  return 'Later';
}
