import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  useDbStats,
  useDbPath,
  useExportData,
  useImportData,
  useBackupNow,
} from '../use-data';
import { createWrapper, createTestQueryClient } from './test-utils';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDbStats', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce({ file_size_bytes: 1024, table_counts: [] });
    const { result } = renderHook(() => useDbStats(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_db_stats');
  });
});

describe('useDbPath', () => {
  it('calls invoke with correct command', async () => {
    mockInvoke.mockResolvedValueOnce('/path/to/ltu.db');
    const { result } = renderHook(() => useDbPath(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockInvoke).toHaveBeenCalledWith('get_db_path');
  });
});

describe('useExportData', () => {
  it('calls invoke and returns JSON string', async () => {
    mockInvoke.mockResolvedValueOnce('{"_meta":{}}');

    const { result } = renderHook(() => useExportData(), {
      wrapper: createWrapper(),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('export_data');
    expect(result.current.data).toBe('{"_meta":{}}');
  });
});

describe('useImportData', () => {
  it('clears ALL query cache on success', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    const queryClient = createTestQueryClient();
    const clearSpy = vi.spyOn(queryClient, 'clear');

    const { result } = renderHook(() => useImportData(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate('{"_meta":{"schema_version":1}}');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('import_data', { json: '{"_meta":{"schema_version":1}}' });
    // Should clear entire cache so page reload starts fresh
    expect(clearSpy).toHaveBeenCalled();
  });
});

describe('useBackupNow', () => {
  it('calls invoke with destination', async () => {
    mockInvoke.mockResolvedValueOnce('/backup/ltu.db');

    const { result } = renderHook(() => useBackupNow(), {
      wrapper: createWrapper(),
    });

    result.current.mutate('/backup/ltu.db');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockInvoke).toHaveBeenCalledWith('backup_now', { destination: '/backup/ltu.db' });
    expect(result.current.data).toBe('/backup/ltu.db');
  });
});
