/**
 * Date formatting helpers.
 *
 * Every function here accepts untrusted input (a cleared `<input type="date">`
 * yields `''`, and localStorage can hold anything) and returns a placeholder
 * instead of throwing. `Intl.DateTimeFormat#format` raises a RangeError on an
 * Invalid Date, which previously crashed the project-detail and new-project
 * forms.
 */

const DAY_MONTH_YEAR = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DAY_MONTH = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
});

const WEEKDAY_LONG = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const DATE_PLACEHOLDER = '—';

/** Parses an ISO `yyyy-mm-dd` string at local noon, avoiding timezone rollover. */
export function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const loose = new Date(trimmed);
    return Number.isNaN(loose.getTime()) ? null : loose;
  }
  const parsed = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isValidIsoDate(value: string | undefined | null): boolean {
  return parseIsoDate(value) !== null;
}

/** `2026-09-21` -> `21 Sep`. Returns `—` for anything unparseable. */
export function formatDayMonth(value: string | undefined | null): string {
  const parsed = parseIsoDate(value);
  return parsed ? DAY_MONTH.format(parsed) : DATE_PLACEHOLDER;
}

/** `2026-09-21` -> `21 Sep 2026`. Returns `—` for anything unparseable. */
export function formatFullDate(value: string | undefined | null): string {
  const parsed = parseIsoDate(value);
  return parsed ? DAY_MONTH_YEAR.format(parsed) : DATE_PLACEHOLDER;
}

/** Today as `21 Sep 2026` — used as the audit stamp on every mutation. */
export function todayLabel(): string {
  return DAY_MONTH_YEAR.format(new Date());
}

/** Today as `2026-09-21`, for `<input type="date">` defaults. */
export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Today as `Monday, 21 September 2026` — the dashboard header line. */
export function todayLongLabel(): string {
  return WEEKDAY_LONG.format(new Date());
}

export function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
