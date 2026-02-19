import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  useRelapseEntries,
  useUrgeEntries,
  useSaveRelapseEntry,
  useUpdateRelapseEntry,
  useSaveUrgeEntry,
  useUpdateUrgeEntry,
} from '../use-recovery';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRelapseEntries', () => {
  it('calls invoke with start and end', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useRelapseEntries('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_relapse_entries', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('does not fetch with empty range', () => {
    const { result } = renderHook(
      () => useRelapseEntries('', ''),
      { wrapper: createWrapper() },
    );
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useUrgeEntries', () => {
  it('calls invoke with start and end', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useUrgeEntries('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_urge_entries', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useSaveRelapseEntry', () => {
  it('invalidates relapse-entries and recovery-frequency', async () => {
    const entry = {
      date: '2026-02-18',
      time: '23:00',
      duration: '< 5 min',
      trigger: 'Boredom',
      location: 'Bedroom',
      device: 'Phone',
      activity_before: 'Scrolling',
      emotional_state: 'Stressed',
      resistance_technique: 'None',
      urge_intensity: 7,
      notes: '',
      urge_entry_id: null,
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...entry, created_at: '', last_modified: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveRelapseEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(entry);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_relapse_entry', { entry });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['relapse-entries'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recovery-frequency'] });
  });
});

describe('useUpdateRelapseEntry', () => {
  it('calls invoke with id and entry', async () => {
    const entry = {
      date: '2026-02-18',
      time: '23:00',
      duration: '5-15 min',
      trigger: 'Boredom',
      location: 'Bedroom',
      device: 'Phone',
      activity_before: 'Scrolling',
      emotional_state: 'Stressed',
      resistance_technique: 'None',
      urge_intensity: 7,
      notes: 'Updated',
      urge_entry_id: null,
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...entry, created_at: '', last_modified: '' });

    const { result } = renderHook(() => useUpdateRelapseEntry(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1, entry });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('update_relapse_entry', { id: 1, entry });
  });
});

describe('useSaveUrgeEntry', () => {
  it('invalidates urge-entries and recovery-frequency', async () => {
    const entry = {
      date: '2026-02-18',
      time: '22:00',
      intensity: 6,
      technique: 'Cold Shower',
      effectiveness: 4,
      duration: '5-15 min',
      did_pass: 'Yes - completely',
      trigger: 'Stress',
      notes: '',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...entry, created_at: '', last_modified: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveUrgeEntry(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(entry);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_urge_entry', { entry });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['urge-entries'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['recovery-frequency'] });
  });
});

describe('useUpdateUrgeEntry', () => {
  it('calls invoke with id and entry', async () => {
    const entry = {
      date: '2026-02-18',
      time: '22:00',
      intensity: 8,
      technique: 'Meditation',
      effectiveness: 3,
      duration: '1-5 min',
      did_pass: 'Partially',
      trigger: 'Boredom',
      notes: '',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...entry, created_at: '', last_modified: '' });

    const { result } = renderHook(() => useUpdateUrgeEntry(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1, entry });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('update_urge_entry', { id: 1, entry });
  });
});
