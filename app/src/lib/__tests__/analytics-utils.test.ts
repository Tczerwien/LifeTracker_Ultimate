import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAnalyticsDateRange,
  formatShortDate,
  DAY_ORDER,
  DAY_LABELS,
  MIN_ENTRIES,
} from '../analytics-utils';
import { DEFAULT_CONFIG } from '../constants';

// Fix "today" to 2026-02-19 for deterministic tests
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 1, 19)); // Feb 19, 2026
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getAnalyticsDateRange', () => {
  it('returns last 7 days for "7d"', () => {
    const { start, end } = getAnalyticsDateRange('7d');
    expect(end).toBe('2026-02-19');
    expect(start).toBe('2026-02-13'); // 19 - 6 = 13
  });

  it('returns last 30 days for "30d"', () => {
    const { start, end } = getAnalyticsDateRange('30d');
    expect(end).toBe('2026-02-19');
    expect(start).toBe('2026-01-21'); // 19 - 29 = Jan 21
  });

  it('returns last 90 days for "90d"', () => {
    const { start, end } = getAnalyticsDateRange('90d');
    expect(end).toBe('2026-02-19');
    expect(start).toBe('2025-11-22'); // 89 days before Feb 19
  });

  it('uses configStartDate for "all" when provided', () => {
    const { start, end } = getAnalyticsDateRange('all', '2025-06-01');
    expect(end).toBe('2026-02-19');
    expect(start).toBe('2025-06-01');
  });

  it('falls back to DEFAULT_CONFIG.start_date for "all" when no configStartDate', () => {
    const { start, end } = getAnalyticsDateRange('all');
    expect(end).toBe('2026-02-19');
    expect(start).toBe(DEFAULT_CONFIG.start_date);
  });
});

describe('formatShortDate', () => {
  it('formats YYYY-MM-DD as "Mon DD"', () => {
    expect(formatShortDate('2026-02-17')).toBe('Feb 17');
  });

  it('formats single-digit day without leading zero', () => {
    expect(formatShortDate('2026-03-05')).toBe('Mar 5');
  });
});

describe('constants', () => {
  it('DAY_ORDER has 7 entries starting with Monday (1)', () => {
    expect(DAY_ORDER).toHaveLength(7);
    expect(DAY_ORDER[0]).toBe(1); // Monday
    expect(DAY_ORDER[6]).toBe(0); // Sunday
  });

  it('DAY_LABELS matches DAY_ORDER length', () => {
    expect(DAY_LABELS).toHaveLength(7);
    expect(DAY_LABELS[0]).toBe('Mon');
    expect(DAY_LABELS[6]).toBe('Sun');
  });

  it('MIN_ENTRIES has expected thresholds', () => {
    expect(MIN_ENTRIES.overview['7d']).toBe(7);
    expect(MIN_ENTRIES.overview['30d']).toBe(14);
    expect(MIN_ENTRIES.trends).toBe(7);
    expect(MIN_ENTRIES.correlations).toBe(30);
    expect(MIN_ENTRIES.records).toBe(1);
  });
});
