import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  useStudySessions,
  useStudySessionsRange,
  useSaveStudySession,
  useUpdateStudySession,
  useDeleteStudySession,
} from '../use-study';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useStudySessions', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useStudySessions('2026-02-18'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_study_sessions', { date: '2026-02-18' });
  });
});

describe('useStudySessionsRange', () => {
  it('calls invoke with correct command and range', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(
      () => useStudySessionsRange('2026-02-01', '2026-02-28'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_study_sessions_range', {
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('useSaveStudySession', () => {
  it('invalidates study-sessions and study-summary', async () => {
    const session = {
      date: '2026-02-18',
      subject: 'Math',
      study_type: 'Self-Study',
      start_time: '09:00',
      end_time: '11:00',
      duration_minutes: 120,
      focus_score: 4,
      location: 'Library',
      topic: 'Calculus',
      resources: '',
      notes: '',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...session, logged_at: '', last_modified: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveStudySession(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(session);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_study_session', { session });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['study-sessions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['study-summary'] });
  });
});

describe('useUpdateStudySession', () => {
  it('calls invoke with id and session', async () => {
    const session = {
      date: '2026-02-18',
      subject: 'Math',
      study_type: 'Self-Study',
      start_time: '09:00',
      end_time: '11:30',
      duration_minutes: 150,
      focus_score: 5,
      location: 'Library',
      topic: 'Calculus',
      resources: '',
      notes: 'Updated',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...session, logged_at: '', last_modified: '' });

    const { result } = renderHook(() => useUpdateStudySession(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 1, session });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('update_study_session', { id: 1, session });
  });
});

describe('useDeleteStudySession', () => {
  it('calls invoke with id', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteStudySession(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('delete_study_session', { id: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['study-sessions'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['study-summary'] });
  });
});
