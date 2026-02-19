import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HabitCategory, HabitPool, InputType, PenaltyMode } from '../../../types/enums';
import type { HabitConfig, AppConfig } from '../../../types/models';
import type { DailyLogInput } from '../../../types/commands';
import HabitSection from '../HabitSection';

type HabitColumnName = keyof Omit<DailyLogInput, 'date'>;

function makeHabitConfig(overrides: Partial<HabitConfig> & { name: string; display_name: string; column_name: string }): HabitConfig {
  return {
    id: 1,
    pool: HabitPool.Good,
    category: HabitCategory.Productivity,
    input_type: InputType.Checkbox,
    points: 2,
    penalty: 0,
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

const mockConfig = {
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
  correlation_window_days: 90 as const,
  dropdown_options: '{}',
  last_modified: '2026-01-20T00:00:00Z',
} satisfies AppConfig;

describe('HabitSection', () => {
  const productivityHabits: HabitConfig[] = [
    makeHabitConfig({ id: 1, name: 'schoolwork', display_name: 'Schoolwork', column_name: 'schoolwork', points: 3, sort_order: 1 }),
    makeHabitConfig({ id: 2, name: 'personal_project', display_name: 'Personal Project', column_name: 'personal_project', points: 3, sort_order: 2 }),
    makeHabitConfig({ id: 3, name: 'classes', display_name: 'Classes', column_name: 'classes', points: 2, sort_order: 3 }),
    makeHabitConfig({ id: 4, name: 'job_search', display_name: 'Job Search', column_name: 'job_search', points: 2, sort_order: 4 }),
  ];

  it('renders correct number of habits for category', () => {
    render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Schoolwork')).toBeInTheDocument();
    expect(screen.getByText('Personal Project')).toBeInTheDocument();
    expect(screen.getByText('Classes')).toBeInTheDocument();
    expect(screen.getByText('Job Search')).toBeInTheDocument();
  });

  it('shows multiplier from config', () => {
    render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    // Productivity multiplier is 1.5
    expect(screen.getByText(/×1\.5/)).toBeInTheDocument();
  });

  it('is expanded by default', () => {
    render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    // If expanded, habit labels should be visible
    expect(screen.getByText('Schoolwork')).toBeVisible();
  });

  it('shows category label in uppercase', () => {
    render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Productivity')).toBeInTheDocument();
  });

  it('shows points for each habit', () => {
    render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    // Points are shown as (N)
    expect(screen.getAllByText('(3)')).toHaveLength(2); // schoolwork + personal_project
    expect(screen.getAllByText('(2)')).toHaveLength(2); // classes + job_search
  });

  it('calls onFieldChange when a checkbox is toggled', () => {
    const onFieldChange = vi.fn();
    render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={productivityHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={onFieldChange}
      />,
    );
    // Click the Schoolwork checkbox label
    screen.getByText('Schoolwork').click();
    expect(onFieldChange).toHaveBeenCalledWith('schoolwork' as HabitColumnName, 1);
  });

  it('renders nothing when habits array is empty', () => {
    const { container } = render(
      <HabitSection
        category={HabitCategory.Productivity}
        habits={[]}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders dropdown habit with correct options', () => {
    const healthHabits: HabitConfig[] = [
      makeHabitConfig({
        id: 9,
        name: 'meal_quality',
        display_name: 'Meal Quality',
        column_name: 'meal_quality',
        category: HabitCategory.Health,
        input_type: InputType.Dropdown,
        points: 3,
        sort_order: 5,
        options_json: '{"Poor":0,"Okay":1,"Good":2,"Great":3}',
      }),
    ];
    render(
      <HabitSection
        category={HabitCategory.Health}
        habits={healthHabits}
        config={mockConfig}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Meal Quality:')).toBeInTheDocument();
    // Should have None (prepended) + Poor, Okay, Good, Great = 5 options
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(5);
    expect(options[0]!.textContent).toBe('None');
    expect(options[1]!.textContent).toBe('Poor');
  });
});
