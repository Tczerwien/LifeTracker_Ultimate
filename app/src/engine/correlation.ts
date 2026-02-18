import { HabitPool, InputType } from '../types/enums';
import type { DailyLogRow, CorrelationResult } from '../types/engine';
import type { HabitConfig } from '../types/models';

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

type OptionsMap = Record<string, number>;

/** Safely parses options_json into a label → numeric-value map. */
function parseOptionsJson(optionsJson: string | null): OptionsMap | null {
  if (optionsJson === null) return null;
  try {
    const parsed: unknown = JSON.parse(optionsJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as OptionsMap;
  } catch {
    return null;
  }
}

/**
 * Extracts the numeric value for a single habit from a DailyLogRow.
 *
 * Checkbox / Number habits return the raw numeric value.
 * Dropdown habits resolve the stored text key to a number via options_json.
 * Returns null if the value is missing or unresolvable.
 */
function getHabitNumericValue(
  row: DailyLogRow,
  config: HabitConfig,
): number | null {
  const rawValue = (row as Record<string, unknown>)[config.column_name];

  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  switch (config.input_type) {
    case InputType.Checkbox:
    case InputType.Number:
      if (typeof rawValue !== 'number') return null;
      return rawValue;

    case InputType.Dropdown: {
      if (typeof rawValue !== 'string') return null;
      const map = parseOptionsJson(config.options_json);
      if (map === null) return null;
      const resolved = map[rawValue];
      if (resolved === undefined) return null;
      return resolved;
    }

    default: {
      const _exhaustive: never = config.input_type;
      return _exhaustive;
    }
  }
}

/**
 * Computes Pearson's r for two equal-length numeric arrays.
 * Caller must ensure x.length === y.length and both have at least 7 elements.
 * Returns 0 instead of NaN when denominator is zero.
 */
function pearsonR(x: number[], y: number[]): number {
  const n = x.length;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY),
  );

  if (denominator === 0 || !Number.isFinite(denominator)) {
    return 0;
  }

  const r = numerator / denominator;

  if (!Number.isFinite(r)) {
    return 0;
  }

  return r;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const MIN_DATA_POINTS = 7;

/**
 * Computes Pearson's r between each active good habit and the daily final_score.
 *
 * Per ADR-003 SD2, this computation stays in TypeScript (not Rust). It receives
 * pre-fetched DailyLogRow[] from the Rust IPC command.
 *
 * @param logs - Daily log rows covering the correlation window.
 * @param habitConfigs - All habit configs (active + retired; filtering happens here).
 * @returns Array of CorrelationResult sorted by |r| descending.
 */
export function computeCorrelations(
  logs: DailyLogRow[],
  habitConfigs: HabitConfig[],
): CorrelationResult[] {
  // Step 1: Filter to active, non-retired, good-pool habits
  const qualifyingHabits = habitConfigs.filter(
    (c) =>
      c.is_active === true &&
      c.pool === HabitPool.Good &&
      c.retired_at === null,
  );

  // Step 2: Early exit
  if (logs.length === 0 || qualifyingHabits.length === 0) {
    return [];
  }

  const results: CorrelationResult[] = [];

  // Step 3–6: Compute correlation for each qualifying habit
  for (const config of qualifyingHabits) {
    const xValues: number[] = [];
    const yValues: number[] = [];

    for (const row of logs) {
      const x = getHabitNumericValue(row, config);
      const y = row.final_score;

      if (x !== null && y !== null) {
        xValues.push(x);
        yValues.push(y);
      }
    }

    const n = xValues.length;

    // Insufficient data
    if (n < MIN_DATA_POINTS) {
      results.push({ habit: config.name, r: null, n, flag: 'insufficient_data' });
      continue;
    }

    // Zero variance in habit values
    const firstX = xValues[0]!;
    if (xValues.every((v) => v === firstX)) {
      results.push({ habit: config.name, r: 0, n, flag: 'zero_variance' });
      continue;
    }

    // Compute Pearson's r
    const r = pearsonR(xValues, yValues);
    results.push({ habit: config.name, r, n });
  }

  // Step 7: Sort by |r| descending, nulls last
  results.sort((a, b) => {
    const absA = a.r === null ? -1 : Math.abs(a.r);
    const absB = b.r === null ? -1 : Math.abs(b.r);
    return absB - absA;
  });

  return results;
}
