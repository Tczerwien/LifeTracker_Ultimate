import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { DailyLog } from '../types/models';
import type {
  ScoreTrendPoint,
  HabitCompletionRate,
  ViceFrequency,
  DayOfWeekAvg,
  StudySummary,
  PipelineSummary,
  RecoveryFrequency,
} from '../types/commands';
import { QUERY_KEYS } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// All analytics hooks are read-only queries.
// They are invalidated by mutations in other hook files.
// ---------------------------------------------------------------------------

export function useScoreTrend(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.scoreTrend(start, end),
    queryFn: () => invoke<ScoreTrendPoint[]>('get_score_trend', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useHabitCompletionRates(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.habitCompletionRates(start, end),
    queryFn: () => invoke<HabitCompletionRate[]>('get_habit_completion_rates', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useViceFrequency(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.viceFrequency(start, end),
    queryFn: () => invoke<ViceFrequency[]>('get_vice_frequency', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useDayOfWeekAverages(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.dayOfWeekAverages(start, end),
    queryFn: () => invoke<DayOfWeekAvg[]>('get_day_of_week_averages', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

/** Returns raw DailyLog rows for client-side correlation analysis (ADR-003 SD2). */
export function useCorrelationData(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.correlationData(start, end),
    queryFn: () => invoke<DailyLog[]>('get_correlation_data', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useStudySummary(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.studySummary(start, end),
    queryFn: () => invoke<StudySummary>('get_study_summary', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

export function useApplicationPipeline() {
  return useQuery({
    queryKey: QUERY_KEYS.applicationPipeline,
    queryFn: () => invoke<PipelineSummary>('get_application_pipeline'),
  });
}

export function useRecoveryFrequency(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.recoveryFrequency(start, end),
    queryFn: () => invoke<RecoveryFrequency>('get_recovery_frequency', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}
