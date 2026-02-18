import { describe, it, expect } from 'vitest';
import { HabitPool } from '../enums';
import type { HabitConfig, DailyLog, AppConfig } from '../models';
import {
  SEED_DROPDOWN_OPTIONS,
  DROPDOWN_OPTION_KEYS,
  READ_ONLY_DROPDOWN_KEYS,
  isValidDropdownOptions,
} from '../options';

describe('Model interfaces compile check', () => {
  it('can create a typed HabitConfig object', () => {
    const habit: Partial<HabitConfig> = {
      id: 1,
      name: 'exercise',
      pool: HabitPool.Good,
    };
    expect(habit.id).toBe(1);
  });

  it('can create a typed DailyLog object', () => {
    const log: Partial<DailyLog> = {
      date: '2026-01-20',
      final_score: 0.85,
      streak: 5,
    };
    expect(log.date).toBe('2026-01-20');
  });

  it('can create a typed AppConfig object', () => {
    const config: Partial<AppConfig> = {
      id: 'default',
      target_fraction: 0.85,
      correlation_window_days: 90,
    };
    expect(config.target_fraction).toBe(0.85);
  });
});

describe('Dropdown Options', () => {
  it('SEED_DROPDOWN_OPTIONS has all 15 keys', () => {
    const keys = Object.keys(SEED_DROPDOWN_OPTIONS);
    expect(keys).toHaveLength(15);
  });

  it('DROPDOWN_OPTION_KEYS has all 15 keys', () => {
    expect(DROPDOWN_OPTION_KEYS).toHaveLength(15);
  });

  it('READ_ONLY_DROPDOWN_KEYS has 2 keys', () => {
    expect(READ_ONLY_DROPDOWN_KEYS).toHaveLength(2);
    expect(READ_ONLY_DROPDOWN_KEYS).toContain('relapse_time_options');
    expect(READ_ONLY_DROPDOWN_KEYS).toContain('urge_pass_options');
  });

  it('every seed option is a non-empty string array', () => {
    for (const [key, value] of Object.entries(SEED_DROPDOWN_OPTIONS)) {
      expect(Array.isArray(value), `${key} should be an array`).toBe(true);
      expect(value.length, `${key} should not be empty`).toBeGreaterThan(0);
      for (const item of value) {
        expect(typeof item, `${key} items should be strings`).toBe('string');
      }
    }
  });

  it('isValidDropdownOptions validates seed data', () => {
    expect(isValidDropdownOptions(SEED_DROPDOWN_OPTIONS)).toBe(true);
  });

  it('isValidDropdownOptions rejects invalid input', () => {
    expect(isValidDropdownOptions({})).toBe(false);
    expect(isValidDropdownOptions(null)).toBe(false);
    expect(isValidDropdownOptions(undefined)).toBe(false);
    expect(isValidDropdownOptions('string')).toBe(false);
    expect(isValidDropdownOptions({ study_subjects: 'not an array' })).toBe(
      false,
    );
  });

  it('isValidDropdownOptions rejects objects with missing keys', () => {
    const partial = { ...SEED_DROPDOWN_OPTIONS };
    delete (partial as Record<string, unknown>).urge_pass_options;
    expect(isValidDropdownOptions(partial)).toBe(false);
  });
});

describe('Barrel export', () => {
  it('re-exports types and values from all modules', async () => {
    const barrel = await import('../index');
    // Enums
    expect(barrel.HabitPool).toBeDefined();
    expect(barrel.HabitCategory).toBeDefined();
    expect(barrel.ApplicationStatus).toBeDefined();
    // Options
    expect(barrel.SEED_DROPDOWN_OPTIONS).toBeDefined();
    expect(barrel.isValidDropdownOptions).toBeDefined();
    expect(barrel.DROPDOWN_OPTION_KEYS).toBeDefined();
  });
});
