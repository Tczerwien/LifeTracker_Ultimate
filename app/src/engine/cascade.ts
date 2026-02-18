import type {
  ScoringInput,
  ScoringConfig,
  ScoringOutput,
  DailyLogRow,
  CascadeUpdate,
} from '../types/engine';
import { computeScores, computeStreak, computeFinalScore } from './scoring';

// ---------------------------------------------------------------------------
// Helper: Previous Calendar Day
// ---------------------------------------------------------------------------

/**
 * Returns the YYYY-MM-DD string for the calendar day before `dateStr`.
 * Uses local date construction to avoid timezone-related date shifts.
 */
function previousCalendarDay(dateStr: string): string {
  const parts = dateStr.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];

  if (yearStr === undefined || monthStr === undefined || dayStr === undefined) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - 1);

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ---------------------------------------------------------------------------
// Helper: Check if all 5 scores match
// ---------------------------------------------------------------------------

function scoresMatch(row: DailyLogRow, output: ScoringOutput): boolean {
  return (
    row.positive_score === output.positiveScore &&
    row.vice_penalty === output.vicePenalty &&
    row.base_score === output.baseScore &&
    row.streak === output.streak &&
    row.final_score === output.finalScore
  );
}

// ---------------------------------------------------------------------------
// Public API: computeCascade
// ---------------------------------------------------------------------------

/**
 * Computes the cascade of score updates when a daily log entry is edited.
 *
 * Pure function: receives data, returns updates. No database interaction.
 * The Rust backend (Phase 5.5) calls this inside a transaction.
 *
 * @param editedDate - The YYYY-MM-DD date that was edited.
 * @param allLogs - Daily log rows including the edited day, all subsequent days,
 *   and optionally prior days (for previousStreak determination). Need not be sorted.
 * @param config - Current scoring config.
 * @param buildScoringInput - Callback that converts a DailyLogRow + previousStreak
 *   into a ScoringInput. Decouples cascade from habit config / dropdown resolution.
 * @returns Array of CascadeUpdate objects for every day whose scores changed.
 *   The first element (if any) is the edited day with all 5 scores populated.
 *   Subsequent elements carry only streak + finalScore.
 *   Returns an empty array if recomputed values match stored values everywhere.
 */
export function computeCascade(
  editedDate: string,
  allLogs: DailyLogRow[],
  config: ScoringConfig,
  buildScoringInput: (row: DailyLogRow, previousStreak: number) => ScoringInput,
): CascadeUpdate[] {
  // 1. Sort defensively to guarantee ascending date order
  const sorted = [...allLogs].sort((a, b) => a.date.localeCompare(b.date));

  // 2. Find the edited row
  const editedIndex = sorted.findIndex((r) => r.date === editedDate);
  if (editedIndex === -1) {
    throw new Error(`Edited date ${editedDate} not found in allLogs`);
  }
  const editedRow = sorted[editedIndex]!;

  // 3. Determine previousStreak for the edited day
  let previousStreak: number;
  const prevDay = previousCalendarDay(editedDate);

  // Look for the last row before editedDate
  let priorRow: DailyLogRow | undefined;
  for (let i = editedIndex - 1; i >= 0; i--) {
    const row = sorted[i];
    if (row !== undefined && row.date < editedDate) {
      priorRow = row;
      break;
    }
  }

  if (priorRow === undefined) {
    // No prior rows at all → Day 1 convention
    previousStreak = -1;
  } else if (priorRow.date === prevDay) {
    // Consecutive day → use its streak
    previousStreak = priorRow.streak ?? 0;
  } else {
    // Gap → gap convention
    previousStreak = 0;
  }

  // 4. Recompute all 5 scores for the edited day
  const scoringInput = buildScoringInput(editedRow, previousStreak);
  const recomputed: ScoringOutput = computeScores(scoringInput);

  // 5. Early exit: if ALL 5 recomputed scores match stored, check forward convergence
  const editedDayUnchanged = scoresMatch(editedRow, recomputed);

  // Collect subsequent rows
  const subsequentRows: DailyLogRow[] = [];
  for (let i = editedIndex + 1; i < sorted.length; i++) {
    const row = sorted[i];
    if (row !== undefined) {
      subsequentRows.push(row);
    }
  }

  // If edited day unchanged and no subsequent days, nothing to do
  if (editedDayUnchanged && subsequentRows.length === 0) {
    return [];
  }

  // If edited day unchanged, check if forward walk also converges immediately
  if (editedDayUnchanged && subsequentRows.length > 0) {
    const firstSubsequent = subsequentRows[0]!;

    // Determine prevStreak for first subsequent day
    let firstPrevStreak: number;
    if (previousCalendarDay(firstSubsequent.date) === editedDate) {
      firstPrevStreak = recomputed.streak;
    } else {
      firstPrevStreak = 0; // gap
    }

    if (firstSubsequent.base_score !== null) {
      const checkStreak = computeStreak(
        firstSubsequent.base_score,
        firstPrevStreak,
        config.streak_threshold,
      );
      const checkFinal = computeFinalScore(
        firstSubsequent.base_score,
        checkStreak,
        config.streak_bonus_per_day,
        config.max_streak_bonus,
      );

      if (
        checkStreak === firstSubsequent.streak &&
        checkFinal === firstSubsequent.final_score
      ) {
        return []; // Full convergence — nothing changed
      }
    }
  }

  // 6. Build updates array — start with edited day (all 5 scores)
  const updates: CascadeUpdate[] = [];

  if (!editedDayUnchanged) {
    updates.push({
      date: editedDate,
      streak: recomputed.streak,
      finalScore: recomputed.finalScore,
      positiveScore: recomputed.positiveScore,
      vicePenalty: recomputed.vicePenalty,
      baseScore: recomputed.baseScore,
    });
  }

  // 7. Forward walk through subsequent days
  let lastProcessedDate = editedDate;
  let lastStreak = recomputed.streak;

  for (const row of subsequentRows) {
    // Gap detection
    const prevDayOfRow = previousCalendarDay(row.date);
    const prevStreak =
      prevDayOfRow === lastProcessedDate ? lastStreak : 0; // gap → 0

    // Null guard: unscored day halts the walk
    if (row.base_score === null) {
      break;
    }

    const newStreak = computeStreak(
      row.base_score,
      prevStreak,
      config.streak_threshold,
    );
    const newFinal = computeFinalScore(
      row.base_score,
      newStreak,
      config.streak_bonus_per_day,
      config.max_streak_bonus,
    );

    // Convergence check
    if (newStreak === row.streak && newFinal === row.final_score) {
      break;
    }

    updates.push({
      date: row.date,
      streak: newStreak,
      finalScore: newFinal,
    });

    lastProcessedDate = row.date;
    lastStreak = newStreak;
  }

  return updates;
}
