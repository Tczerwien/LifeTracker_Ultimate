/**
 * Timezone-safe date utilities for YYYY-MM-DD string manipulation.
 *
 * All functions work with local dates represented as 'YYYY-MM-DD' strings.
 * Internally, dates are constructed via `new Date(year, month - 1, day)`
 * to avoid the UTC-parsing trap of `new Date('2026-02-17')`.
 */

/** Parse a 'YYYY-MM-DD' string to a local-midnight Date. */
export function parseYMD(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(year, month - 1, day);
}

/** Format a Date to a 'YYYY-MM-DD' string. */
export function toYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Add (or subtract) N days from a 'YYYY-MM-DD' string. Returns 'YYYY-MM-DD'. */
export function addDays(dateStr: string, days: number): string {
  const date = parseYMD(dateStr);
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

const displayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/** Format 'YYYY-MM-DD' as 'Tuesday, February 17, 2026'. */
export function formatDisplayDate(dateStr: string): string {
  return displayFormatter.format(parseYMD(dateStr));
}

/** Get today as 'YYYY-MM-DD' in local time. */
export function todayYMD(): string {
  return toYMD(new Date());
}

/** Compare two 'YYYY-MM-DD' strings lexicographically. Returns -1, 0, or 1. */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Get the Monday (week start) of the week containing the given date. */
export function getWeekStart(dateStr: string): string {
  const date = parseYMD(dateStr);
  const day = date.getDay();
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat → offset to Monday
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toYMD(date);
}

/** Get the Sunday (week end) from a Monday week-start date. */
export function getWeekEnd(weekStart: string): string {
  return addDays(weekStart, 6);
}

const weekRangeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const weekRangeYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** Format a week range as "Feb 17 – Feb 23, 2026". */
export function formatWeekRange(start: string, end: string): string {
  const startDate = parseYMD(start);
  const endDate = parseYMD(end);
  const startStr = weekRangeFormatter.format(startDate);
  const endStr = weekRangeYearFormatter.format(endDate);
  return `${startStr} – ${endStr}`;
}

/** Compute ISO 8601 week number for a given 'YYYY-MM-DD' date string. */
export function getISOWeekNumber(dateStr: string): number {
  const date = parseYMD(dateStr);
  // Set to nearest Thursday: current date + 4 - day number (Mon=1, Sun=7)
  const dayOfWeek = date.getDay() || 7; // Convert Sun=0 to Sun=7
  date.setDate(date.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return weekNumber;
}

const snapshotDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const snapshotTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** Format an RFC 3339 timestamp as "Feb 16, 2026 at 11:42 PM". */
export function formatSnapshotTimestamp(rfc3339: string): string {
  const date = new Date(rfc3339);
  const dateStr = snapshotDateFormatter.format(date);
  const timeStr = snapshotTimeFormatter.format(date);
  return `${dateStr} at ${timeStr}`;
}

/**
 * Compute duration in minutes from two HH:MM time strings.
 * Handles midnight crossing (e.g. 23:00 → 01:00 = 120 min).
 */
export function computeDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number) as [number, number];
  const [eh, em] = endTime.split(':').map(Number) as [number, number];
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diff = endMin - startMin;
  return diff >= 0 ? diff : diff + 1440;
}
