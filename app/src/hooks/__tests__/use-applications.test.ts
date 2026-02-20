import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  useApplications,
  useApplication,
  useStatusHistory,
  useSaveApplication,
  useArchiveApplication,
  useAddStatusChange,
} from '../use-applications';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useApplications', () => {
  it('calls invoke with empty filters by default', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useApplications(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_applications', { filters: {} });
  });

  it('passes filters when provided', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const filters = { status: ['applied'], search: 'Google' };
    const { result } = renderHook(() => useApplications(filters), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_applications', { filters });
  });
});

describe('useApplication', () => {
  it('calls invoke with id', async () => {
    mockInvoke.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useApplication(1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_application', { id: 1 });
  });

  it('does not fetch when id is 0', () => {
    const { result } = renderHook(() => useApplication(0), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useStatusHistory', () => {
  it('calls invoke with appId', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useStatusHistory(1), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_status_history', { appId: 1 });
  });
});

describe('useSaveApplication', () => {
  it('invalidates applications and pipeline', async () => {
    const app = {
      date_applied: '2026-02-18',
      company: 'Acme',
      role: 'Dev',
      source: 'LinkedIn',
      url: '',
      notes: '',
      follow_up_date: null,
      salary: '',
      contact_name: '',
      contact_email: '',
      login_username: '',
      login_password: '',
    };
    mockInvoke.mockResolvedValueOnce({ id: 1, ...app, current_status: 'applied', archived: false, logged_at: '', last_modified: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveApplication(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(app);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('save_application', { app });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['application-pipeline'] });
  });
});

describe('useArchiveApplication', () => {
  it('invalidates applications and pipeline', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useArchiveApplication(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('archive_application', { id: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['application-pipeline'] });
  });
});

describe('useAddStatusChange', () => {
  it('invalidates applications, pipeline, and status-history', async () => {
    const change = { status: 'interview', changed_date: '2026-02-18' };
    mockInvoke.mockResolvedValueOnce({ id: 1, application_id: 1, status: 'interview', date: '2026-02-18', notes: '', created_at: '' });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAddStatusChange(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ appId: 1, change });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('add_status_change', { appId: 1, change });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['application-pipeline'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['status-history'] });
  });
});
