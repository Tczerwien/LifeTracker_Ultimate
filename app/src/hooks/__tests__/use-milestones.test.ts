import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useMilestones, useCheckMilestones } from '../use-milestones';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMilestones', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useMilestones(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_milestones');
  });
});

describe('useCheckMilestones', () => {
  it('invalidates milestones query', async () => {
    const context = {
      current_streak: 5,
      total_days_tracked: 30,
      total_study_hours: 50,
      total_applications: 10,
      consecutive_clean_days: 14,
      highest_score: 0.95,
      avg_score_7d: 0.82,
      high_focus_sessions: 8,
    };
    mockInvoke.mockResolvedValueOnce([]);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCheckMilestones(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(context);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('check_milestones', { context });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['milestones'] });
  });
});
