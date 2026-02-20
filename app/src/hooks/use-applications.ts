import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { Application, StatusChange } from '../types/models';
import type { ApplicationInput, AppFilters, StatusChangeInput } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';
import { useMilestoneChecker } from './use-milestones';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useApplications(filters?: AppFilters) {
  return useQuery({
    queryKey: filters
      ? ([...QUERY_KEYS.applications, filters] as const)
      : QUERY_KEYS.applications,
    queryFn: () => invoke<Application[]>('get_applications', { filters: filters ?? {} }),
  });
}

export function useApplication(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.application(id),
    queryFn: () => invoke<Application | null>('get_application', { id }),
    enabled: id > 0,
  });
}

export function useStatusHistory(appId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.statusHistory(appId),
    queryFn: () => invoke<StatusChange[]>('get_status_history', { appId }),
    enabled: appId > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function useInvalidateApplications() {
  const queryClient = useQueryClient();
  const checkMilestones = useMilestoneChecker();
  return () => {
    void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.applications });
    void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.applicationPipeline });
    void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    // Phase 16: check milestones after save (RD7 post-save side effect)
    void checkMilestones();
  };
}

export function useSaveApplication() {
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: (app: ApplicationInput) =>
      invoke<Application>('save_application', { app }),
    onSuccess: invalidate,
  });
}

export function useUpdateApplication() {
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: ({ id, app }: { id: number; app: ApplicationInput }) =>
      invoke<Application>('update_application', { id, app }),
    onSuccess: invalidate,
  });
}

export function useArchiveApplication() {
  const invalidate = useInvalidateApplications();

  return useMutation({
    mutationFn: (id: number) =>
      invoke<void>('archive_application', { id }),
    onSuccess: invalidate,
  });
}

export function useAddStatusChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, change }: { appId: number; change: StatusChangeInput }) =>
      invoke<StatusChange>('add_status_change', { appId, change }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.applications });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.applicationPipeline });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.statusHistory });
      void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    },
  });
}
