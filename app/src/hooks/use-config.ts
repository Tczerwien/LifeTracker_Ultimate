import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { AppConfig, HabitConfig } from '../types/models';
import type { AppConfigInput, HabitConfigSaveInput } from '../types/commands';
import { QUERY_KEYS } from '../lib/query-keys';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useConfig() {
  return useQuery({
    queryKey: QUERY_KEYS.config,
    queryFn: () => invoke<AppConfig>('get_config'),
  });
}

export function useHabitConfigs() {
  return useQuery({
    queryKey: QUERY_KEYS.habitConfigs,
    queryFn: () => invoke<HabitConfig[]>('get_habit_configs'),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useSaveConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AppConfigInput) =>
      invoke<AppConfig>('save_config', { config }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.config });
    },
  });
}

export function useSaveHabitConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (habit: HabitConfigSaveInput) =>
      invoke<HabitConfig>('save_habit_config', { habit }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.habitConfigs });
    },
  });
}

export function useRetireHabit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      invoke<void>('retire_habit', { id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.habitConfigs });
    },
  });
}

export function useReorderHabits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) =>
      invoke<void>('reorder_habits', { ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.habitConfigs });
    },
  });
}
