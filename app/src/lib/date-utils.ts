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
