import {
  HabitPool,
  HabitCategory,
  InputType,
  PenaltyMode,
} from '../../types/enums';
import type { HabitConfig } from '../../types/models';
import type { DailyLogInput } from '../../types/commands';
import type {
  ScoringConfig,
  ScoringInput,
  DailyLogRow,
} from '../../types/engine';

// ---------------------------------------------------------------------------
// Scoring Config Factory
// ---------------------------------------------------------------------------

export function makeDefaultConfig(
  overrides?: Partial<ScoringConfig>,
): ScoringConfig {
  return {
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
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DailyLogInput Factory
// ---------------------------------------------------------------------------

export function makeDailyLogInput(
  overrides?: Partial<DailyLogInput>,
): DailyLogInput {
  return {
    date: '2026-02-20',
    // Productivity
    schoolwork: 0,
    personal_project: 0,
    classes: 0,
    job_search: 0,
    // Health
    gym: 0,
    sleep_7_9h: 0,
    wake_8am: 0,
    supplements: 0,
    meal_quality: 'None',
    stretching: 0,
    // Growth
    meditate: 0,
    read: 0,
    social: 'None',
    // Vices
    porn: 0,
    masturbate: 0,
    weed: 0,
    skip_class: 0,
    binged_content: 0,
    gaming_1h: 0,
    past_12am: 0,
    late_wake: 0,
    phone_use: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HabitConfig Seed Data (all 22 habits, matching DATA_MODEL.md)
// ---------------------------------------------------------------------------

export function makeHabitConfigs(): HabitConfig[] {
  const now = '2026-01-01T00:00:00Z';
  return [
    // --- Productivity (4 good habits) ---
    {
      id: 1, name: 'schoolwork', display_name: 'Schoolwork',
      pool: HabitPool.Good, category: HabitCategory.Productivity,
      input_type: InputType.Checkbox, points: 3, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 1, is_active: true, column_name: 'schoolwork',
      created_at: now, retired_at: null,
    },
    {
      id: 2, name: 'personal_project', display_name: 'Personal Project',
      pool: HabitPool.Good, category: HabitCategory.Productivity,
      input_type: InputType.Checkbox, points: 3, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 2, is_active: true, column_name: 'personal_project',
      created_at: now, retired_at: null,
    },
    {
      id: 3, name: 'classes', display_name: 'Classes',
      pool: HabitPool.Good, category: HabitCategory.Productivity,
      input_type: InputType.Checkbox, points: 2, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 3, is_active: true, column_name: 'classes',
      created_at: now, retired_at: null,
    },
    {
      id: 4, name: 'job_search', display_name: 'Job Search',
      pool: HabitPool.Good, category: HabitCategory.Productivity,
      input_type: InputType.Checkbox, points: 2, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 4, is_active: true, column_name: 'job_search',
      created_at: now, retired_at: null,
    },
    // --- Health (6 good habits) ---
    {
      id: 5, name: 'gym', display_name: 'Gym',
      pool: HabitPool.Good, category: HabitCategory.Health,
      input_type: InputType.Checkbox, points: 3, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 1, is_active: true, column_name: 'gym',
      created_at: now, retired_at: null,
    },
    {
      id: 6, name: 'sleep_7_9h', display_name: 'Sleep 7-9h',
      pool: HabitPool.Good, category: HabitCategory.Health,
      input_type: InputType.Checkbox, points: 2, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 2, is_active: true, column_name: 'sleep_7_9h',
      created_at: now, retired_at: null,
    },
    {
      id: 7, name: 'wake_8am', display_name: 'Wake by 8am',
      pool: HabitPool.Good, category: HabitCategory.Health,
      input_type: InputType.Checkbox, points: 1, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 3, is_active: true, column_name: 'wake_8am',
      created_at: now, retired_at: null,
    },
    {
      id: 8, name: 'supplements', display_name: 'Supplements',
      pool: HabitPool.Good, category: HabitCategory.Health,
      input_type: InputType.Checkbox, points: 1, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 4, is_active: true, column_name: 'supplements',
      created_at: now, retired_at: null,
    },
    {
      id: 9, name: 'meal_quality', display_name: 'Meal Quality',
      pool: HabitPool.Good, category: HabitCategory.Health,
      input_type: InputType.Dropdown, points: 3, penalty: 0,
      penalty_mode: PenaltyMode.Flat,
      options_json: '{"Poor":0,"Okay":1,"Good":2,"Great":3}',
      sort_order: 5, is_active: true, column_name: 'meal_quality',
      created_at: now, retired_at: null,
    },
    {
      id: 10, name: 'stretching', display_name: 'Stretching',
      pool: HabitPool.Good, category: HabitCategory.Health,
      input_type: InputType.Checkbox, points: 1, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 6, is_active: true, column_name: 'stretching',
      created_at: now, retired_at: null,
    },
    // --- Growth (3 good habits) ---
    {
      id: 11, name: 'meditate', display_name: 'Meditate',
      pool: HabitPool.Good, category: HabitCategory.Growth,
      input_type: InputType.Checkbox, points: 1, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 1, is_active: true, column_name: 'meditate',
      created_at: now, retired_at: null,
    },
    {
      id: 12, name: 'read', display_name: 'Read',
      pool: HabitPool.Good, category: HabitCategory.Growth,
      input_type: InputType.Checkbox, points: 1, penalty: 0,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 2, is_active: true, column_name: 'read',
      created_at: now, retired_at: null,
    },
    {
      id: 13, name: 'social', display_name: 'Social',
      pool: HabitPool.Good, category: HabitCategory.Growth,
      input_type: InputType.Dropdown, points: 2, penalty: 0,
      penalty_mode: PenaltyMode.Flat,
      options_json: '{"None":0,"Brief/Text":0.5,"Casual Hangout":1,"Meaningful Connection":2}',
      sort_order: 3, is_active: true, column_name: 'social',
      created_at: now, retired_at: null,
    },
    // --- Vices (9 habits) ---
    {
      id: 14, name: 'porn', display_name: 'Porn',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Number, points: 0, penalty: 0.25,
      penalty_mode: PenaltyMode.PerInstance, options_json: null,
      sort_order: 1, is_active: true, column_name: 'porn',
      created_at: now, retired_at: null,
    },
    {
      id: 15, name: 'masturbate', display_name: 'Masturbate',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.10,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 2, is_active: true, column_name: 'masturbate',
      created_at: now, retired_at: null,
    },
    {
      id: 16, name: 'weed', display_name: 'Weed',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.12,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 3, is_active: true, column_name: 'weed',
      created_at: now, retired_at: null,
    },
    {
      id: 17, name: 'skip_class', display_name: 'Skip Class',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.08,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 4, is_active: true, column_name: 'skip_class',
      created_at: now, retired_at: null,
    },
    {
      id: 18, name: 'binged_content', display_name: 'Binged Content',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.07,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 5, is_active: true, column_name: 'binged_content',
      created_at: now, retired_at: null,
    },
    {
      id: 19, name: 'gaming_1h', display_name: 'Gaming >1h',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.06,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 6, is_active: true, column_name: 'gaming_1h',
      created_at: now, retired_at: null,
    },
    {
      id: 20, name: 'past_12am', display_name: 'Past 12am',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.05,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 7, is_active: true, column_name: 'past_12am',
      created_at: now, retired_at: null,
    },
    {
      id: 21, name: 'late_wake', display_name: 'Late Wake',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Checkbox, points: 0, penalty: 0.03,
      penalty_mode: PenaltyMode.Flat, options_json: null,
      sort_order: 8, is_active: true, column_name: 'late_wake',
      created_at: now, retired_at: null,
    },
    {
      id: 22, name: 'phone_use', display_name: 'Phone (min)',
      pool: HabitPool.Vice, category: null,
      input_type: InputType.Number, points: 0, penalty: 0,
      penalty_mode: PenaltyMode.Tiered, options_json: null,
      sort_order: 9, is_active: true, column_name: 'phone_use',
      created_at: now, retired_at: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// Cross-validation bridge: DailyLogInput → ScoringInput
// Replicates Rust save_daily_log input-building logic in TypeScript
// ---------------------------------------------------------------------------

/**
 * Resolves a dropdown text key to its numeric value using options_json.
 * Mirrors Rust resolve_dropdown_value().
 */
function resolveDropdownValue(
  textKey: string,
  optionsJson: string | null,
): number {
  if (optionsJson === null) return 0;
  try {
    const parsed = JSON.parse(optionsJson) as Record<string, unknown>;
    const val = parsed[textKey];
    return typeof val === 'number' ? val : 0;
  } catch {
    return 0;
  }
}

/**
 * Extracts a numeric column value from a DailyLogInput by column name.
 * Mirrors Rust get_column_value_i64().
 */
function getColumnValueNumeric(
  input: DailyLogInput,
  columnName: string,
): number {
  const val = (input as unknown as Record<string, unknown>)[columnName];
  return typeof val === 'number' ? val : 0;
}

/**
 * Extracts a string column value from a DailyLogInput by column name.
 * Mirrors Rust get_column_value_string().
 */
function getColumnValueString(
  input: DailyLogInput,
  columnName: string,
): string {
  const val = (input as unknown as Record<string, unknown>)[columnName];
  return typeof val === 'string' ? val : 'None';
}

/**
 * Converts a raw DailyLogInput + HabitConfig[] + ScoringConfig into a ScoringInput.
 *
 * This is the CRITICAL CROSS-VALIDATION BRIDGE — it replicates the exact logic
 * that the Rust save_daily_log command uses to build ScoringInput from user input.
 * Any divergence between this function and the Rust version would be caught by
 * scoring-cross-validation.test.ts.
 */
export function buildScoringInputFromDailyLog(
  input: DailyLogInput,
  habitConfigs: HabitConfig[],
  config: ScoringConfig,
  previousStreak: number,
): ScoringInput {
  // 1. Build habitValues from good-pool active habits
  const habitValues: ScoringInput['habitValues'] = habitConfigs
    .filter((h) => h.pool === HabitPool.Good && h.is_active)
    .map((h) => {
      let value: number;

      switch (h.input_type) {
        case InputType.Checkbox: {
          const raw = getColumnValueNumeric(input, h.column_name);
          value = raw >= 1 ? h.points : 0;
          break;
        }
        case InputType.Dropdown: {
          const textKey = getColumnValueString(input, h.column_name);
          value = resolveDropdownValue(textKey, h.options_json);
          break;
        }
        default:
          value = 0;
      }

      return {
        name: h.name,
        value,
        points: h.points,
        category: h.category as HabitCategory,
      };
    });

  // 2. Build viceValues from vice-pool active habits
  const viceValues: ScoringInput['viceValues'] = habitConfigs
    .filter((h) => h.pool === HabitPool.Vice && h.is_active)
    .map((h) => {
      const raw = getColumnValueNumeric(input, h.column_name);

      switch (h.penalty_mode) {
        case PenaltyMode.Flat:
          return {
            name: h.name,
            triggered: raw >= 1,
            count: undefined,
            penaltyValue: h.penalty,
            penaltyMode: PenaltyMode.Flat,
          };
        case PenaltyMode.PerInstance:
          return {
            name: h.name,
            triggered: raw > 0,
            count: raw,
            penaltyValue: h.penalty,
            penaltyMode: PenaltyMode.PerInstance,
          };
        case PenaltyMode.Tiered:
          // Phone_use: penalty computed by scoring engine from config tiers
          return {
            name: h.name,
            triggered: false,
            count: undefined,
            penaltyValue: 0,
            penaltyMode: PenaltyMode.Tiered,
          };
        default:
          return {
            name: h.name,
            triggered: false,
            count: undefined,
            penaltyValue: 0,
            penaltyMode: h.penalty_mode,
          };
      }
    });

  return {
    habitValues,
    viceValues,
    phoneMinutes: input.phone_use,
    previousStreak,
    config,
  };
}

// ---------------------------------------------------------------------------
// DailyLogRow Factory (for cascade tests)
// ---------------------------------------------------------------------------

/**
 * Creates a DailyLogRow with all habits/vices at 0 and specific stored scores.
 * Mirrors makeRow() from cascade.test.ts.
 */
export function makeDailyLogRow(
  date: string,
  baseScore: number,
  streak: number,
  finalScore: number,
): DailyLogRow {
  return {
    date,
    schoolwork: 0,
    personal_project: 0,
    classes: 0,
    job_search: 0,
    gym: 0,
    sleep_7_9h: 0,
    wake_8am: 0,
    supplements: 0,
    meal_quality: 'None',
    stretching: 0,
    meditate: 0,
    read: 0,
    social: 'None',
    porn: 0,
    masturbate: 0,
    weed: 0,
    skip_class: 0,
    binged_content: 0,
    gaming_1h: 0,
    past_12am: 0,
    late_wake: 0,
    phone_use: 0,
    positive_score: baseScore,
    vice_penalty: 0,
    base_score: baseScore,
    streak,
    final_score: finalScore,
  };
}

// ---------------------------------------------------------------------------
// Mock Invoke Dispatcher
// ---------------------------------------------------------------------------

type MockHandler = (...args: unknown[]) => unknown;

/**
 * Configures a vi.fn() mock to dispatch invoke calls by command name.
 * Use with: vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
 */
export function configureMockInvoke(
  mockInvoke: ReturnType<typeof import('vitest').vi.fn>,
  handlers: Record<string, MockHandler>,
): void {
  mockInvoke.mockImplementation((command: string, ...args: unknown[]) => {
    const handler = handlers[command];
    if (handler === undefined) {
      return Promise.reject(
        new Error(`Unexpected invoke command: ${command}`),
      );
    }
    return Promise.resolve(handler(...args));
  });
}
