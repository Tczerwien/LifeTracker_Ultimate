import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { WeeklyReview } from '../types/models';
import type { WeeklyReviewInput, WeeklyStats } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useWeeklyReview(weekStart: string) {
  return useQuery({
    queryKey: QUERY_KEYS.weeklyReview(weekStart),
    queryFn: () => invoke<WeeklyReview | null>('get_weekly_review', { weekStart }),
    enabled: weekStart.length > 0,
  });
}

export function useWeeklyStats(weekStart: string) {
  return useQuery({
    queryKey: QUERY_KEYS.weeklyStats(weekStart),
    queryFn: () => invoke<WeeklyStats>('compute_weekly_stats', { weekStart }),
    enabled: weekStart.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveWeeklyReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (review: WeeklyReviewInput) =>
      invoke<WeeklyReview>('save_weekly_review', { review }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyReview });
    },
  });
}
