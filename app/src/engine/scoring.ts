import { HabitCategory, PenaltyMode } from '../types/enums';
import type { ScoringInput, ScoringConfig, ScoringOutput } from '../types/engine';

// ---------------------------------------------------------------------------
// Helper: Category → Multiplier
// ---------------------------------------------------------------------------

export function categoryMultiplier(
  category: HabitCategory,
  config: ScoringConfig,
): number {
  switch (category) {
    case HabitCategory.Productivity:
      return config.multiplier_productivity;
    case HabitCategory.Health:
      return config.multiplier_health;
    case HabitCategory.Growth:
      return config.multiplier_growth;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Max Weighted Sum (denominator basis)
// ---------------------------------------------------------------------------

export function computeMaxWeighted(
  habits: ScoringInput['habitValues'],
  config: ScoringConfig,
): number {
  return habits.reduce(
    (sum, h) => sum + h.points * categoryMultiplier(h.category, config),
    0,
  );
}

// ---------------------------------------------------------------------------
// Helper: Positive Score
// ---------------------------------------------------------------------------

export function computePositiveScore(
  habits: ScoringInput['habitValues'],
  maxWeighted: number,
  targetFraction: number,
  config: ScoringConfig,
): number {
  if (maxWeighted === 0) return 0; // DS7

  const target = maxWeighted * targetFraction;
  if (target === 0) return 0;

  const weightedSum = habits.reduce(
    (sum, h) => sum + h.value * categoryMultiplier(h.category, config),
    0,
  );

  return Math.min(1.0, weightedSum / target);
}

// ---------------------------------------------------------------------------
// Helper: Vice Penalty
// ---------------------------------------------------------------------------

export function computeVicePenalty(
  vices: ScoringInput['viceValues'],
  phoneMinutes: number,
  config: ScoringConfig,
): number {
  // E4/E5: sanitize phone input
  const safePhone =
    Number.isNaN(phoneMinutes) || phoneMinutes < 0 ? 0 : phoneMinutes;

  let sum = 0;

  for (const v of vices) {
    switch (v.penaltyMode) {
      case PenaltyMode.Flat:
        if (v.triggered) sum += v.penaltyValue;
        break;
      case PenaltyMode.PerInstance:
        sum += (v.count ?? 0) * v.penaltyValue;
        break;
      case PenaltyMode.Tiered:
        // Phone is handled separately via phoneMinutes — skip
        break;
      default: {
        const _exhaustive: never = v.penaltyMode;
        return _exhaustive;
      }
    }
  }

  // DS8: Phone tiers are mutually exclusive — highest qualifying tier wins
  if (safePhone >= config.phone_t3_min) {
    sum += config.phone_t3_penalty;
  } else if (safePhone >= config.phone_t2_min) {
    sum += config.phone_t2_penalty;
  } else if (safePhone >= config.phone_t1_min) {
    sum += config.phone_t1_penalty;
  }

  return Math.min(config.vice_cap, sum);
}

// ---------------------------------------------------------------------------
// Helper: Base Score
// ---------------------------------------------------------------------------

export function computeBaseScore(
  positiveScore: number,
  vicePenalty: number,
): number {
  return positiveScore * (1 - vicePenalty);
}

// ---------------------------------------------------------------------------
// Helper: Streak
// ---------------------------------------------------------------------------

export function computeStreak(
  baseScore: number,
  previousStreak: number,
  streakThreshold: number,
): number {
  // Day 1 convention: caller passes previousStreak = -1 → -1 + 1 = 0
  // Gap convention: caller passes previousStreak = 0 → 0 + 1 = 1
  if (baseScore >= streakThreshold) {
    return previousStreak + 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Helper: Final Score
// ---------------------------------------------------------------------------

export function computeFinalScore(
  baseScore: number,
  streak: number,
  streakBonusPerDay: number,
  maxStreakBonus: number,
): number {
  const streakMultiplier = Math.min(streak * streakBonusPerDay, maxStreakBonus);
  return Math.min(1.0, baseScore * (1 + streakMultiplier));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeScores(input: ScoringInput): ScoringOutput {
  const { habitValues, viceValues, phoneMinutes, previousStreak, config } =
    input;

  const maxWeighted = computeMaxWeighted(habitValues, config);
  const positiveScore = computePositiveScore(
    habitValues,
    maxWeighted,
    config.target_fraction,
    config,
  );
  const vicePenalty = computeVicePenalty(viceValues, phoneMinutes, config);
  const baseScore = computeBaseScore(positiveScore, vicePenalty);
  const streak = computeStreak(
    baseScore,
    previousStreak,
    config.streak_threshold,
  );
  const finalScore = computeFinalScore(
    baseScore,
    streak,
    config.streak_bonus_per_day,
    config.max_streak_bonus,
  );

  return { positiveScore, vicePenalty, baseScore, streak, finalScore };
}
