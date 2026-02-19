import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useWeeklyReview, useWeeklyStats, useSaveWeeklyReview } from '../use-review';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useWeeklyReview', () => {
  it('calls invoke with weekStart', async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWeeklyReview('2026-02-10'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_weekly_review', { weekStart: '2026-02-10' });
  });

  it('does not fetch with empty weekStart', () => {
    const { result } = renderHook(() => useWeeklyReview(''), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useWeeklyStats', () => {
  it('calls compute_weekly_stats', async () => {
    mockInvoke.mockResolvedValueOnce({
      avg_score: 0.75,
      days_tracked: 7,
      best_day_score: 0.9,
      worst_day_score: 0.5,
      total_study_hours: 14.5,
      applications_sent: 3,
      relapses: 0,
      urges_resisted: 2,
      current_streak: 5,
    });
    const { result } = renderHook(() => useWeeklyStats('2026-02-10'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('compute_weekly_stats', { weekStart: '2026-02-10' });
  });
});

describe('useSaveWeeklyReview', () => {
  it('invalidates weekly-review queries', async () => {
    const review = {
      week_start: '2026-02-10',
      week_end: '2026-02-16',
      week_number: 7,
      biggest_win: 'Streak',
      biggest_challenge: 'Sleep',
      next_week_goal: 'Exercise daily',
      reflection: 'Good week',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...review, avg_score: null, days_tracked: null, best_day_score: null, worst_day_score: null, habits_completed: null, study_hours: null, applications_sent: null, relapses: null, urges_resisted: null, streak_at_end: null, snapshot_date: null, score_snapshot: null, logged_at: '', last_modified: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveWeeklyReview(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(review);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_weekly_review', { review });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['weekly-review'] });
  });
});
