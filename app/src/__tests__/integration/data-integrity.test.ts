/**
 * Phase 17.2: Data Integrity Tests
 *
 * Verifies:
 * - Export/import round-trip (hook invocation + cache behavior)
 * - 24-hour correction window error propagation (ADR-006)
 * - Weekly review snapshot immutability (ADR-002 SD3)
 * - Cascade edge cases (pure TS engine)
 * - Milestone permanence
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useExportData, useImportData } from '../../hooks/use-data';
import { useUpdateRelapseEntry, useUpdateUrgeEntry } from '../../hooks/use-recovery';
import { useSaveWeeklyReview } from '../../hooks/use-review';
import { useSaveDailyLog } from '../../hooks/use-daily-log';
import { createWrapper, createTestQueryClient } from '../../hooks/__tests__/test-utils';
import { computeCascade } from '../../engine/cascade';
import type { ScoringInput, DailyLogRow } from '../../types/engine';
import { HabitCategory } from '../../types/enums';
import { makeDefaultConfig, makeDailyLogInput, makeDailyLogRow } from './test-factories';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 17.2.1: Export/Import Round-Trip
// ---------------------------------------------------------------------------

describe('17.2 Data Integrity', () => {
  describe('Export/Import round-trip', () => {
    it('useExportData calls invoke with correct command', async () => {
      const mockJson = JSON.stringify({
        _meta: { schema_version: 1, exported_at: '2026-02-20T12:00:00Z' },
        tables: { app_config: {}, habit_config: [], daily_log: [] },
      });
      mockInvoke.mockResolvedValueOnce(mockJson);

      const { result } = renderHook(() => useExportData(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockInvoke).toHaveBeenCalledWith('export_data');
      expect(result.current.data).toBe(mockJson);
    });

    it('useImportData calls invoke and clears entire query cache', async () => {
      const importJson = JSON.stringify({
        _meta: { schema_version: 1 },
        tables: {},
      });
      mockInvoke.mockResolvedValueOnce(undefined);

      const queryClient = createTestQueryClient();
      const clearSpy = vi.spyOn(queryClient, 'clear');

      const { result } = renderHook(() => useImportData(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate(importJson);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockInvoke).toHaveBeenCalledWith('import_data', { json: importJson });
      // Import replaces all data — entire cache must be cleared
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });

    it('propagates import error to mutation state', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Invalid JSON format'));

      const { result } = renderHook(() => useImportData(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('not valid json');
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 17.2.2: 24-Hour Correction Window (ADR-006)
  // -------------------------------------------------------------------------

  describe('24-Hour Correction Window (ADR-006)', () => {
    it('useUpdateRelapseEntry propagates "locked" error from Rust', async () => {
      mockInvoke.mockRejectedValueOnce(
        new Error('Entry locked after 24-hour correction window'),
      );

      const { result } = renderHook(() => useUpdateRelapseEntry(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: 42,
        entry: {
          date: '2026-02-18',
          time: '14:00',
          duration: '10',
          trigger: 'stress',
          location: 'home',
          device: 'phone',
          activity_before: 'scrolling',
          emotional_state: 'anxious',
          resistance_technique: 'none',
          urge_intensity: 7,
          notes: '',
          urge_entry_id: null,
        },
      });
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(String(result.current.error)).toContain('locked');
    });

    it('useUpdateUrgeEntry propagates "locked" error from Rust', async () => {
      mockInvoke.mockRejectedValueOnce(
        new Error('Entry locked after 24-hour correction window'),
      );

      const { result } = renderHook(() => useUpdateUrgeEntry(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        id: 7,
        entry: {
          date: '2026-02-18',
          time: '15:30',
          intensity: 6,
          technique: 'deep breathing',
          effectiveness: 4,
          duration: '5',
          did_pass: 'true',
          trigger: 'boredom',
          notes: '',
        },
      });
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(String(result.current.error)).toContain('locked');
    });

    it('recovery mutations do NOT invalidate daily-log or score queries', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 42, date: '2026-02-18', time: '14:00',
        duration: 10, trigger: 'stress', location: 'home',
        device: 'phone', activity_before: 'scrolling',
        emotional_state: 'anxious', resistance_technique: 'none',
        urge_intensity: 7, notes: '', urge_entry_id: null,
        created_at: '2026-02-18T14:00:00Z', last_modified: '2026-02-18T14:30:00Z',
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateRelapseEntry(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({
        id: 42,
        entry: {
          date: '2026-02-18',
          time: '14:00',
          duration: '10',
          trigger: 'stress',
          location: 'home',
          device: 'phone',
          activity_before: 'scrolling',
          emotional_state: 'anxious',
          resistance_technique: 'none',
          urge_intensity: 7,
          notes: '',
          urge_entry_id: null,
        },
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey: readonly string[] }).queryKey,
      );

      // Recovery edits do NOT trigger score recompute (ADR-006 SD4)
      expect(invalidatedKeys).not.toContainEqual(['daily-log']);
      expect(invalidatedKeys).not.toContainEqual(['score-trend']);
      expect(invalidatedKeys).not.toContainEqual(['streak-history']);

      // Recovery edits DO invalidate their own prefixes
      expect(invalidatedKeys).toContainEqual(['relapse-entries']);
      expect(invalidatedKeys).toContainEqual(['recovery-frequency']);
      expect(invalidatedKeys).toContainEqual(['weekly-stats']);
    });
  });

  // -------------------------------------------------------------------------
  // 17.2.3: Weekly Review Snapshot Immutability (ADR-002 SD3)
  // -------------------------------------------------------------------------

  describe('Weekly Review Snapshot Immutability (ADR-002 SD3)', () => {
    it('useSaveDailyLog does NOT invalidate weekly-review prefix', async () => {
      const entry = makeDailyLogInput({ date: '2026-02-18' });
      mockInvoke.mockResolvedValueOnce({
        id: 1, ...entry,
        positive_score: 0, vice_penalty: 0, base_score: 0,
        streak: 0, final_score: 0,
        logged_at: '', last_modified: '',
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSaveDailyLog(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate(entry);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey: readonly string[] }).queryKey,
      );

      // weekly-stats IS invalidated (live stats change)
      expect(invalidatedKeys).toContainEqual(['weekly-stats']);

      // weekly-review is NOT invalidated (snapshot is frozen)
      expect(invalidatedKeys).not.toContainEqual(['weekly-review']);
    });

    it('useSaveWeeklyReview DOES invalidate weekly-review prefix', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 1,
        week_start: '2026-02-10',
        week_end: '2026-02-16',
        score_snapshot: '[0.8, 0.7, 0.6, 0.5, 0.9, 0.85, 0.75]',
        snapshot_date: '2026-02-16T23:42:00Z',
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSaveWeeklyReview(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({
        week_start: '2026-02-10',
        week_end: '2026-02-16',
        week_number: 7,
        biggest_win: 'Consistent gym',
        biggest_challenge: 'Phone usage',
        next_week_goal: 'Reduce phone to < 60 min',
        reflection: 'Good week overall',
      } as Parameters<typeof result.current.mutate>[0]);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['weekly-review'] });
    });
  });

  // -------------------------------------------------------------------------
  // 17.2.4: Cascade Edge Cases (pure TS engine)
  // -------------------------------------------------------------------------

  describe('Cascade Edge Cases', () => {
    const cascadeConfig = makeDefaultConfig();

    /**
     * Helper: creates a buildFn that produces a specific base score.
     * Same approach as cascade.test.ts makeBuildFn.
     */
    function makeBuildFn(desiredBaseScore: number) {
      const value = desiredBaseScore * 100 * cascadeConfig.target_fraction;
      return (_row: DailyLogRow, previousStreak: number): ScoringInput => ({
        habitValues: [
          {
            name: 'test_habit',
            value,
            points: 100,
            category: HabitCategory.Productivity,
          },
        ],
        viceValues: [],
        phoneMinutes: 0,
        previousStreak,
        config: cascadeConfig,
      });
    }

    it('edit last day in history — no forward walk, 1 update', () => {
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575),
        makeDailyLogRow('2026-02-03', 0.70, 2, 0.714),
      ];

      const updates = computeCascade(
        '2026-02-03',
        allLogs,
        cascadeConfig,
        makeBuildFn(0.50),
      );

      expect(updates).toHaveLength(1);
      expect(updates[0]!.date).toBe('2026-02-03');
      expect(updates[0]!.baseScore).toBeCloseTo(0.50, 3);
      expect(updates[0]!.streak).toBe(0); // below threshold
    });

    it('edit first day ever (Day 1 convention: previousStreak = -1)', () => {
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575),
      ];

      let capturedPreviousStreak: number | undefined;
      const capturingBuildFn = (
        _row: DailyLogRow,
        previousStreak: number,
      ): ScoringInput => {
        capturedPreviousStreak = previousStreak;
        return makeBuildFn(0.90)(_row, previousStreak);
      };

      computeCascade('2026-02-01', allLogs, cascadeConfig, capturingBuildFn);

      // Day 1 convention: previousStreak = -1
      expect(capturedPreviousStreak).toBe(-1);
    });

    it('long streak (10+ days) with mid-streak edit → all subsequent updated', () => {
      // Build 12 consecutive days all above threshold
      const allLogs: DailyLogRow[] = [];
      for (let i = 1; i <= 12; i++) {
        const day = String(i).padStart(2, '0');
        const streak = i === 1 ? 0 : i - 1;
        const base = 0.70;
        const bonus = Math.min(streak * 0.01, 0.10);
        const final = Math.min(1.0, base * (1 + bonus));
        allLogs.push(makeDailyLogRow(`2026-02-${day}`, base, streak, final));
      }

      // Edit Day 6 to below threshold
      const updates = computeCascade(
        '2026-02-06',
        allLogs,
        cascadeConfig,
        makeBuildFn(0.50),
      );

      // Day 6 + Days 7-12 should all be updated (7 updates)
      expect(updates.length).toBeGreaterThanOrEqual(7);
      expect(updates[0]!.date).toBe('2026-02-06');
      expect(updates[0]!.streak).toBe(0);

      // Day 7: restarts from 0 → 1
      expect(updates[1]!.date).toBe('2026-02-07');
      expect(updates[1]!.streak).toBe(1);
    });

    it('exact threshold boundary (baseScore = 0.65)', () => {
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.70, 1, 0.707),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        cascadeConfig,
        makeBuildFn(0.65), // exactly at threshold
      );

      // 0.65 >= 0.65 → qualifies for streak
      expect(updates[0]!.streak).toBe(1);
    });

    it('unscored day (null base_score) halts the walk', () => {
      const unscoredRow: DailyLogRow = {
        ...makeDailyLogRow('2026-02-03', 0, 0, 0),
        positive_score: null,
        vice_penalty: null,
        base_score: null,
        streak: null,
        final_score: null,
      };

      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575),
        unscoredRow,
        makeDailyLogRow('2026-02-04', 0.70, 2, 0.714),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        cascadeConfig,
        makeBuildFn(0.50),
      );

      // Walk halts at null Day 3; Day 4 unreachable
      expect(updates).toHaveLength(1);
      expect(updates[0]!.date).toBe('2026-02-02');
      const dates = updates.map((u) => u.date);
      expect(dates).not.toContain('2026-02-04');
    });
  });

  // -------------------------------------------------------------------------
  // 17.2.5: Milestone Permanence
  // -------------------------------------------------------------------------

  describe('Milestone Permanence', () => {
    it('useSaveDailyLog triggers milestone check after save', async () => {
      const entry = makeDailyLogInput({ date: '2026-02-18', schoolwork: 1 });
      // save_daily_log
      mockInvoke.mockResolvedValueOnce({
        id: 1, ...entry,
        positive_score: 0.2, vice_penalty: 0, base_score: 0.2,
        streak: 0, final_score: 0.2,
        logged_at: '', last_modified: '',
      });
      // get_milestone_context
      mockInvoke.mockResolvedValueOnce({
        current_streak: 0, total_days_tracked: 1,
        total_study_hours: 0, total_applications: 0,
        consecutive_clean_days: 1, highest_score: 0.2,
        avg_score_7d: 0.2, high_focus_sessions: 0,
      });
      // check_milestones returns newly achieved
      mockInvoke.mockResolvedValueOnce([
        { id: 1, name: 'First Steps', emoji: '👣', category: 'tracking', threshold: 1, achieved: true, achieved_date: '2026-02-18', created_at: '' },
      ]);

      const queryClient = createTestQueryClient();
      const removeSpy = vi.spyOn(queryClient, 'removeQueries');

      const { result } = renderHook(() => useSaveDailyLog(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate(entry);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Milestone check called
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_milestones', expect.objectContaining({}));
      });

      // Milestones cache removed (not just invalidated) per use-milestones.ts line 65
      await waitFor(() => {
        expect(removeSpy).toHaveBeenCalledWith({ queryKey: ['milestones'] });
      });
    });

    it('milestone stays achieved even when conditions no longer hold', async () => {
      // This is a Rust-side guarantee, but we verify the TS hook correctly
      // reports milestones as achieved regardless of current stats.
      mockInvoke.mockResolvedValueOnce([
        {
          id: 1,
          name: 'Week Warrior',
          emoji: '⚔️',
          category: 'score',
          threshold: 7,
          achieved: true,
          achieved_date: '2026-02-15',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'Clean 30',
          emoji: '🌟',
          category: 'clean',
          threshold: 30,
          achieved: true,
          achieved_date: '2026-02-10',
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      // Import useMilestones directly to test the query
      const { useMilestones } = await import('../../hooks/use-milestones');
      const { result } = renderHook(() => useMilestones(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Both milestones remain achieved
      const milestones = result.current.data!;
      expect(milestones).toHaveLength(2);
      expect(milestones[0]!.achieved).toBe(true);
      expect(milestones[1]!.achieved).toBe(true);
    });
  });
});
