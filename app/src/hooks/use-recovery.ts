import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { RelapseEntry, UrgeEntry } from '../types/models';
import type { RelapseEntryInput, UrgeEntryInput } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useRelapseEntries(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.relapseEntries(start, end),
    queryFn: () => invoke<RelapseEntry[]>('get_relapse_entries', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useUrgeEntries(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.urgeEntries(start, end),
    queryFn: () => invoke<UrgeEntry[]>('get_urge_entries', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveRelapseEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: RelapseEntryInput) =>
      invoke<RelapseEntry>('save_relapse_entry', { entry }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.relapseEntries });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.recoveryFrequency });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    },
  });
}

export function useUpdateRelapseEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: RelapseEntryInput }) =>
      invoke<RelapseEntry>('update_relapse_entry', { id, entry }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.relapseEntries });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.recoveryFrequency });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    },
  });
}

export function useSaveUrgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: UrgeEntryInput) =>
      invoke<UrgeEntry>('save_urge_entry', { entry }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.urgeEntries });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.recoveryFrequency });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    },
  });
}

export function useUpdateUrgeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: UrgeEntryInput }) =>
      invoke<UrgeEntry>('update_urge_entry', { id, entry }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.urgeEntries });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.recoveryFrequency });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    },
  });
}
