import type { AppConfig } from '../types/models';
import type { ValidationResult, ValidationError, ValidationWarning } from '../types/engine';
import { VALID_CORRELATION_WINDOWS } from '../types/enums';
import {
  DROPDOWN_OPTION_KEYS,
  READ_ONLY_DROPDOWN_KEYS,
  SEED_DROPDOWN_OPTIONS,
} from '../types/options';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function checkRange(
  errors: ValidationError[],
  field: string,
  rule: string,
  value: number,
  min: number,
  max: number,
  minExclusive: boolean,
  message: string,
): void {
  const aboveMin = minExclusive ? value > min : value >= min;
  if (!aboveMin || value > max) {
    errors.push({ field, rule, message, value });
  }
}

function checkIntegerRange(
  errors: ValidationError[],
  field: string,
  rule: string,
  value: number,
  min: number,
  max: number,
  message: string,
): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push({ field, rule, message, value });
  }
}

// ---------------------------------------------------------------------------
// validateDropdownOptions
// ---------------------------------------------------------------------------

/**
 * Validates a parsed dropdown_options object against CONFIG_SCHEMA.md Section 4.
 * Accepts `unknown` so callers can pass the result of JSON.parse directly.
 */
export function validateDropdownOptions(options: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Must be a non-null, non-array object
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    errors.push({
      field: 'dropdown_options',
      rule: 'R18',
      message: 'dropdown_options must be a valid JSON object',
      value: options,
    });
    return { valid: false, errors, warnings };
  }

  const record = options as Record<string, unknown>;

  // R25: No extra keys beyond the 15 required
  const knownKeys = new Set<string>(DROPDOWN_OPTION_KEYS);
  for (const key of Object.keys(record)) {
    if (!knownKeys.has(key)) {
      errors.push({
        field: 'dropdown_options',
        rule: 'R25',
        message: `dropdown_options contains unrecognized key: ${key}`,
        value: key,
      });
    }
  }

  // R19–R24: Per-key validation
  for (const key of DROPDOWN_OPTION_KEYS) {
    const value = record[key];

    // R19: Key must be present
    if (value === undefined) {
      errors.push({
        field: 'dropdown_options',
        rule: 'R19',
        message: `dropdown_options missing required key: ${key}`,
        value: undefined,
      });
      continue; // skip per-element checks for missing keys
    }

    // R20: Must be a non-empty array
    if (!Array.isArray(value)) {
      errors.push({
        field: `dropdown_options.${key}`,
        rule: 'R20',
        message: `dropdown_options.${key} must be a non-empty array`,
        value,
      });
      continue;
    }

    if (value.length === 0) {
      errors.push({
        field: `dropdown_options.${key}`,
        rule: 'R20',
        message: `dropdown_options.${key} must be a non-empty array`,
        value,
      });
      continue;
    }

    // R21: >= 2 items
    if (value.length < 2) {
      errors.push({
        field: `dropdown_options.${key}`,
        rule: 'R21',
        message: `dropdown_options.${key} must contain at least 2 options`,
        value,
      });
    }

    // R22: <= 50 items
    if (value.length > 50) {
      errors.push({
        field: `dropdown_options.${key}`,
        rule: 'R22',
        message: `dropdown_options.${key} cannot exceed 50 options`,
        value: value.length,
      });
    }

    // R23: Each item is a non-empty string <= 100 chars
    for (let i = 0; i < value.length; i++) {
      const item: unknown = value[i];
      if (typeof item !== 'string' || item.length === 0 || item.length > 100) {
        errors.push({
          field: `dropdown_options.${key}`,
          rule: 'R23',
          message: `dropdown_options.${key}[${i}] must be a non-empty string of at most 100 characters`,
          value: item,
        });
      }
    }

    // R24: No duplicates within array
    const seen = new Set<string>();
    for (const item of value) {
      if (typeof item === 'string') {
        if (seen.has(item)) {
          errors.push({
            field: `dropdown_options.${key}`,
            rule: 'R24',
            message: `dropdown_options.${key} contains duplicate option: '${item}'`,
            value: item,
          });
        }
        seen.add(item);
      }
    }

    // Read-only key enforcement: must exactly match seed values
    if (
      (READ_ONLY_DROPDOWN_KEYS as readonly string[]).includes(key)
    ) {
      const seedValue = SEED_DROPDOWN_OPTIONS[key];
      const matches =
        value.length === seedValue.length &&
        value.every(
          (item: unknown, i: number) => item === seedValue[i],
        );

      if (!matches) {
        errors.push({
          field: `dropdown_options.${key}`,
          rule: 'R_READONLY',
          message: `dropdown_options.${key} is read-only and must match seed values`,
          value,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

/**
 * Pure validation for AppConfig — hard-blocks invalid config before DB write.
 * Implements all rules from CONFIG_SCHEMA.md Section 6.
 */
export function validateConfig(config: AppConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // ── R01: start_date format ──────────────────────────────────────────────
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(config.start_date)) {
    errors.push({
      field: 'start_date',
      rule: 'R01',
      message: 'start_date must be a valid date in YYYY-MM-DD format',
      value: config.start_date,
    });
  } else {
    const parts = config.start_date.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const d = new Date(year, month - 1, day);

    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      errors.push({
        field: 'start_date',
        rule: 'R01',
        message: 'start_date must be a valid date in YYYY-MM-DD format',
        value: config.start_date,
      });
    } else {
      // ── R02: start_date <= today ──────────────────────────────────────
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      if (d.getTime() > today.getTime()) {
        errors.push({
          field: 'start_date',
          rule: 'R02',
          message: 'start_date cannot be a future date',
          value: config.start_date,
        });
      }
    }
  }

  // ── R03–R05: Category multipliers (> 0, <= 10.0) ───────────────────────
  checkRange(
    errors, 'multiplier_productivity', 'R03', config.multiplier_productivity,
    0, 10.0, true,
    'multiplier_productivity must be between 0 (exclusive) and 10.0 (inclusive)',
  );
  checkRange(
    errors, 'multiplier_health', 'R04', config.multiplier_health,
    0, 10.0, true,
    'multiplier_health must be between 0 (exclusive) and 10.0 (inclusive)',
  );
  checkRange(
    errors, 'multiplier_growth', 'R05', config.multiplier_growth,
    0, 10.0, true,
    'multiplier_growth must be between 0 (exclusive) and 10.0 (inclusive)',
  );

  // ── R06: target_fraction (> 0, <= 1.0) ─────────────────────────────────
  checkRange(
    errors, 'target_fraction', 'R06', config.target_fraction,
    0, 1.0, true,
    'target_fraction must be greater than 0 and at most 1.0',
  );

  // ── R07: vice_cap (>= 0, <= 1.0) ──────────────────────────────────────
  checkRange(
    errors, 'vice_cap', 'R07', config.vice_cap,
    0, 1.0, false,
    'vice_cap must be between 0 and 1.0 inclusive',
  );

  // ── R08: streak_threshold (>= 0, <= 1.0) ──────────────────────────────
  checkRange(
    errors, 'streak_threshold', 'R08', config.streak_threshold,
    0, 1.0, false,
    'streak_threshold must be between 0 and 1.0 inclusive',
  );

  // ── R09: streak_bonus_per_day (>= 0, <= 0.1) ─────────────────────────
  checkRange(
    errors, 'streak_bonus_per_day', 'R09', config.streak_bonus_per_day,
    0, 0.1, false,
    'streak_bonus_per_day must be between 0 and 0.1 inclusive',
  );

  // ── R10: max_streak_bonus (>= 0, <= 0.5) ──────────────────────────────
  checkRange(
    errors, 'max_streak_bonus', 'R10', config.max_streak_bonus,
    0, 0.5, false,
    'max_streak_bonus must be between 0 and 0.5 inclusive',
  );

  // ── R11–R13: Phone tier thresholds (integer, >= 0, <= 1440) ───────────
  checkIntegerRange(
    errors, 'phone_t1_min', 'R11', config.phone_t1_min,
    0, 1440,
    'phone_t1_min must be between 0 and 1440 (minutes in a day)',
  );
  checkIntegerRange(
    errors, 'phone_t2_min', 'R12', config.phone_t2_min,
    0, 1440,
    'phone_t2_min must be between 0 and 1440',
  );
  checkIntegerRange(
    errors, 'phone_t3_min', 'R13', config.phone_t3_min,
    0, 1440,
    'phone_t3_min must be between 0 and 1440',
  );

  // ── R14–R16: Phone tier penalties (>= 0, <= 1.0) ─────────────────────
  checkRange(
    errors, 'phone_t1_penalty', 'R14', config.phone_t1_penalty,
    0, 1.0, false,
    'phone_t1_penalty must be between 0 and 1.0 inclusive',
  );
  checkRange(
    errors, 'phone_t2_penalty', 'R15', config.phone_t2_penalty,
    0, 1.0, false,
    'phone_t2_penalty must be between 0 and 1.0 inclusive',
  );
  checkRange(
    errors, 'phone_t3_penalty', 'R16', config.phone_t3_penalty,
    0, 1.0, false,
    'phone_t3_penalty must be between 0 and 1.0 inclusive',
  );

  // ── R17: correlation_window_days ──────────────────────────────────────
  if (
    !(VALID_CORRELATION_WINDOWS as readonly number[]).includes(
      config.correlation_window_days,
    )
  ) {
    errors.push({
      field: 'correlation_window_days',
      rule: 'R17',
      message: 'correlation_window_days must be one of: 0, 30, 60, 90, 180, 365',
      value: config.correlation_window_days,
    });
  }

  // ── R18–R25: dropdown_options ─────────────────────────────────────────
  let parsedDropdownOptions: unknown;
  try {
    parsedDropdownOptions = JSON.parse(config.dropdown_options) as unknown;
  } catch {
    errors.push({
      field: 'dropdown_options',
      rule: 'R18',
      message: 'dropdown_options must be valid JSON',
      value: config.dropdown_options,
    });
  }

  if (parsedDropdownOptions !== undefined) {
    const ddResult = validateDropdownOptions(parsedDropdownOptions);
    errors.push(...ddResult.errors);
    warnings.push(...ddResult.warnings);
  }

  // ── R26–R27: Phone thresholds ascending ───────────────────────────────
  if (config.phone_t1_min >= config.phone_t2_min) {
    errors.push({
      field: 'phone_t1_min',
      rule: 'R26',
      message: 'phone_t1_min must be less than phone_t2_min',
      value: config.phone_t1_min,
    });
  }

  if (config.phone_t2_min >= config.phone_t3_min) {
    errors.push({
      field: 'phone_t2_min',
      rule: 'R27',
      message: 'phone_t2_min must be less than phone_t3_min',
      value: config.phone_t2_min,
    });
  }

  // ── R28–R29: Phone penalties ascending ────────────────────────────────
  if (config.phone_t1_penalty >= config.phone_t2_penalty) {
    errors.push({
      field: 'phone_t1_penalty',
      rule: 'R28',
      message:
        'phone_t1_penalty must be less than phone_t2_penalty (tiers must escalate)',
      value: config.phone_t1_penalty,
    });
  }

  if (config.phone_t2_penalty >= config.phone_t3_penalty) {
    errors.push({
      field: 'phone_t2_penalty',
      rule: 'R29',
      message:
        'phone_t2_penalty must be less than phone_t3_penalty (tiers must escalate)',
      value: config.phone_t2_penalty,
    });
  }

  // ── W01: max_streak_bonus < streak_bonus_per_day ──────────────────────
  if (config.max_streak_bonus < config.streak_bonus_per_day) {
    warnings.push({
      field: 'max_streak_bonus',
      rule: 'W01',
      message:
        'max_streak_bonus is less than streak_bonus_per_day — the bonus cap will be hit on day 1',
      value: config.max_streak_bonus,
    });
  }

  // ── W02: Any phone penalty >= vice_cap ────────────────────────────────
  if (config.vice_cap > 0) {
    const tiers = [
      { field: 'phone_t1_penalty', value: config.phone_t1_penalty, tier: 1 },
      { field: 'phone_t2_penalty', value: config.phone_t2_penalty, tier: 2 },
      { field: 'phone_t3_penalty', value: config.phone_t3_penalty, tier: 3 },
    ] as const;

    for (const t of tiers) {
      if (t.value >= config.vice_cap) {
        warnings.push({
          field: t.field,
          rule: 'W02',
          message: `phone_t${t.tier}_penalty equals or exceeds vice_cap — phone use alone will max the cap`,
          value: t.value,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
