import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HabitPool, InputType, PenaltyMode } from '../../../types/enums';
import type { HabitConfig, AppConfig } from '../../../types/models';
import type { DailyLogInput } from '../../../types/commands';
import ViceSection from '../ViceSection';

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

const viceHabits: HabitConfig[] = [
  makeVice({ id: 14, name: 'masturbate', display_name: 'Masturbate', column_name: 'masturbate', penalty: 0.10, sort_order: 1 }),
  makeVice({ id: 15, name: 'weed', display_name: 'Weed', column_name: 'weed', penalty: 0.12, sort_order: 2 }),
];

describe('ViceSection', () => {
  it('renders "Vices" header', () => {
    render(
      <ViceSection
        habits={viceHabits}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(screen.getByText('Vices')).toBeInTheDocument();
  });

  it('renders all vice habits', () => {
    render(
      <ViceSection
        habits={viceHabits}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(screen.getByText('Masturbate')).toBeInTheDocument();
    expect(screen.getByText('Weed')).toBeInTheDocument();
  });

  it('returns null when habits array is empty', () => {
    const { container } = render(
      <ViceSection
        habits={[]}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('is expanded by default', () => {
    render(
      <ViceSection
        habits={viceHabits}
        formState={defaultFormState}
        config={mockConfig}
        onFieldChange={vi.fn()}
        onPornChange={vi.fn()}
        onPhoneBlur={vi.fn()}
      />,
    );
    expect(screen.getByText('Masturbate')).toBeVisible();
  });
});
