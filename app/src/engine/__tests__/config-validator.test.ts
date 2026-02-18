import { describe, it, expect } from 'vitest';
import type { AppConfig } from '../../types/models';
import { SEED_DROPDOWN_OPTIONS } from '../../types/options';
import type { DropdownOptions } from '../../types/options';
import { validateConfig, validateDropdownOptions } from '../config-validator';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeDefaultConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    id: 'default',
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
    dropdown_options: JSON.stringify(SEED_DROPDOWN_OPTIONS),
    last_modified: '2026-01-20T00:00:00Z',
    ...overrides,
  };
}

/** Build a valid DropdownOptions with optional per-key overrides. */
function makeSeedDropdown(
  overrides?: Partial<Record<keyof DropdownOptions, string[]>>,
): DropdownOptions {
  return { ...SEED_DROPDOWN_OPTIONS, ...overrides };
}

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

describe('validateConfig', () => {
  // ── Golden test ───────────────────────────────────────────────────────
  describe('golden test', () => {
    it('seed config with all defaults passes validation', () => {
      const result = validateConfig(makeDefaultConfig());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── Single-field rules ────────────────────────────────────────────────
  describe('single-field rules', () => {
    // R01: start_date format
    describe('R01: start_date format', () => {
      it('passes for valid ISO date', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: '2026-01-15' }));
        expect(r.errors.filter((e) => e.rule === 'R01')).toHaveLength(0);
      });

      it('fails for non-date string', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: 'not-a-date' }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R01')).toBe(true);
      });

      it('fails for invalid month "2026-13-01"', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: '2026-13-01' }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R01')).toBe(true);
      });

      it('fails for invalid day "2026-02-30"', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: '2026-02-30' }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R01')).toBe(true);
      });

      it('fails for empty string', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: '' }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R01')).toBe(true);
      });
    });

    // R02: start_date not future
    describe('R02: start_date not future', () => {
      it('passes for past date', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: '2026-01-01' }));
        expect(r.errors.filter((e) => e.rule === 'R02')).toHaveLength(0);
      });

      it('fails for far-future date', () => {
        const r = validateConfig(makeDefaultConfig({ start_date: '2099-01-01' }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R02')).toBe(true);
      });
    });

    // R03: multiplier_productivity
    describe('R03: multiplier_productivity', () => {
      it('passes for 1.5 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R03')).toHaveLength(0);
      });

      it('passes for 10.0 (upper bound)', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_productivity: 10.0 }));
        expect(r.errors.filter((e) => e.rule === 'R03')).toHaveLength(0);
      });

      it('passes for 0.001 (just above zero)', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_productivity: 0.001 }));
        expect(r.errors.filter((e) => e.rule === 'R03')).toHaveLength(0);
      });

      it('fails for 0 (exclusive lower bound)', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_productivity: 0 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R03')).toBe(true);
      });

      it('fails for negative value', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_productivity: -1 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R03')).toBe(true);
      });

      it('fails for 10.1 (above upper bound)', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_productivity: 10.1 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R03')).toBe(true);
      });
    });

    // R04: multiplier_health
    describe('R04: multiplier_health', () => {
      it('passes for 1.3 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R04')).toHaveLength(0);
      });

      it('fails for 0', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_health: 0 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R04')).toBe(true);
      });

      it('fails for 10.1', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_health: 10.1 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R04')).toBe(true);
      });
    });

    // R05: multiplier_growth
    describe('R05: multiplier_growth', () => {
      it('passes for 1.0 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R05')).toHaveLength(0);
      });

      it('fails for 0', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_growth: 0 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R05')).toBe(true);
      });

      it('fails for 10.1', () => {
        const r = validateConfig(makeDefaultConfig({ multiplier_growth: 10.1 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R05')).toBe(true);
      });
    });

    // R06: target_fraction
    describe('R06: target_fraction', () => {
      it('passes for 0.85 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R06')).toHaveLength(0);
      });

      it('passes for 1.0 (upper bound)', () => {
        const r = validateConfig(makeDefaultConfig({ target_fraction: 1.0 }));
        expect(r.errors.filter((e) => e.rule === 'R06')).toHaveLength(0);
      });

      it('passes for 0.001 (pathological but valid)', () => {
        const r = validateConfig(makeDefaultConfig({ target_fraction: 0.001 }));
        expect(r.errors.filter((e) => e.rule === 'R06')).toHaveLength(0);
      });

      it('fails for 0 (edge case #1)', () => {
        const r = validateConfig(makeDefaultConfig({ target_fraction: 0 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R06')).toBe(true);
      });

      it('fails for 1.001 (edge case #3)', () => {
        const r = validateConfig(makeDefaultConfig({ target_fraction: 1.001 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R06')).toBe(true);
      });
    });

    // R07: vice_cap
    describe('R07: vice_cap', () => {
      it('passes for 0.40 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R07')).toHaveLength(0);
      });

      it('passes for 0 (vices disabled)', () => {
        const r = validateConfig(makeDefaultConfig({ vice_cap: 0 }));
        expect(r.errors.filter((e) => e.rule === 'R07')).toHaveLength(0);
      });

      it('passes for 1.0 (edge case #4)', () => {
        const r = validateConfig(makeDefaultConfig({ vice_cap: 1.0 }));
        expect(r.errors.filter((e) => e.rule === 'R07')).toHaveLength(0);
      });

      it('fails for 1.01 (edge case #5)', () => {
        const r = validateConfig(makeDefaultConfig({ vice_cap: 1.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R07')).toBe(true);
      });

      it('fails for -0.01 (edge case #6)', () => {
        const r = validateConfig(makeDefaultConfig({ vice_cap: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R07')).toBe(true);
      });
    });

    // R08: streak_threshold
    describe('R08: streak_threshold', () => {
      it('passes for 0.65 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R08')).toHaveLength(0);
      });

      it('passes for 1.0 (edge case #7)', () => {
        const r = validateConfig(makeDefaultConfig({ streak_threshold: 1.0 }));
        expect(r.errors.filter((e) => e.rule === 'R08')).toHaveLength(0);
      });

      it('passes for 0', () => {
        const r = validateConfig(makeDefaultConfig({ streak_threshold: 0 }));
        expect(r.errors.filter((e) => e.rule === 'R08')).toHaveLength(0);
      });

      it('fails for 1.01 (edge case #8)', () => {
        const r = validateConfig(makeDefaultConfig({ streak_threshold: 1.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R08')).toBe(true);
      });

      it('fails for -0.01', () => {
        const r = validateConfig(makeDefaultConfig({ streak_threshold: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R08')).toBe(true);
      });
    });

    // R09: streak_bonus_per_day
    describe('R09: streak_bonus_per_day', () => {
      it('passes for 0.01 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R09')).toHaveLength(0);
      });

      it('passes for 0.1 (edge case #9)', () => {
        const r = validateConfig(makeDefaultConfig({ streak_bonus_per_day: 0.1 }));
        expect(r.errors.filter((e) => e.rule === 'R09')).toHaveLength(0);
      });

      it('passes for 0', () => {
        const r = validateConfig(makeDefaultConfig({ streak_bonus_per_day: 0 }));
        expect(r.errors.filter((e) => e.rule === 'R09')).toHaveLength(0);
      });

      it('fails for 0.101 (edge case #10)', () => {
        const r = validateConfig(makeDefaultConfig({ streak_bonus_per_day: 0.101 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R09')).toBe(true);
      });

      it('fails for -0.01', () => {
        const r = validateConfig(makeDefaultConfig({ streak_bonus_per_day: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R09')).toBe(true);
      });
    });

    // R10: max_streak_bonus
    describe('R10: max_streak_bonus', () => {
      it('passes for 0.10 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R10')).toHaveLength(0);
      });

      it('passes for 0.5 (edge case #11)', () => {
        const r = validateConfig(makeDefaultConfig({ max_streak_bonus: 0.5 }));
        expect(r.errors.filter((e) => e.rule === 'R10')).toHaveLength(0);
      });

      it('passes for 0', () => {
        const r = validateConfig(makeDefaultConfig({ max_streak_bonus: 0 }));
        expect(r.errors.filter((e) => e.rule === 'R10')).toHaveLength(0);
      });

      it('fails for 0.51 (edge case #12)', () => {
        const r = validateConfig(makeDefaultConfig({ max_streak_bonus: 0.51 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R10')).toBe(true);
      });

      it('fails for -0.01', () => {
        const r = validateConfig(makeDefaultConfig({ max_streak_bonus: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R10')).toBe(true);
      });
    });

    // R11: phone_t1_min
    describe('R11: phone_t1_min', () => {
      it('passes for 61 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R11')).toHaveLength(0);
      });

      it('passes for 0 (edge case #13)', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_min: 0 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R11')).toHaveLength(0);
      });

      it('passes for 1440', () => {
        // Note: this will fail R26 (t1 < t2) but R11 itself passes
        const r = validateConfig(makeDefaultConfig({ phone_t1_min: 1440 }));
        expect(r.errors.filter((e) => e.rule === 'R11')).toHaveLength(0);
      });

      it('fails for 1441 (edge case #14)', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t1_min: 1441 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R11')).toBe(true);
      });

      it('fails for -1', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t1_min: -1 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R11')).toBe(true);
      });

      it('fails for non-integer 61.5', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t1_min: 61.5 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R11')).toBe(true);
      });
    });

    // R12: phone_t2_min
    describe('R12: phone_t2_min', () => {
      it('passes for 181 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R12')).toHaveLength(0);
      });

      it('fails for 1441', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t2_min: 1441 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R12')).toBe(true);
      });

      it('fails for non-integer', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t2_min: 181.5 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R12')).toBe(true);
      });
    });

    // R13: phone_t3_min
    describe('R13: phone_t3_min', () => {
      it('passes for 301 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R13')).toHaveLength(0);
      });

      it('fails for 1441', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t3_min: 1441 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R13')).toBe(true);
      });

      it('fails for non-integer', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t3_min: 301.5 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R13')).toBe(true);
      });
    });

    // R14: phone_t1_penalty
    describe('R14: phone_t1_penalty', () => {
      it('passes for 0.03 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R14')).toHaveLength(0);
      });

      it('passes for 0', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t1_penalty: 0 }));
        expect(r.errors.filter((e) => e.rule === 'R14')).toHaveLength(0);
      });

      it('passes for 1.0', () => {
        // Will fail R28 but R14 itself passes
        const r = validateConfig(makeDefaultConfig({ phone_t1_penalty: 1.0 }));
        expect(r.errors.filter((e) => e.rule === 'R14')).toHaveLength(0);
      });

      it('fails for -0.01', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t1_penalty: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R14')).toBe(true);
      });

      it('fails for 1.01', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t1_penalty: 1.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R14')).toBe(true);
      });
    });

    // R15: phone_t2_penalty
    describe('R15: phone_t2_penalty', () => {
      it('passes for 0.07 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R15')).toHaveLength(0);
      });

      it('fails for -0.01', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t2_penalty: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R15')).toBe(true);
      });

      it('fails for 1.01', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t2_penalty: 1.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R15')).toBe(true);
      });
    });

    // R16: phone_t3_penalty
    describe('R16: phone_t3_penalty', () => {
      it('passes for 0.12 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R16')).toHaveLength(0);
      });

      it('fails for -0.01', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t3_penalty: -0.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R16')).toBe(true);
      });

      it('fails for 1.01', () => {
        const r = validateConfig(makeDefaultConfig({ phone_t3_penalty: 1.01 }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R16')).toBe(true);
      });
    });

    // R17: correlation_window_days
    describe('R17: correlation_window_days', () => {
      it('passes for 90 (default)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R17')).toHaveLength(0);
      });

      it('passes for 0 (all-time sentinel, edge case #20)', () => {
        const r = validateConfig(
          makeDefaultConfig({ correlation_window_days: 0 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R17')).toHaveLength(0);
      });

      it('passes for 365 (edge case #21)', () => {
        const r = validateConfig(
          makeDefaultConfig({ correlation_window_days: 365 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R17')).toHaveLength(0);
      });

      it('fails for 45 (not in valid set, edge case #19)', () => {
        const r = validateConfig(
          makeDefaultConfig({
            correlation_window_days: 45 as AppConfig['correlation_window_days'],
          }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R17')).toBe(true);
      });

      it('fails for 15', () => {
        const r = validateConfig(
          makeDefaultConfig({
            correlation_window_days: 15 as AppConfig['correlation_window_days'],
          }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R17')).toBe(true);
      });
    });

    // R18: dropdown_options valid JSON
    describe('R18: dropdown_options valid JSON', () => {
      it('passes for valid JSON (seed defaults)', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.errors.filter((e) => e.rule === 'R18')).toHaveLength(0);
      });

      it('fails for invalid JSON string (edge case #23)', () => {
        const r = validateConfig(
          makeDefaultConfig({ dropdown_options: 'not json' }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R18')).toBe(true);
      });

      it('fails for empty string', () => {
        const r = validateConfig(makeDefaultConfig({ dropdown_options: '' }));
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R18')).toBe(true);
      });
    });
  });

  // ── Dropdown rules via validateConfig ─────────────────────────────────
  describe('dropdown_options rules (via validateConfig)', () => {
    it('R19: fails when required key is missing (edge case #22)', () => {
      const opts = makeSeedDropdown();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { study_subjects: _, ...missing } = opts;
      const r = validateConfig(
        makeDefaultConfig({ dropdown_options: JSON.stringify(missing) }),
      );
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.rule === 'R19')).toBe(true);
    });

    it('R20: fails for empty array (edge case #24)', () => {
      const opts = makeSeedDropdown({ study_subjects: [] });
      const r = validateConfig(
        makeDefaultConfig({ dropdown_options: JSON.stringify(opts) }),
      );
      expect(r.valid).toBe(false);
      expect(
        r.errors.some((e) => e.rule === 'R20' || e.rule === 'R21'),
      ).toBe(true);
    });

    it('R21: fails for single-item array (edge case #25)', () => {
      const opts = makeSeedDropdown({ study_subjects: ['A'] });
      const r = validateConfig(
        makeDefaultConfig({ dropdown_options: JSON.stringify(opts) }),
      );
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.rule === 'R21')).toBe(true);
    });

    it('R25: fails for extra keys (edge case #26)', () => {
      const opts = { ...makeSeedDropdown(), foo: ['a', 'b'] };
      const r = validateConfig(
        makeDefaultConfig({ dropdown_options: JSON.stringify(opts) }),
      );
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.rule === 'R25')).toBe(true);
    });
  });

  // ── Cross-field rules ────────────────────────────────────────────────
  describe('cross-field rules', () => {
    // R26: phone_t1_min < phone_t2_min
    describe('R26: phone_t1_min < phone_t2_min', () => {
      it('passes when t1 < t2', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_min: 60, phone_t2_min: 180 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R26')).toHaveLength(0);
      });

      it('fails when t1 = t2 (edge case #15)', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_min: 100, phone_t2_min: 100 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R26')).toBe(true);
      });

      it('fails when t1 > t2 (edge case #16)', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_min: 100, phone_t2_min: 99 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R26')).toBe(true);
      });
    });

    // R27: phone_t2_min < phone_t3_min
    describe('R27: phone_t2_min < phone_t3_min', () => {
      it('passes when t2 < t3', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t2_min: 180, phone_t3_min: 300 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R27')).toHaveLength(0);
      });

      it('fails when t2 = t3', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t2_min: 300, phone_t3_min: 300 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R27')).toBe(true);
      });

      it('fails when t2 > t3', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t2_min: 400, phone_t3_min: 300 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R27')).toBe(true);
      });
    });

    // R28: phone_t1_penalty < phone_t2_penalty
    describe('R28: phone_t1_penalty < phone_t2_penalty', () => {
      it('passes when t1 < t2', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_penalty: 0.03, phone_t2_penalty: 0.07 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R28')).toHaveLength(0);
      });

      it('fails when t1 = t2 (edge case #17)', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_penalty: 0.07, phone_t2_penalty: 0.07 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R28')).toBe(true);
      });

      it('fails when t1 > t2 (edge case #18)', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t1_penalty: 0.08, phone_t2_penalty: 0.07 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R28')).toBe(true);
      });
    });

    // R29: phone_t2_penalty < phone_t3_penalty
    describe('R29: phone_t2_penalty < phone_t3_penalty', () => {
      it('passes when t2 < t3', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t2_penalty: 0.07, phone_t3_penalty: 0.12 }),
        );
        expect(r.errors.filter((e) => e.rule === 'R29')).toHaveLength(0);
      });

      it('fails when t2 = t3', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t2_penalty: 0.12, phone_t3_penalty: 0.12 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R29')).toBe(true);
      });

      it('fails when t2 > t3', () => {
        const r = validateConfig(
          makeDefaultConfig({ phone_t2_penalty: 0.15, phone_t3_penalty: 0.12 }),
        );
        expect(r.valid).toBe(false);
        expect(r.errors.some((e) => e.rule === 'R29')).toBe(true);
      });
    });
  });

  // ── Warnings ─────────────────────────────────────────────────────────
  describe('warnings', () => {
    // W01
    describe('W01: max_streak_bonus < streak_bonus_per_day', () => {
      it('warns when max < per_day (edge case #27)', () => {
        const r = validateConfig(
          makeDefaultConfig({
            max_streak_bonus: 0.005,
            streak_bonus_per_day: 0.01,
          }),
        );
        expect(r.valid).toBe(true);
        expect(r.warnings.some((w) => w.rule === 'W01')).toBe(true);
      });

      it('no warning when max >= per_day', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.warnings.filter((w) => w.rule === 'W01')).toHaveLength(0);
      });

      it('no warning when max = per_day', () => {
        const r = validateConfig(
          makeDefaultConfig({
            max_streak_bonus: 0.05,
            streak_bonus_per_day: 0.05,
          }),
        );
        expect(r.warnings.filter((w) => w.rule === 'W01')).toHaveLength(0);
      });
    });

    // W02
    describe('W02: phone penalty >= vice_cap', () => {
      it('warns when phone_t1_penalty >= vice_cap (edge case #28)', () => {
        const r = validateConfig(
          makeDefaultConfig({
            phone_t1_penalty: 0.03,
            phone_t2_penalty: 0.07,
            phone_t3_penalty: 0.40,
            vice_cap: 0.40,
          }),
        );
        expect(r.valid).toBe(true);
        expect(r.warnings.some((w) => w.rule === 'W02')).toBe(true);
      });

      it('no warning when all penalties < vice_cap', () => {
        const r = validateConfig(makeDefaultConfig());
        expect(r.warnings.filter((w) => w.rule === 'W02')).toHaveLength(0);
      });

      it('no warning when vice_cap = 0 (vices disabled)', () => {
        const r = validateConfig(
          makeDefaultConfig({
            vice_cap: 0,
            phone_t1_penalty: 0.03,
            phone_t2_penalty: 0.07,
            phone_t3_penalty: 0.12,
          }),
        );
        expect(r.warnings.filter((w) => w.rule === 'W02')).toHaveLength(0);
      });
    });
  });

  // ── Multiple errors accumulation ─────────────────────────────────────
  describe('error accumulation', () => {
    it('accumulates multiple errors from different rules', () => {
      const r = validateConfig(
        makeDefaultConfig({
          target_fraction: 0,
          vice_cap: -1,
          streak_threshold: 2.0,
        }),
      );
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThanOrEqual(3);
      expect(r.errors.some((e) => e.rule === 'R06')).toBe(true);
      expect(r.errors.some((e) => e.rule === 'R07')).toBe(true);
      expect(r.errors.some((e) => e.rule === 'R08')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateDropdownOptions (standalone)
// ---------------------------------------------------------------------------

describe('validateDropdownOptions', () => {
  it('passes for valid seed options', () => {
    const r = validateDropdownOptions(SEED_DROPDOWN_OPTIONS);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('fails for null', () => {
    const r = validateDropdownOptions(null);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R18')).toBe(true);
  });

  it('fails for array', () => {
    const r = validateDropdownOptions([]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R18')).toBe(true);
  });

  it('fails for string', () => {
    const r = validateDropdownOptions('hello');
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R18')).toBe(true);
  });

  // R19: missing key
  it('R19: fails for missing required key', () => {
    const opts = { ...SEED_DROPDOWN_OPTIONS };
    const partial = { ...opts } as Record<string, unknown>;
    delete partial['study_subjects'];
    const r = validateDropdownOptions(partial);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R19')).toBe(true);
  });

  // R20: non-array value
  it('R20: fails when value is not an array', () => {
    const opts = { ...SEED_DROPDOWN_OPTIONS, study_subjects: 'not-array' };
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R20')).toBe(true);
  });

  // R21: single-item array
  it('R21: fails for single-item array', () => {
    const opts = makeSeedDropdown({ study_subjects: ['Only One'] });
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R21')).toBe(true);
  });

  // R22: > 50 items
  it('R22: fails for > 50 items', () => {
    const bigArray = Array.from({ length: 51 }, (_, i) => `Item ${i}`);
    const opts = makeSeedDropdown({ study_subjects: bigArray });
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R22')).toBe(true);
  });

  // R23: empty string item
  it('R23: fails for empty string in array', () => {
    const opts = makeSeedDropdown({ study_subjects: ['Valid', ''] });
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R23')).toBe(true);
  });

  // R23: > 100 character item
  it('R23: fails for string > 100 characters', () => {
    const longString = 'A'.repeat(101);
    const opts = makeSeedDropdown({ study_subjects: ['Valid', longString] });
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R23')).toBe(true);
  });

  // R23: non-string item
  it('R23: fails for non-string item in array', () => {
    const opts = { ...SEED_DROPDOWN_OPTIONS, study_subjects: ['Valid', 42] };
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R23')).toBe(true);
  });

  // R24: duplicate values
  it('R24: fails for duplicate values within array', () => {
    const opts = makeSeedDropdown({
      study_subjects: ['Same', 'Same', 'Different'],
    });
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R24')).toBe(true);
  });

  // R25: extra keys
  it('R25: fails for extra unrecognized key', () => {
    const opts = { ...SEED_DROPDOWN_OPTIONS, unknown_key: ['a', 'b'] };
    const r = validateDropdownOptions(opts);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.rule === 'R25')).toBe(true);
  });

  // Read-only key enforcement
  describe('read-only key enforcement', () => {
    it('passes when read-only keys match seed values', () => {
      const r = validateDropdownOptions(SEED_DROPDOWN_OPTIONS);
      expect(r.errors.filter((e) => e.rule === 'R_READONLY')).toHaveLength(0);
    });

    it('fails when relapse_time_options is modified', () => {
      const opts = makeSeedDropdown({
        relapse_time_options: ['Morning', 'Afternoon'],
      });
      const r = validateDropdownOptions(opts);
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.rule === 'R_READONLY')).toBe(true);
    });

    it('fails when urge_pass_options is modified', () => {
      const opts = makeSeedDropdown({
        urge_pass_options: ['Yes', 'No'],
      });
      const r = validateDropdownOptions(opts);
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.rule === 'R_READONLY')).toBe(true);
    });
  });

  // Valid 2-item edge case
  it('passes for exactly 2 items per key (minimum)', () => {
    const minimal: Record<string, string[]> = {};
    for (const key of Object.keys(SEED_DROPDOWN_OPTIONS)) {
      minimal[key] = ['A', 'B'];
    }
    // Restore read-only keys to seed values
    minimal['relapse_time_options'] = [...SEED_DROPDOWN_OPTIONS.relapse_time_options];
    minimal['urge_pass_options'] = [...SEED_DROPDOWN_OPTIONS.urge_pass_options];
    const r = validateDropdownOptions(minimal);
    expect(r.valid).toBe(true);
  });

  // Exactly 50 items (boundary)
  it('passes for exactly 50 items (max boundary)', () => {
    const fiftyItems = Array.from({ length: 50 }, (_, i) => `Item ${i}`);
    const opts = makeSeedDropdown({ study_subjects: fiftyItems });
    const r = validateDropdownOptions(opts);
    expect(r.errors.filter((e) => e.rule === 'R22')).toHaveLength(0);
  });

  // 100-char string (boundary)
  it('passes for exactly 100-character string', () => {
    const exactly100 = 'A'.repeat(100);
    const opts = makeSeedDropdown({ study_subjects: [exactly100, 'B'] });
    const r = validateDropdownOptions(opts);
    expect(r.errors.filter((e) => e.rule === 'R23')).toHaveLength(0);
  });
});
