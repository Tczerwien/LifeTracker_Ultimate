import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { Milestone } from '../types/models';
import type { MilestoneContext } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMilestones() {
  return useQuery({
    queryKey: QUERY_KEYS.milestones,
    queryFn: () => invoke<Milestone[]>('get_milestones'),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCheckMilestones() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (context: MilestoneContext) =>
      invoke<Milestone[]>('check_milestones', { context }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.milestones });
    },
  });
}
