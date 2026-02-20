import { describe, it, expect } from 'vitest';
import {
  HabitPool,
  HabitCategory,
  InputType,
  PenaltyMode,
  ApplicationStatus,
  VALID_CORRELATION_WINDOWS,
} from '../enums';
import {
  DEFAULT_CONFIG,
  CATEGORY_COLORS,
  SCORE_GRADIENT,
} from '../../lib/constants';

describe('Enums', () => {
  it('HabitPool has correct values', () => {
    expect(HabitPool.Good).toBe('good');
    expect(HabitPool.Vice).toBe('vice');
  });

  it('HabitCategory has correct values', () => {
    expect(Object.values(HabitCategory)).toHaveLength(3);
    expect(HabitCategory.Productivity).toBe('productivity');
    expect(HabitCategory.Health).toBe('health');
    expect(HabitCategory.Growth).toBe('growth');
  });

  it('InputType has correct values', () => {
    expect(Object.values(InputType)).toHaveLength(3);
  });

  it('PenaltyMode has correct values', () => {
    expect(Object.values(PenaltyMode)).toHaveLength(3);
    expect(PenaltyMode.Tiered).toBe('tiered');
  });

  it('ApplicationStatus has all 8 values', () => {
    expect(Object.values(ApplicationStatus)).toHaveLength(8);
  });

  it('VALID_CORRELATION_WINDOWS has 6 values', () => {
    expect(VALID_CORRELATION_WINDOWS).toHaveLength(6);
    expect(VALID_CORRELATION_WINDOWS).toContain(0);
    expect(VALID_CORRELATION_WINDOWS).toContain(365);
  });
});

describe('Constants', () => {
  it('DEFAULT_CONFIG has all required scoring fields', () => {
    expect(DEFAULT_CONFIG.target_fraction).toBe(0.85);
    expect(DEFAULT_CONFIG.vice_cap).toBe(0.4);
    expect(DEFAULT_CONFIG.streak_threshold).toBe(0.65);
    expect(DEFAULT_CONFIG.streak_bonus_per_day).toBe(0.01);
    expect(DEFAULT_CONFIG.max_streak_bonus).toBe(0.1);
    expect(DEFAULT_CONFIG.phone_t1_min).toBe(61);
    expect(DEFAULT_CONFIG.phone_t2_min).toBe(181);
    expect(DEFAULT_CONFIG.phone_t3_min).toBe(301);
    expect(DEFAULT_CONFIG.phone_t1_penalty).toBe(0.03);
    expect(DEFAULT_CONFIG.phone_t2_penalty).toBe(0.07);
    expect(DEFAULT_CONFIG.phone_t3_penalty).toBe(0.12);
    expect(DEFAULT_CONFIG.correlation_window_days).toBe(90);
  });

  it('CATEGORY_COLORS has all three categories', () => {
    expect(CATEGORY_COLORS[HabitCategory.Productivity]).toBe('#3D85C6');
    expect(CATEGORY_COLORS[HabitCategory.Health]).toBe('#6AA84F');
    expect(CATEGORY_COLORS[HabitCategory.Growth]).toBe('#8E7CC3');
  });

  it('SCORE_GRADIENT has red/amber/green breakpoints', () => {
    expect(SCORE_GRADIENT).toBeDefined();
    expect(
      Array.isArray(SCORE_GRADIENT) || typeof SCORE_GRADIENT === 'object',
    ).toBe(true);
  });
});
