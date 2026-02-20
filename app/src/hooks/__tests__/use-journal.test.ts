import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useJournal, useSaveJournal } from '../use-journal';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useJournal', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useJournal('2026-02-18'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_journal', { date: '2026-02-18' });
  });

  it('does not fetch when date is empty', () => {
    const { result } = renderHook(() => useJournal(''), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useSaveJournal', () => {
  it('calls invoke and invalidates journal queries', async () => {
    const entry = {
      date: '2026-02-18',
      mood: 4,
      energy: 3,
      highlight: 'Good day',
      gratitude: 'Family',
      reflection: 'Productive',
      tomorrow_goal: 'Exercise',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...entry, logged_at: '', last_modified: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveJournal(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(entry);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_journal', { entry });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['journal'] });
  });
});
