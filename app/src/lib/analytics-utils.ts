import type { AnalyticsWindow } from '../stores/ui-store';
import { todayYMD, addDays, parseYMD } from './date-utils';
import { DEFAULT_CONFIG } from './constants';

// ---------------------------------------------------------------------------
// Date Range
// ---------------------------------------------------------------------------

interface DateRange {
  start: string;
  end: string;
}

/**
 * Converts an analytics window selection to a start/end YYYY-MM-DD range.
 * For 'all', uses the app's configured start_date (fallback to DEFAULT_CONFIG).
 */
export function getAnalyticsDateRange(
  window: AnalyticsWindow,
  configStartDate?: string,
): DateRange {
  const end = todayYMD();

  switch (window) {
    case '7d':
      return { start: addDays(end, -6), end };
    case '30d':
      return { start: addDays(end, -29), end };
    case '90d':
      return { start: addDays(end, -89), end };
    case 'all':
      return { start: configStartDate ?? DEFAULT_CONFIG.start_date, end };
  }
}

// ---------------------------------------------------------------------------
// Empty-state thresholds
// ---------------------------------------------------------------------------

// Minimum logged days before each analytics section renders meaningful content.
// Below these thresholds the data is too sparse for the visualization to be
// useful, so we show an empty-state card instead.
//
// overview:
//   '7d': 7  — need a full week of data to fill the 7-day chart.
//   '30d': 14 — half the window; below this, averages and trends are noisy.
//   '90d': 14 — same rationale; a sparse 90-day chart is misleading.
//   all: 7    — at minimum one full week of tracking to draw any conclusions.
// trends: 7   — need >= 7 points for a trend line to show direction.
// correlations: 30 — Pearson's r needs 30+ paired observations for the
//   result to be practically meaningful in a habit-tracking context.
// records: 1  — personal records are valid with a single entry.
export const MIN_ENTRIES = {
  overview: { '7d': 7, '30d': 14, '90d': 14, all: 7 } as const,
  trends: 7,
  correlations: 30,
  records: 1,
} as const;

// ---------------------------------------------------------------------------
// Day-of-week helpers (DayOfWeekAvg.day is 0=Sun per SQLite strftime('%w'))
// ---------------------------------------------------------------------------

/** Mon→Sun rendering order for DayOfWeekAvg.day indices. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Labels matching DAY_ORDER. */
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ---------------------------------------------------------------------------
// Short date formatter
// ---------------------------------------------------------------------------

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

/** Format 'YYYY-MM-DD' as "Feb 17". */
export function formatShortDate(dateStr: string): string {
  return shortDateFormatter.format(parseYMD(dateStr));
}
