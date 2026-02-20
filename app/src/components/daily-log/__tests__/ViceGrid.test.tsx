import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HabitPool, InputType, PenaltyMode } from '../../../types/enums';
import type { HabitConfig, AppConfig } from '../../../types/models';
import type { DailyLogInput } from '../../../types/commands';
import ViceGrid from '../ViceGrid';

function makeVice(overrides: Partial<HabitConfig> & { id: number; name: string; display_name: string; column_name: string }): HabitConfig {
  return {
    pool: HabitPool.Vice,
    category: null,
    input_type: InputType.Checkbox,
    points: 0,
    penalty: 0.10,
    penalty_mode: PenaltyMode.Flat,
    options_json: null,
    sort_order: 1,
    is_active: true,
    created_at: '2026-01-20T00:00:00Z',
    retired_at: null,
    ...overrides,
  };
}

const defaultFormState: Omit<DailyLogInput, 'date'> = {
  schoolwork: 0, personal_project: 0, classes: 0, job_search: 0,
  gym: 0, sleep_7_9h: 0, wake_8am: 0, supplements: 0,
  meal_quality: 'None', stretching: 0,
  meditate: 0, read: 0, social: 'None',
  porn: 0, masturbate: 0, weed: 0, skip_class: 0,
  binged_content: 0, gaming_1h: 0, past_12am: 0, late_wake: 0, phone_use: 0,
};

const mockConfig: AppConfig = {
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
  phone_t1_min: 61, phone_t2_min: 181, phone_t3_min: 301,
  phone_t1_penalty: 0.03, phone_t2_penalty: 0.07, phone_t3_penalty: 0.12,
  correlation_window_days: 90,
  dropdown_options: '{}',
  last_modified: '2026-01-20T00:00:00Z',
};

const checkboxVices: HabitConfig[] = [
  makeVice({ id: 15, name: 'masturbate', display_name: 'Masturbate', column_name: 'masturbate', penalty: 0.10, sort_order: 1 }),
  makeVice({ id: 16, name: 'weed', display_name: 'Weed', column_name: 'weed', penalty: 0.12, sort_order: 2 }),
];

const allVices: HabitConfig[] = [
  makeVice({ id: 14, name: 'porn', display_name: 'Porn', column_name: 'porn', input_type: InputType.Number, penalty: 0.25, penalty_mode: PenaltyMode.PerInstance, sort_order: 1 }),
  ...checkboxVices,
  makeVice({ id: 22, name: 'phone_use', display_name: 'Phone (min)', column_name: 'phone_use', input_type: InputType.Number, penalty: 0, penalty_mode: PenaltyMode.Tiered, sort_order: 9 }),
];

describe('ViceGrid', () => {
  it('renders checkbox vices with penalty labels', () => {
    render(
      <ViceGrid
        habits={checkboxVices}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(screen.getByText('Masturbate')).toBeInTheDocument();
    expect(screen.getByText('(-0.10)')).toBeInTheDocument();
    expect(screen.getByText('Weed')).toBeInTheDocument();
    expect(screen.getByText('(-0.12)')).toBeInTheDocument();
  });

  it('renders porn stepper', () => {
    render(
      <ViceGrid
        habits={allVices}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(screen.getByText('Porn:')).toBeInTheDocument();
    expect(screen.getByLabelText('Increase')).toBeInTheDocument();
    expect(screen.getByLabelText('Decrease')).toBeInTheDocument();
  });

  it('shows porn penalty calculation when count > 0', () => {
    const stateWithPorn = { ...defaultFormState, porn: 2 };
    render(
      <ViceGrid
        habits={allVices}
        formState={stateWithPorn}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    // 2 × 0.25 = 0.50
    expect(screen.getByText(/0\.50/)).toBeInTheDocument();
  });

  it('renders phone input as full-width', () => {
    render(
      <ViceGrid
        habits={allVices}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(screen.getByText('Phone (min):')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone use in minutes')).toBeInTheDocument();
  });

  it('calls onFieldChange on checkbox toggle', () => {
    const onFieldChange = vi.fn();
    render(
      <ViceGrid
        habits={checkboxVices}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={onFieldChange}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    screen.getByText('Masturbate').click();
    expect(onFieldChange).toHaveBeenCalledWith('masturbate', 1);
  });

  it('calls onPornChange on stepper click', () => {
    const onPornChange = vi.fn();
    render(
      <ViceGrid
        habits={allVices}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={onPornChange}
        onPhoneBlur={vi.fn()}
      />,
    );
    screen.getByLabelText('Increase').click();
    expect(onPornChange).toHaveBeenCalledWith(1);
  });

  it('shows vice background color when checked', () => {
    const checkedState = { ...defaultFormState, masturbate: 1 };
    render(
      <ViceGrid
        habits={checkboxVices}
        formState={checkedState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    const label = screen.getByText('Masturbate').closest('label');
    expect(label?.className).toContain('bg-surface-vice');
  });
});
