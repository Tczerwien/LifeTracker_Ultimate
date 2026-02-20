import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { Milestone } from '../types/models';
import type { MilestoneContext } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';
import { useToast } from '../components/shared/Toast';

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

// ---------------------------------------------------------------------------
// Post-Save Milestone Checker (RD7: post-save side effect)
// ---------------------------------------------------------------------------

/**
 * Returns a stable `checkAndToast` function that:
 * 1. Fetches the current MilestoneContext from the DB
 * 2. Checks unachieved milestones against that context
 * 3. Toasts each newly achieved milestone
 * 4. Removes the milestones query cache (forces fresh fetch on next mount)
 *
 * Milestone check failure is non-fatal and silently caught
 * so it never disrupts the primary save flow.
 */
export function useMilestoneChecker(): () => Promise<void> {
  const { show } = useToast();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    try {
      const context = await invoke<MilestoneContext>('get_milestone_context');
      const newlyAchieved = await invoke<Milestone[]>('check_milestones', {
        context,
      });

      if (newlyAchieved.length > 0) {
        // removeQueries (not invalidateQueries) because refetchOnMount: false
        // in query-client.ts would prevent stale data from refetching on page mount.
        // Removing the cache forces a fresh fetch when the Milestones page opens.
        queryClient.removeQueries({
          queryKey: INVALIDATION_PREFIXES.milestones,
        });

        for (const milestone of newlyAchieved) {
          show(`Milestone unlocked: ${milestone.name}`, 'milestone', milestone.emoji);
        }
      }
    } catch {
      // Non-fatal — milestone check failure must not disrupt the save flow
    }
  }, [show, queryClient]);
}
