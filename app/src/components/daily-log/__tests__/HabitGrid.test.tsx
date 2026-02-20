import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HabitPool, HabitCategory, InputType, PenaltyMode } from '../../../types/enums';
import type { HabitConfig } from '../../../types/models';
import type { DailyLogInput } from '../../../types/commands';
import HabitGrid from '../HabitGrid';

function makeHabit(overrides: Partial<HabitConfig> & { id: number; name: string; display_name: string; column_name: string }): HabitConfig {
  return {
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

const checkboxHabits: HabitConfig[] = [
  makeHabit({ id: 1, name: 'schoolwork', display_name: 'Schoolwork', column_name: 'schoolwork', points: 3, sort_order: 1 }),
  makeHabit({ id: 2, name: 'personal_project', display_name: 'Personal Project', column_name: 'personal_project', points: 3, sort_order: 2 }),
];

const dropdownHabit: HabitConfig = makeHabit({
  id: 9,
  name: 'meal_quality',
  display_name: 'Meal Quality',
  column_name: 'meal_quality',
  category: HabitCategory.Health,
  input_type: InputType.Dropdown,
  points: 3,
  sort_order: 5,
  options_json: '{"Poor":0,"Okay":1,"Good":2,"Great":3}',
});

describe('HabitGrid', () => {
  it('renders checkbox habits with point labels', () => {
    render(
      <HabitGrid
        habits={checkboxHabits}
        category={HabitCategory.Productivity}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Schoolwork')).toBeInTheDocument();
    expect(screen.getByText('Personal Project')).toBeInTheDocument();
    expect(screen.getAllByText('(3)')).toHaveLength(2);
  });

  it('renders dropdown habits with correct options', () => {
    render(
      <HabitGrid
        habits={[dropdownHabit]}
        category={HabitCategory.Health}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Meal Quality:')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    // None (prepended) + Poor, Okay, Good, Great = 5
    expect(options).toHaveLength(5);
    expect(options[0]!.textContent).toBe('None');
    expect(options[1]!.textContent).toBe('Poor');
    expect(options[2]!.textContent).toBe('Okay');
    expect(options[3]!.textContent).toBe('Good');
    expect(options[4]!.textContent).toBe('Great');
  });

  it('calls onFieldChange with correct field name on checkbox toggle', () => {
    const onFieldChange = vi.fn();
    render(
      <HabitGrid
        habits={checkboxHabits}
        category={HabitCategory.Productivity}
        formState={defaultFormState}
        onFieldChange={onFieldChange}
      />,
    );
    screen.getByText('Schoolwork').click();
    expect(onFieldChange).toHaveBeenCalledWith('schoolwork', 1);
  });

  it('calls onFieldChange with string value on dropdown change', () => {
    const onFieldChange = vi.fn();
    render(
      <HabitGrid
        habits={[dropdownHabit]}
        category={HabitCategory.Health}
        formState={defaultFormState}
        onFieldChange={onFieldChange}
      />,
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Good' } });
    expect(onFieldChange).toHaveBeenCalledWith('meal_quality', 'Good');
  });

  it('prepends None option when not in options_json', () => {
    const habitWithoutNone = makeHabit({
      id: 13,
      name: 'social',
      display_name: 'Social',
      column_name: 'social',
      category: HabitCategory.Growth,
      input_type: InputType.Dropdown,
      points: 2,
      sort_order: 3,
      options_json: '{"Brief/Text":0.5,"Casual Hangout":1,"Meaningful Connection":2}',
    });
    render(
      <HabitGrid
        habits={[habitWithoutNone]}
        category={HabitCategory.Growth}
        formState={defaultFormState}
        onFieldChange={vi.fn()}
      />,
    );
    const options = screen.getAllByRole('option');
    expect(options[0]!.textContent).toBe('None');
    expect(options).toHaveLength(4); // None + 3 options
  });

  it('shows checked state with good background', () => {
    const checkedState = { ...defaultFormState, schoolwork: 1 };
    render(
      <HabitGrid
        habits={checkboxHabits}
        category={HabitCategory.Productivity}
        formState={checkedState}
        onFieldChange={vi.fn()}
      />,
    );
    const label = screen.getByText('Schoolwork').closest('label');
    expect(label?.className).toContain('bg-surface-good');
  });
});
