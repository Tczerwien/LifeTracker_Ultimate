import { HabitCategory, ApplicationStatus } from '../types/enums';
import type { AppConfig } from '../types/models';

// ---------------------------------------------------------------------------
// Default Config — seed values from CONFIG_SCHEMA.md Section 3
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: Readonly<
  Omit<AppConfig, 'id' | 'dropdown_options' | 'last_modified'>
> = {
  start_date: '2026-01-20',
  multiplier_productivity: 1.5,
  multiplier_health: 1.3,
  multiplier_growth: 1.0,
  target_fraction: 0.85,
  vice_cap: 0.40,
  streak_threshold: 0.65,
  streak_bonus_per_day: 0.01,
  max_streak_bonus: 0.10,
  phone_t1_min: 61,
  phone_t2_min: 181,
  phone_t3_min: 301,
  phone_t1_penalty: 0.03,
  phone_t2_penalty: 0.07,
  phone_t3_penalty: 0.12,
  correlation_window_days: 90,
} as const;

// ---------------------------------------------------------------------------
// Category Colors — UI_SPEC.md Section 8
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Readonly<Record<HabitCategory, string>> = {
  [HabitCategory.Productivity]: '#3D85C6',
  [HabitCategory.Health]: '#6AA84F',
  [HabitCategory.Growth]: '#8E7CC3',
} as const;

export const VICE_COLOR = '#CC4125';

// ---------------------------------------------------------------------------
// Score Gradient — 3-stop linear interpolation
// ---------------------------------------------------------------------------

export const SCORE_GRADIENT = [
  { stop: 0.0, color: '#CC4125' },
  { stop: 0.5, color: '#FFD966' },
  { stop: 1.0, color: '#6AA84F' },
] as const;

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

export const STREAK_GOLD = '#FFD700';

// ---------------------------------------------------------------------------
// Category → Multiplier Field Mapping
// ---------------------------------------------------------------------------

export const CATEGORY_MULTIPLIER_KEYS: Readonly<
  Record<HabitCategory, keyof AppConfig>
> = {
  [HabitCategory.Productivity]: 'multiplier_productivity',
  [HabitCategory.Health]: 'multiplier_health',
  [HabitCategory.Growth]: 'multiplier_growth',
} as const;

// ---------------------------------------------------------------------------
// Application Status Display — UI_SPEC.md Section 5.5
// ---------------------------------------------------------------------------

export const APPLICATION_STATUS_DISPLAY: Readonly<
  Record<ApplicationStatus, { label: string; color: string }>
> = {
  [ApplicationStatus.Applied]: { label: 'Applied', color: '#3D85C6' },
  [ApplicationStatus.PhoneScreen]: { label: 'Phone Screen', color: '#F59E0B' },
  [ApplicationStatus.Interview]: { label: 'Interview', color: '#8E7CC3' },
  [ApplicationStatus.TechnicalScreen]: {
    label: 'Technical Screen',
    color: '#0D9488',
  },
  [ApplicationStatus.Offer]: { label: 'Offer', color: '#6AA84F' },
  [ApplicationStatus.Rejected]: { label: 'Rejected', color: '#CC4125' },
  [ApplicationStatus.Withdrawn]: { label: 'Withdrawn', color: '#6B7280' },
  [ApplicationStatus.NoResponse]: { label: 'No Response', color: '#9CA3AF' },
} as const;
