import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { DailyLog } from '../types/models';
import type { DailyLogInput } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';
import { useMilestoneChecker } from './use-milestones';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDailyLog(date: string) {
  return useQuery({
    queryKey: QUERY_KEYS.dailyLog(date),
    queryFn: () => invoke<DailyLog | null>('get_daily_log', { date }),
    enabled: date.length > 0,
  });
}

export function useDailyLogRange(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.dailyLogRange(start, end),
    queryFn: () => invoke<DailyLog[]>('get_daily_logs', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useStreakAtDate(date: string) {
  return useQuery({
    queryKey: QUERY_KEYS.streakAtDate(date),
    queryFn: () => invoke<number>('get_streak_at_date', { date }),
    enabled: date.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveDailyLog() {
  const queryClient = useQueryClient();
  const checkMilestones = useMilestoneChecker();

  return useMutation({
    mutationFn: (entry: DailyLogInput) =>
      invoke<DailyLog>('save_daily_log', { entry }),
    onSuccess: () => {
      // ADR-005 SD3: invalidate all dependent query prefixes
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.dailyLog });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.scoreTrend });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.streakHistory });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.habitCompletionRates });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.correlationData });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.dayOfWeekAverages });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.viceFrequency });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
      // Phase 16: check milestones after save (RD7 post-save side effect)
      void checkMilestones();
    },
  });
}
