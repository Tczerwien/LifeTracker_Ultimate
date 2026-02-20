import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { StudySession } from '../types/models';
import type { StudySessionInput } from '../types/commands';
import { QUERY_KEYS, INVALIDATION_PREFIXES } from '../lib/query-keys';
import { useMilestoneChecker } from './use-milestones';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useStudySessions(date: string) {
  return useQuery({
    queryKey: QUERY_KEYS.studySessions(date),
    queryFn: () => invoke<StudySession[]>('get_study_sessions', { date }),
    enabled: date.length > 0,
  });
}

export function useStudySessionsRange(start: string, end: string) {
  return useQuery({
    queryKey: QUERY_KEYS.studySessionsRange(start, end),
    queryFn: () => invoke<StudySession[]>('get_study_sessions_range', { start, end }),
    enabled: start.length > 0 && end.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function useInvalidateStudy() {
  const queryClient = useQueryClient();
  const checkMilestones = useMilestoneChecker();
  return () => {
    void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.studySessions });
    void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.studySummary });
    void queryClient.invalidateQueries({ queryKey: INVALIDATION_PREFIXES.weeklyStats });
    // Phase 16: check milestones after save (RD7 post-save side effect)
    void checkMilestones();
  };
}

export function useSaveStudySession() {
  const invalidate = useInvalidateStudy();

  return useMutation({
    mutationFn: (session: StudySessionInput) =>
      invoke<StudySession>('save_study_session', { session }),
    onSuccess: invalidate,
  });
}

export function useUpdateStudySession() {
  const invalidate = useInvalidateStudy();

  return useMutation({
    mutationFn: ({ id, session }: { id: number; session: StudySessionInput }) =>
      invoke<StudySession>('update_study_session', { id, session }),
    onSuccess: invalidate,
  });
}

export function useDeleteStudySession() {
  const invalidate = useInvalidateStudy();

  return useMutation({
    mutationFn: (id: number) =>
      invoke<void>('delete_study_session', { id }),
    onSuccess: invalidate,
  });
}
