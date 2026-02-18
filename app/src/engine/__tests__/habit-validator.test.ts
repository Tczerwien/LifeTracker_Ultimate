import { describe, it, expect } from 'vitest';
import type {
  HabitConfigInput,
  HabitValidationContext,
} from '../../types/engine';
import { validateHabitConfig } from '../habit-validator';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeGoodHabit(
  overrides?: Partial<HabitConfigInput>,
): HabitConfigInput {
  return {
    display_name: 'Test Habit',
    pool: 'good',
    category: 'productivity',
    input_type: 'checkbox',
    points: 3,
    penalty: 0,
    penalty_mode: 'flat',
    options_json: null,
    sort_order: 1,
    is_active: 1,
    ...overrides,
  };
}

function makeVice(overrides?: Partial<HabitConfigInput>): HabitConfigInput {
  return {
    display_name: 'Test Vice',
    pool: 'vice',
    category: null,
    input_type: 'checkbox',
    points: 0,
    penalty: 0.1,
    penalty_mode: 'flat',
    options_json: null,
    sort_order: 1,
    is_active: 1,
    ...overrides,
  };
}

function makeDropdownGoodHabit(
  overrides?: Partial<HabitConfigInput>,
): HabitConfigInput {
  return {
    display_name: 'Dropdown Habit',
    pool: 'good',
    category: 'health',
    input_type: 'dropdown',
    points: 3,
    penalty: 0,
    penalty_mode: 'flat',
    options_json: JSON.stringify({ None: 0, Good: 2, Great: 3 }),
    sort_order: 1,
    is_active: 1,
    ...overrides,
  };
}

function makeContext(
  overrides?: Partial<HabitValidationContext>,
): HabitValidationContext {
  return {
    activeGoodHabitCount: 5,
    tieredViceCount: 0,
    existingDisplayNames: [],
    isNew: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateHabitConfig', () => {
  // ── Golden tests ─────────────────────────────────────────────────────
  describe('golden tests', () => {
    it('valid good checkbox habit passes', () => {
      const r = validateHabitConfig(makeGoodHabit(), makeContext());
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('valid vice habit passes', () => {
      const r = validateHabitConfig(makeVice(), makeContext());
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('valid good dropdown habit passes', () => {
      const r = validateHabitConfig(makeDropdownGoodHabit(), makeContext());
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });

    it('valid tiered vice passes when no other tiered vices exist', () => {
      const r = validateHabitConfig(
        makeVice({
          input_type: 'number',
          penalty: 0,
          penalty_mode: 'tiered',
        }),
        makeContext({ tieredViceCount: 0 }),
      );
      expect(r.valid).toBe(true);
      expect(r.errors).toHaveLength(0);
    });
  });

  // ── Universal rules ──────────────────────────────────────────────────
  describe('universal rules', () => {
    // H01: display_name
    describe('H01: display_name 1-50 chars', () => {
      it('passes for 1-char name', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: 'X' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H01')).toHaveLength(0);
      });

      it('passes for 50-char name', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: 'A'.repeat(50) }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H01')).toHaveLength(0);
      });

      it('fails for empty string', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: '' }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H01')).toBe(true);
      });

      it('fails for 51-char string', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: 'A'.repeat(51) }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H01')).toBe(true);
      });
    });

    // Duplicate name
    describe('H_UNIQUE_NAME: display_name must be unique', () => {
      it('passes when display_name is unique', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: 'New Habit' }),
          makeContext({ existingDisplayNames: ['Other Habit', 'Another Habit'] }),
        );
        expect(r.errors.filter((e) => e.rule === 'H_UNIQUE_NAME')).toHaveLength(0);
      });

      it('fails when display_name matches an existing habit', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: 'Existing Habit' }),
          makeContext({ existingDisplayNames: ['Existing Habit', 'Other'] }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H_UNIQUE_NAME')).toBe(true);
      });

      it('is case-sensitive — different casing passes', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ display_name: 'my habit' }),
          makeContext({ existingDisplayNames: ['My Habit'] }),
        );
        expect(r.errors.filter((e) => e.rule === 'H_UNIQUE_NAME')).toHaveLength(0);
      });
    });

    // H02: sort_order
    describe('H02: sort_order positive integer', () => {
      it('passes for sort_order = 1', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ sort_order: 1 }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H02')).toHaveLength(0);
      });

      it('passes for sort_order = 100', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ sort_order: 100 }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H02')).toHaveLength(0);
      });

      it('fails for sort_order = 0', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ sort_order: 0 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H02')).toBe(true);
      });

      it('fails for negative sort_order', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ sort_order: -1 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H02')).toBe(true);
      });

      it('fails for non-integer sort_order', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ sort_order: 1.5 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H02')).toBe(true);
      });
    });
  });

  // ── Good habit rules ─────────────────────────────────────────────────
  describe('good habit rules', () => {
    // H03: category required
    describe('H03: good habits must have a category', () => {
      it('passes for valid category "productivity"', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ category: 'productivity' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H03')).toHaveLength(0);
      });

      it('passes for valid category "health"', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ category: 'health' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H03')).toHaveLength(0);
      });

      it('passes for valid category "growth"', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ category: 'growth' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H03')).toHaveLength(0);
      });

      it('fails for null category (edge case #40)', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ category: null }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H03')).toBe(true);
      });
    });

    // H04: points >= 1
    describe('H04: good habit points >= 1', () => {
      it('passes for points = 1', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ points: 1 }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H04')).toHaveLength(0);
      });

      it('passes for points = 10', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ points: 10 }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H04')).toHaveLength(0);
      });

      it('fails for points = 0 (edge case #31)', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ points: 0 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H04')).toBe(true);
      });

      it('fails for non-integer points', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ points: 1.5 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H04')).toBe(true);
      });
    });

    // H05: penalty = 0
    describe('H05: good habits cannot have a penalty', () => {
      it('passes for penalty = 0', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ penalty: 0 }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H05')).toHaveLength(0);
      });

      it('fails for penalty = 0.1 (edge case #32)', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ penalty: 0.1 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H05')).toBe(true);
      });
    });

    // H19: cannot retire last active good habit
    describe('H19: cannot retire last active good habit', () => {
      it('passes when retiring with other active habits remaining', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ is_active: 0 }),
          makeContext({ activeGoodHabitCount: 2 }),
        );
        expect(r.errors.filter((e) => e.rule === 'H19')).toHaveLength(0);
      });

      it('fails when retiring the last active good habit (edge case #38)', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ is_active: 0 }),
          makeContext({ activeGoodHabitCount: 0 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H19')).toBe(true);
      });

      it('does not trigger for vices being retired', () => {
        const r = validateHabitConfig(
          makeVice({ is_active: 0 }),
          makeContext({ activeGoodHabitCount: 0 }),
        );
        expect(r.errors.filter((e) => e.rule === 'H19')).toHaveLength(0);
      });
    });
  });

  // ── Vice rules ───────────────────────────────────────────────────────
  describe('vice rules', () => {
    // H06: category must be null
    describe('H06: vices cannot have a category', () => {
      it('passes for null category', () => {
        const r = validateHabitConfig(makeVice(), makeContext());
        expect(r.errors.filter((e) => e.rule === 'H06')).toHaveLength(0);
      });

      it('fails for non-null category', () => {
        const r = validateHabitConfig(
          makeVice({ category: 'productivity' }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H06')).toBe(true);
      });
    });

    // H07: points must be 0
    describe('H07: vices cannot contribute positive points', () => {
      it('passes for points = 0', () => {
        const r = validateHabitConfig(makeVice(), makeContext());
        expect(r.errors.filter((e) => e.rule === 'H07')).toHaveLength(0);
      });

      it('fails for points = 1 (edge case #33)', () => {
        const r = validateHabitConfig(
          makeVice({ points: 1 }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H07')).toBe(true);
      });
    });

    // H08: flat/per_instance penalty in [0, 1.0]
    describe('H08: flat/per_instance penalty range', () => {
      it('passes for penalty = 0.1 (flat)', () => {
        const r = validateHabitConfig(
          makeVice({ penalty: 0.1, penalty_mode: 'flat' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H08')).toHaveLength(0);
      });

      it('passes for penalty = 1.0 (upper bound)', () => {
        const r = validateHabitConfig(
          makeVice({ penalty: 1.0, penalty_mode: 'flat' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H08')).toHaveLength(0);
      });

      it('passes for penalty = 0 (lower bound)', () => {
        const r = validateHabitConfig(
          makeVice({ penalty: 0, penalty_mode: 'flat' }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H08')).toHaveLength(0);
      });

      it('passes for per_instance penalty', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0.25,
            penalty_mode: 'per_instance',
            input_type: 'number',
          }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H08')).toHaveLength(0);
      });

      it('fails for penalty > 1.0', () => {
        const r = validateHabitConfig(
          makeVice({ penalty: 1.1, penalty_mode: 'flat' }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H08')).toBe(true);
      });

      it('fails for negative penalty', () => {
        const r = validateHabitConfig(
          makeVice({ penalty: -0.1, penalty_mode: 'flat' }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H08')).toBe(true);
      });
    });

    // H09: tiered penalty must be 0
    describe('H09: tiered vices penalty must be 0', () => {
      it('passes for penalty = 0 with tiered mode', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0,
            penalty_mode: 'tiered',
            input_type: 'number',
          }),
          makeContext({ tieredViceCount: 0 }),
        );
        expect(r.errors.filter((e) => e.rule === 'H09')).toHaveLength(0);
      });

      it('fails for penalty = 0.05 with tiered mode (edge case #39)', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0.05,
            penalty_mode: 'tiered',
            input_type: 'number',
          }),
          makeContext({ tieredViceCount: 0 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H09')).toBe(true);
      });
    });

    // H18: only one tiered vice
    describe('H18: only one tiered vice allowed', () => {
      it('passes when no other tiered vices exist (new)', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0,
            penalty_mode: 'tiered',
            input_type: 'number',
          }),
          makeContext({ tieredViceCount: 0, isNew: true }),
        );
        expect(r.errors.filter((e) => e.rule === 'H18')).toHaveLength(0);
      });

      it('passes when editing existing tiered vice (count excludes self)', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0,
            penalty_mode: 'tiered',
            input_type: 'number',
          }),
          makeContext({ tieredViceCount: 0, isNew: false }),
        );
        expect(r.errors.filter((e) => e.rule === 'H18')).toHaveLength(0);
      });

      it('fails when another tiered vice already exists (edge case #34)', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0,
            penalty_mode: 'tiered',
            input_type: 'number',
          }),
          makeContext({ tieredViceCount: 1, isNew: true }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H18')).toBe(true);
      });

      it('fails when editing non-tiered to tiered and another exists', () => {
        const r = validateHabitConfig(
          makeVice({
            penalty: 0,
            penalty_mode: 'tiered',
            input_type: 'number',
          }),
          makeContext({ tieredViceCount: 1, isNew: false }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H18')).toBe(true);
      });
    });
  });

  // ── Input type rules ─────────────────────────────────────────────────
  describe('input type rules', () => {
    // H10: checkbox options_json must be null
    describe('H10: checkbox habits cannot have options_json', () => {
      it('passes for null options_json', () => {
        const r = validateHabitConfig(
          makeGoodHabit({ input_type: 'checkbox', options_json: null }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H10')).toHaveLength(0);
      });

      it('fails for non-null options_json on checkbox', () => {
        const r = validateHabitConfig(
          makeGoodHabit({
            input_type: 'checkbox',
            options_json: '{"a":1}',
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H10')).toBe(true);
      });
    });

    // H11: dropdown good habits require valid options_json
    describe('H11: dropdown habits require options_json', () => {
      it('passes for valid options_json', () => {
        const r = validateHabitConfig(makeDropdownGoodHabit(), makeContext());
        expect(r.errors.filter((e) => e.rule === 'H11')).toHaveLength(0);
      });

      it('fails for null options_json on dropdown good habit', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({ options_json: null }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H11')).toBe(true);
      });

      it('fails for invalid JSON string', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({ options_json: 'not json' }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H11')).toBe(true);
      });

      it('fails for array instead of object', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({ options_json: '[1,2,3]' }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H11')).toBe(true);
      });
    });

    // H12: option values must be non-negative numbers
    describe('H12: options_json values must be non-negative', () => {
      it('passes for valid values', () => {
        const r = validateHabitConfig(makeDropdownGoodHabit(), makeContext());
        expect(r.errors.filter((e) => e.rule === 'H12')).toHaveLength(0);
      });

      it('fails for negative value', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ None: 0, Bad: -1, Good: 2 }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H12')).toBe(true);
      });

      it('fails for string value', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ None: 0, Bad: 'two' }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H12')).toBe(true);
      });
    });

    // H13: exactly one value = 0
    describe('H13: exactly one option with value 0', () => {
      it('passes for exactly one zero', () => {
        const r = validateHabitConfig(makeDropdownGoodHabit(), makeContext());
        expect(r.errors.filter((e) => e.rule === 'H13')).toHaveLength(0);
      });

      it('fails for no zero (edge case #35)', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ Good: 1, Great: 2 }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H13')).toBe(true);
      });

      it('fails for two zeros', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ None: 0, Also: 0, Great: 3 }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H13')).toBe(true);
      });
    });

    // H15: >= 2 options
    describe('H15: dropdown must have >= 2 options', () => {
      it('passes for 2 options', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            points: 1,
            options_json: JSON.stringify({ None: 0, Yes: 1 }),
          }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H15')).toHaveLength(0);
      });

      it('fails for 1 option (edge case #36)', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ None: 0 }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H15')).toBe(true);
      });
    });

    // H16: <= 10 options
    describe('H16: dropdown must have <= 10 options', () => {
      it('passes for 10 options', () => {
        const opts: Record<string, number> = { None: 0 };
        for (let i = 1; i <= 9; i++) {
          opts[`Option${i}`] = i;
        }
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            points: 9,
            options_json: JSON.stringify(opts),
          }),
          makeContext(),
        );
        expect(r.errors.filter((e) => e.rule === 'H16')).toHaveLength(0);
      });

      it('fails for 11 options', () => {
        const opts: Record<string, number> = { None: 0 };
        for (let i = 1; i <= 10; i++) {
          opts[`Option${i}`] = i;
        }
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            points: 10,
            options_json: JSON.stringify(opts),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H16')).toBe(true);
      });
    });

    // H17: option labels 1-50 chars
    describe('H17: option labels 1-50 characters', () => {
      it('passes for valid labels', () => {
        const r = validateHabitConfig(makeDropdownGoodHabit(), makeContext());
        expect(r.errors.filter((e) => e.rule === 'H17')).toHaveLength(0);
      });

      it('fails for empty label (empty string key)', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ '': 0, Good: 3 }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H17')).toBe(true);
      });

      it('fails for label > 50 chars', () => {
        const longLabel = 'A'.repeat(51);
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ [longLabel]: 0, Good: 3 }),
          }),
          makeContext(),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'H17')).toBe(true);
      });
    });

    // H14: auto-sync (not an error)
    describe('H14: auto-sync (not an error)', () => {
      it('does NOT error when points != max(options_json values) — edge case #37', () => {
        const r = validateHabitConfig(
          makeDropdownGoodHabit({
            options_json: JSON.stringify({ None: 0, Good: 2 }),
            points: 3,
          }),
          makeContext(),
        );
        expect(r.valid).toBe(true);
        expect(r.errors).toHaveLength(0);
      });
    });
  });

  // ── Error accumulation ───────────────────────────────────────────────
  describe('error accumulation', () => {
    it('accumulates multiple errors from different rules', () => {
      const r = validateHabitConfig(
        makeGoodHabit({
          display_name: '',
          points: 0,
          penalty: 0.5,
          category: null,
        }),
        makeContext(),
      );
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThanOrEqual(4);
      expect(r.errors.some((e) => e.rule === 'H01')).toBe(true);
      expect(r.errors.some((e) => e.rule === 'H03')).toBe(true);
      expect(r.errors.some((e) => e.rule === 'H04')).toBe(true);
      expect(r.errors.some((e) => e.rule === 'H05')).toBe(true);
    });
  });
});
