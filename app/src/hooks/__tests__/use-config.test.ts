import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  useConfig,
  useHabitConfigs,
  useSaveConfig,
  useSaveHabitConfig,
  useRetireHabit,
  useReorderHabits,
} from '../use-config';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useConfig', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce({ id: 'default' });
    const { result } = renderHook(() => useConfig(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_config');
  });
});

describe('useHabitConfigs', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useHabitConfigs(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_habit_configs');
  });
});

describe('useSaveConfig', () => {
  it('invalidates config query', async () => {
    mockInvoke.mockResolvedValueOnce({ id: 'default' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveConfig(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      start_date: '2026-01-01',
      multiplier_productivity: 1.5,
      multiplier_health: 1.3,
      multiplier_growth: 1.0,
      target_fraction: 0.85,
      vice_cap: 0.4,
      streak_threshold: 0.65,
      streak_bonus_per_day: 0.01,
      max_streak_bonus: 0.1,
      phone_t1_min: 61,
      phone_t2_min: 181,
      phone_t3_min: 301,
      phone_t1_penalty: 0.03,
      phone_t2_penalty: 0.07,
      phone_t3_penalty: 0.12,
      correlation_window_days: 90,
      dropdown_options: '{}',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['config'] });
  });
});

describe('useSaveHabitConfig', () => {
  it('invalidates habit-configs query', async () => {
    mockInvoke.mockResolvedValueOnce({ id: 1 });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveHabitConfig(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({
      id: null,
      name: 'test_habit',
      display_name: 'Test',
      pool: 'good',
      category: 'productivity',
      input_type: 'checkbox',
      points: 2,
      penalty: 0,
      penalty_mode: 'flat',
      options_json: null,
      sort_order: 99,
      is_active: true,
      column_name: 'test_habit',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habit-configs'] });
  });
});

describe('useRetireHabit', () => {
  it('invalidates habit-configs query', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetireHabit(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('retire_habit', { id: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habit-configs'] });
  });
});

describe('useReorderHabits', () => {
  it('invalidates habit-configs query', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReorderHabits(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate([3, 1, 2]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('reorder_habits', { ids: [3, 1, 2] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habit-configs'] });
  });
});
