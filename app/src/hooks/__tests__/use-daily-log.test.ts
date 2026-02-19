import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useDailyLog, useDailyLogRange, useStreakAtDate, useSaveDailyLog } from '../use-daily-log';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('useDailyLog', () => {
  it('calls invoke with correct command and date', async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useDailyLog('2026-02-18'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_daily_log', { date: '2026-02-18' });
  });

  it('does not fetch when date is empty', () => {
    const { result } = renderHook(() => useDailyLog(''), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('useDailyLogRange', () => {
  it('calls invoke with correct command and range', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useDailyLogRange('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_daily_logs', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('does not fetch when start is empty', () => {
    const { result } = renderHook(
      () => useDailyLogRange('', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useStreakAtDate', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce(5);
    const { result } = renderHook(() => useStreakAtDate('2026-02-18'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_streak_at_date', { date: '2026-02-18' });
    expect(result.current.data).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

describe('useSaveDailyLog', () => {
  it('calls invoke with correct command and invalidates dependent queries', async () => {
    const mockEntry = {
      date: '2026-02-18',
      schoolwork: 1, personal_project: 0, classes: 1, job_search: 0,
      gym: 1, sleep_7_9h: 1, wake_8am: 0, supplements: 1,
      meal_quality: 'Good', stretching: 0,
      meditate: 1, read: 0, social: 'None',
      porn: 0, masturbate: 0, weed: 0, skip_class: 0,
      binged_content: 0, gaming_1h: 0, past_12am: 0, late_wake: 0, phone_use: 45,
    };
    const mockResponse = { id: 1, ...mockEntry, positive_score: 0.7, vice_penalty: 0, base_score: 0.7, streak: 3, final_score: 0.72, logged_at: '', last_modified: '' };
    mockInvoke.mockResolvedValueOnce(mockResponse);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveDailyLog(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(mockEntry);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_daily_log', { entry: mockEntry });

    // ADR-005 SD3: 7 query families invalidated
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-log'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['score-trend'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['streak-history'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habit-completion-rates'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['correlation-data'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['day-of-week-averages'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vice-frequency'] });
  });
});
