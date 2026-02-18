import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  HabitConfigInput,
  HabitValidationContext,
} from '../types/engine';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Validate dropdown options_json for good dropdown habits (H11–H17). */
function validateDropdownHabitOptions(
  habit: HabitConfigInput,
  errors: ValidationError[],
): void {
  // H11: Dropdown good habits require valid options_json
  if (habit.pool === 'good' && habit.options_json === null) {
    errors.push({
      field: 'options_json',
      rule: 'H11',
      message: 'Dropdown habits require options_json',
      value: null,
    });
    return;
  }

  if (habit.options_json === null) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(habit.options_json) as unknown;
  } catch {
    errors.push({
      field: 'options_json',
      rule: 'H11',
      message: 'Dropdown habits require options_json',
      value: habit.options_json,
    });
    return;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    errors.push({
      field: 'options_json',
      rule: 'H11',
      message: 'Dropdown habits require options_json',
      value: habit.options_json,
    });
    return;
  }

  const record = parsed as Record<string, unknown>;
  const entries = Object.entries(record);

  // H15: >= 2 options
  if (entries.length < 2) {
    errors.push({
      field: 'options_json',
      rule: 'H15',
      message: 'Dropdown habits must have at least 2 options',
      value: entries.length,
    });
  }

  // H16: <= 10 options
  if (entries.length > 10) {
    errors.push({
      field: 'options_json',
      rule: 'H16',
      message: 'Dropdown habits cannot exceed 10 options',
      value: entries.length,
    });
  }

  // H17: Option labels 1–50 chars
  for (const [label] of entries) {
    if (label.length < 1 || label.length > 50) {
      errors.push({
        field: 'options_json',
        rule: 'H17',
        message: 'Option labels must be 1-50 characters',
        value: label,
      });
    }
  }

  // H12: All values must be finite numbers >= 0
  const numericValues: number[] = [];
  for (const [, val] of entries) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      errors.push({
        field: 'options_json',
        rule: 'H12',
        message: 'options_json values must be non-negative numbers',
        value: val,
      });
    } else {
      numericValues.push(val);
    }
  }

  // H13: Exactly one value = 0
  const zeroCount = numericValues.filter((v) => v === 0).length;
  if (zeroCount !== 1) {
    errors.push({
      field: 'options_json',
      rule: 'H13',
      message: 'options_json must contain exactly one option with value 0',
      value: zeroCount,
    });
  }

  // H14: auto-sync — NOT an error. The save handler sets points = max(values).
  // The validator is pure and does not mutate input.
}

// ---------------------------------------------------------------------------
// validateHabitConfig
// ---------------------------------------------------------------------------

/**
 * Pure validation for habit config writes.
 * Implements all rules from CONFIG_SCHEMA.md Section 7.
 */
export function validateHabitConfig(
  habit: HabitConfigInput,
  context: HabitValidationContext,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // ── H01: display_name 1–50 chars ─────────────────────────────────────
  if (habit.display_name.length < 1 || habit.display_name.length > 50) {
    errors.push({
      field: 'display_name',
      rule: 'H01',
      message: 'display_name must be 1-50 characters',
      value: habit.display_name,
    });
  }

  // ── Duplicate name: display_name must be unique ──────────────────────
  if (context.existingDisplayNames.includes(habit.display_name)) {
    errors.push({
      field: 'display_name',
      rule: 'H_UNIQUE_NAME',
      message: 'A habit with this display name already exists',
      value: habit.display_name,
    });
  }

  // ── H02: sort_order integer >= 1 ─────────────────────────────────────
  if (!Number.isInteger(habit.sort_order) || habit.sort_order < 1) {
    errors.push({
      field: 'sort_order',
      rule: 'H02',
      message: 'sort_order must be a positive integer',
      value: habit.sort_order,
    });
  }

  // ── Pool-specific rules ──────────────────────────────────────────────
  if (habit.pool === 'good') {
    // H03: category required, must be valid
    if (
      habit.category !== 'productivity' &&
      habit.category !== 'health' &&
      habit.category !== 'growth'
    ) {
      errors.push({
        field: 'category',
        rule: 'H03',
        message: 'Good habits must have a category',
        value: habit.category,
      });
    }

    // H04: points integer >= 1
    if (!Number.isInteger(habit.points) || habit.points < 1) {
      errors.push({
        field: 'points',
        rule: 'H04',
        message: 'Good habit points must be at least 1',
        value: habit.points,
      });
    }

    // H05: penalty must be 0
    if (habit.penalty !== 0) {
      errors.push({
        field: 'penalty',
        rule: 'H05',
        message: 'Good habits cannot have a penalty',
        value: habit.penalty,
      });
    }
  } else {
    // pool === 'vice'

    // H06: category must be null
    if (habit.category !== null) {
      errors.push({
        field: 'category',
        rule: 'H06',
        message: 'Vices cannot have a category',
        value: habit.category,
      });
    }

    // H07: points must be 0
    if (habit.points !== 0) {
      errors.push({
        field: 'points',
        rule: 'H07',
        message: 'Vices cannot contribute positive points',
        value: habit.points,
      });
    }

    // H08/H09: penalty rules depend on penalty_mode
    if (habit.penalty_mode === 'tiered') {
      // H09: tiered vices must have penalty = 0
      if (habit.penalty !== 0) {
        errors.push({
          field: 'penalty',
          rule: 'H09',
          message:
            'Tiered vices use app_config phone penalty values; habit penalty must be 0',
          value: habit.penalty,
        });
      }

      // H18: Only one tiered vice allowed (context excludes current habit)
      if (context.tieredViceCount > 0) {
        errors.push({
          field: 'penalty_mode',
          rule: 'H18',
          message:
            'Only one tiered vice is supported. phone_use is already tiered.',
          value: habit.penalty_mode,
        });
      }
    } else {
      // H08: flat or per_instance — penalty in [0, 1.0]
      if (habit.penalty < 0 || habit.penalty > 1.0) {
        errors.push({
          field: 'penalty',
          rule: 'H08',
          message: 'penalty must be between 0 and 1.0',
          value: habit.penalty,
        });
      }
    }
  }

  // ── Input-type specific rules ────────────────────────────────────────
  // H10: checkbox => options_json must be null
  if (habit.input_type === 'checkbox' && habit.options_json !== null) {
    errors.push({
      field: 'options_json',
      rule: 'H10',
      message: 'Checkbox habits cannot have options_json',
      value: habit.options_json,
    });
  }

  // H11–H17: dropdown options validation
  if (habit.input_type === 'dropdown') {
    validateDropdownHabitOptions(habit, errors);
  }

  // ── H19: Cannot retire last active good habit ────────────────────────
  if (
    habit.is_active === 0 &&
    habit.pool === 'good' &&
    context.activeGoodHabitCount < 1
  ) {
    errors.push({
      field: 'is_active',
      rule: 'H19',
      message: 'Cannot retire the last active good habit',
      value: habit.is_active,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
