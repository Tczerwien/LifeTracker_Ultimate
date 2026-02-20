import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { Journal } from '../types/models';
import type { JournalInput } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useJournal(date: string) {
  return useQuery({
    queryKey: QUERY_KEYS.journal(date),
    queryFn: () => invoke<Journal | null>('get_journal', { date }),
    enabled: date.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveJournal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: JournalInput) =>
      invoke<Journal>('save_journal', { entry }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.journal });
    },
  });
}
