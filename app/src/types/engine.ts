import { HabitCategory, PenaltyMode } from './enums';
import type { DailyLog } from './models';

// ---------------------------------------------------------------------------
// Scoring Engine I/O
// ---------------------------------------------------------------------------

/** Input to the scoring engine — resolved numeric values, not raw DB rows */
export interface ScoringInput {
  habitValues: {
    name: string;
    value: number;
    points: number;
    category: HabitCategory;
  }[];
  viceValues: {
    name: string;
    triggered: boolean;
    count?: number;
    penaltyValue: number;
    penaltyMode: PenaltyMode;
  }[];
  phoneMinutes: number;
  previousStreak: number;
  config: ScoringConfig;
}

/** Config subset the scoring engine needs */
export interface ScoringConfig {
  multiplier_productivity: number;
  multiplier_health: number;
  multiplier_growth: number;
  target_fraction: number;
  vice_cap: number;
  streak_threshold: number;
  streak_bonus_per_day: number;
  max_streak_bonus: number;
  phone_t1_min: number;
  phone_t2_min: number;
  phone_t3_min: number;
  phone_t1_penalty: number;
  phone_t2_penalty: number;
  phone_t3_penalty: number;
}

/** Output from the scoring engine — all 5 daily scores */
export interface ScoringOutput {
  positiveScore: number;
  vicePenalty: number;
  baseScore: number;
  streak: number;
  finalScore: number;
}

// ---------------------------------------------------------------------------
// Cascade
// ---------------------------------------------------------------------------

/** Minimal daily-log row for cascade computation. Omits DB metadata fields. */
export type DailyLogRow = Omit<DailyLog, 'id' | 'logged_at' | 'last_modified'>;

/** Output from cascade computation — one entry per day that changed. */
export interface CascadeUpdate {
  date: string;
  streak: number;
  finalScore: number;
  /** Present only for the edited day (first element in the returned array) */
  positiveScore?: number;
  vicePenalty?: number;
  baseScore?: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validation result from config/habit validators */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
  value: unknown;
}

export interface ValidationWarning {
  field: string;
  rule: string;
  message: string;
  value: unknown;
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

/** Correlation engine output */
export interface CorrelationResult {
  habit: string;
  r: number | null;
  pValue?: number;
  n: number;
  flag?: string;
}
