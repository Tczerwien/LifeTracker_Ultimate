import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { HabitPool, HabitCategory, InputType, PenaltyMode } from '../../../types/enums';
import type { HabitConfig, AppConfig, DailyLog } from '../../../types/models';
import HabitForm from '../HabitForm';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Track mutate calls via the Tauri invoke mock
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);

// Mock toast
vi.mock('../../shared/Toast', () => ({
  useToast: () => ({ show: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = React.useMemo(() => createTestQueryClient(), []);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

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

const habits: HabitConfig[] = [
  makeHabit({ id: 1, name: 'schoolwork', display_name: 'Schoolwork', column_name: 'schoolwork', points: 3, sort_order: 1, category: HabitCategory.Productivity }),
  makeHabit({ id: 2, name: 'personal_project', display_name: 'Personal Project', column_name: 'personal_project', points: 3, sort_order: 2, category: HabitCategory.Productivity }),
  makeHabit({ id: 5, name: 'gym', display_name: 'Gym', column_name: 'gym', points: 3, sort_order: 1, category: HabitCategory.Health }),
  makeHabit({ id: 11, name: 'meditate', display_name: 'Meditate', column_name: 'meditate', points: 1, sort_order: 1, category: HabitCategory.Growth }),
  makeHabit({ id: 14, name: 'porn', display_name: 'Porn', column_name: 'porn', pool: HabitPool.Vice, category: null, input_type: InputType.Number, points: 0, penalty: 0.25, penalty_mode: PenaltyMode.PerInstance, sort_order: 1 }),
  makeHabit({ id: 15, name: 'masturbate', display_name: 'Masturbate', column_name: 'masturbate', pool: HabitPool.Vice, category: null, points: 0, penalty: 0.10, sort_order: 2 }),
];

const mockDailyLog: DailyLog = {
  id: 1,
  date: '2026-02-18',
  schoolwork: 1, personal_project: 0, classes: 1, job_search: 0,
  gym: 1, sleep_7_9h: 0, wake_8am: 0, supplements: 0,
  meal_quality: 'Good', stretching: 0,
  meditate: 1, read: 0, social: 'None',
  porn: 2, masturbate: 0, weed: 0, skip_class: 0,
  binged_content: 0, gaming_1h: 0, past_12am: 0, late_wake: 0, phone_use: 45,
  positive_score: 0.7, vice_penalty: 0.5, base_score: 0.35, streak: 3, final_score: 0.36,
  logged_at: '2026-02-18T22:00:00Z',
  last_modified: '2026-02-18T22:30:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mock save_daily_log to return a log
  mockInvoke.mockResolvedValue(mockDailyLog);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HabitForm', () => {
  it('initializes to defaults when dailyLog is null', () => {
    render(
      <Wrapper>
        <HabitForm date="2026-02-18" dailyLog={null} habits={habits} config={mockConfig} />
      </Wrapper>,
    );
    // All checkboxes should be unchecked
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => {
      expect(cb).not.toBeChecked();
    });
  });

  it('initializes from dailyLog values when non-null', () => {
    render(
      <Wrapper>
        <HabitForm date="2026-02-18" dailyLog={mockDailyLog} habits={habits} config={mockConfig} />
      </Wrapper>,
    );
    // schoolwork=1 should be checked
    const schoolworkLabel = screen.getByText('Schoolwork');
    const schoolworkCheckbox = schoolworkLabel.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(schoolworkCheckbox.checked).toBe(true);

    // personal_project=0 should be unchecked
    const ppLabel = screen.getByText('Personal Project');
    const ppCheckbox = ppLabel.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(ppCheckbox.checked).toBe(false);
  });

  it('calls mutate immediately on checkbox toggle', async () => {
    render(
      <Wrapper>
        <HabitForm date="2026-02-18" dailyLog={null} habits={habits} config={mockConfig} />
      </Wrapper>,
    );
    // Toggle Schoolwork (currently unchecked → check it)
    act(() => {
      screen.getByText('Schoolwork').click();
    });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        'save_daily_log',
        expect.objectContaining({
          entry: expect.objectContaining({
            date: '2026-02-18',
            schoolwork: 1,
          }),
        }),
      );
    });
  });

  it('debounces porn stepper saves by 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <Wrapper>
        <HabitForm date="2026-02-18" dailyLog={null} habits={habits} config={mockConfig} />
      </Wrapper>,
    );

    // Click the Increase button on the porn stepper
    const increaseButtons = screen.getAllByLabelText('Increase');
    // The porn stepper's Increase button
    const pornIncrease = increaseButtons[0]!;

    act(() => {
      pornIncrease.click();
    });

    // Should NOT have saved yet (within 300ms debounce)
    const saveCallsBefore = mockInvoke.mock.calls.filter(
      (call) => call[0] === 'save_daily_log',
    );
    expect(saveCallsBefore).toHaveLength(0);

    // Advance past debounce — shouldAdvanceTime lets promises resolve
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Allow promise microtasks to flush
    await vi.advanceTimersByTimeAsync(0);

    await waitFor(() => {
      const saveCallsAfter = mockInvoke.mock.calls.filter(
        (call) => call[0] === 'save_daily_log',
      );
      expect(saveCallsAfter).toHaveLength(1);
      expect(saveCallsAfter[0]![1]).toEqual(
        expect.objectContaining({
          entry: expect.objectContaining({ porn: 1 }),
        }),
      );
    });
  });

  it('resets form when date prop changes', () => {
    const { rerender } = render(
      <Wrapper>
        <HabitForm date="2026-02-18" dailyLog={mockDailyLog} habits={habits} config={mockConfig} />
      </Wrapper>,
    );

    // Schoolwork should be checked (from mockDailyLog)
    const schoolworkLabel = screen.getByText('Schoolwork');
    const schoolworkCheckbox = schoolworkLabel.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(schoolworkCheckbox.checked).toBe(true);

    // Change date with null log (new day)
    rerender(
      <Wrapper>
        <HabitForm date="2026-02-19" dailyLog={null} habits={habits} config={mockConfig} />
      </Wrapper>,
    );

    // Should now be unchecked (defaults)
    const schoolworkCheckbox2 = screen.getByText('Schoolwork').closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(schoolworkCheckbox2.checked).toBe(false);
  });
});
