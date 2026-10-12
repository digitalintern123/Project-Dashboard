import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  DATE_PLACEHOLDER,
  formatDayMonth,
  formatFullDate,
  greetingForNow,
  isValidIsoDate,
  parseIsoDate,
  todayIso,
  todayLabel,
  todayLongLabel,
} from '@/lib/date';

afterEach(() => vi.useRealTimers());

describe('date helpers', () => {
  it('parses ISO dates at local noon, so they never roll over a day', () => {
    const d = parseIsoDate('2026-09-21')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 21, 12]);
  });

  it('parses other date strings loosely and rejects garbage', () => {
    expect(parseIsoDate('Sep 21, 2026')?.getFullYear()).toBe(2026);
    expect(parseIsoDate('not a date')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
    expect(isValidIsoDate('2026-02-30')).toBe(true); // JS rolls it over rather than failing
    expect(isValidIsoDate('nope')).toBe(false);
  });

  it('formats dates and uses a placeholder for bad input', () => {
    expect(formatDayMonth('2026-09-21')).toBe('21 Sept');
    expect(formatFullDate('2026-09-21')).toBe('21 Sept 2026');
    expect(formatFullDate('')).toBe(DATE_PLACEHOLDER);
    expect(formatDayMonth(null)).toBe(DATE_PLACEHOLDER);
  });

  it('describes today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T09:30:00'));
    expect(todayIso()).toBe('2026-03-05');
    expect(todayLabel()).toBe('05 Mar 2026');
    expect(todayLongLabel()).toBe('Thursday, 5 March 2026');
  });

  it('greets by time of day', () => {
    expect(greetingForNow(new Date('2026-01-01T08:00:00'))).toBe('Good morning');
    expect(greetingForNow(new Date('2026-01-01T13:00:00'))).toBe('Good afternoon');
    expect(greetingForNow(new Date('2026-01-01T19:00:00'))).toBe('Good evening');
  });
});
