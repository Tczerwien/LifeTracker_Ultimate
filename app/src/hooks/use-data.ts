import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { DbStats, TestDataSummary } from '../types/commands';
import { QUERY_KEYS } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDbStats() {
  return useQuery({
    queryKey: QUERY_KEYS.dbStats,
    queryFn: () => invoke<DbStats>('get_db_stats'),
  });
}

export function useDbPath() {
  return useQuery({
    queryKey: QUERY_KEYS.dbPath,
    queryFn: () => invoke<string>('get_db_path'),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useExportData() {
  return useMutation({
    mutationFn: () => invoke<string>('export_data'),
  });
}

export function useImportData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (json: string) => invoke<void>('import_data', { json }),
    onSuccess: () => {
      // Import replaces all data — clear entire cache so reload starts fresh
      queryClient.clear();
    },
  });
}

export function useBackupNow() {
  return useMutation({
    mutationFn: (destination: string) =>
      invoke<string>('backup_now', { destination }),
  });
}

export function useGenerateTestData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => invoke<TestDataSummary>('generate_test_data'),
    onSuccess: () => {
      // Test data replaces all data — clear entire cache so everything reloads
      queryClient.clear();
    },
  });
}

// ---------------------------------------------------------------------------
// File I/O utilities (not hooks — direct invoke wrappers for Data tab)
// ---------------------------------------------------------------------------

export function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export function writeTextFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_text_file', { path, content });
}
