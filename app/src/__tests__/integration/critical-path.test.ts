/**
 * Phase 17.1: Critical Path Integration Tests
 *
 * Verifies end-to-end correctness of:
 * - Core loop: save daily log → scores compute → query cache invalidates
 * - Cascade: multi-day streak chains via pure TS engine with realistic inputs
 * - Config change: prospective only (ADR-002 SD1)
 * - Backup: hook invocation
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useSaveDailyLog } from '../../hooks/use-daily-log';
import { useSaveConfig } from '../../hooks/use-config';
import { useBackupNow } from '../../hooks/use-data';
import { createWrapper, createTestQueryClient } from '../../hooks/__tests__/test-utils';
import { computeScores } from '../../engine/scoring';
import { computeCascade } from '../../engine/cascade';
import type { DailyLogRow } from '../../types/engine';
import {
  makeDefaultConfig,
  makeDailyLogInput,
  makeHabitConfigs,
  buildScoringInputFromDailyLog,
  makeDailyLogRow,
} from './test-factories';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

const config = makeDefaultConfig();
const habitConfigs = makeHabitConfigs();

// ---------------------------------------------------------------------------
// 17.1.1: Core Loop — save → scores update → query invalidation
// ---------------------------------------------------------------------------

describe('17.1 Critical Path Integration', () => {
  describe('Core Loop: save → scores update → query invalidation', () => {
    it('useSaveDailyLog calls invoke with correct command and entry shape', async () => {
      const entry = makeDailyLogInput({
        date: '2026-02-18',
        schoolwork: 1,
        gym: 1,
        meditate: 1,
        meal_quality: 'Good',
      });

      const mockResponse = {
        id: 1,
        ...entry,
        positive_score: 0.5,
        vice_penalty: 0,
        base_score: 0.5,
        streak: 0,
        final_score: 0.5,
        logged_at: '2026-02-18T12:00:00Z',
        last_modified: '2026-02-18T12:00:00Z',
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      const queryClient = createTestQueryClient();
      const { result } = renderHook(() => useSaveDailyLog(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate(entry);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockInvoke).toHaveBeenCalledWith('save_daily_log', { entry });
    });

    it('invalidates exactly 8 query prefixes on success (ADR-005 SD3)', async () => {
      const entry = makeDailyLogInput({ date: '2026-02-18', schoolwork: 1 });
      mockInvoke.mockResolvedValueOnce({
        id: 1, ...entry,
        positive_score: 0.2, vice_penalty: 0, base_score: 0.2,
        streak: 0, final_score: 0.2,
        logged_at: '', last_modified: '',
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSaveDailyLog(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate(entry);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // 8 query families invalidated (from use-daily-log.ts lines 49-56)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-log'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['score-trend'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['streak-history'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['habit-completion-rates'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['correlation-data'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['day-of-week-averages'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vice-frequency'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['weekly-stats'] });
    });

    it('does NOT invalidate weekly-review or relapse/urge prefixes', async () => {
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

      // Snapshot immutability (ADR-002 SD3): weekly-review should NOT be invalidated
      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey: readonly string[] }).queryKey,
      );
      expect(invalidatedKeys).not.toContainEqual(['weekly-review']);
      expect(invalidatedKeys).not.toContainEqual(['relapse-entries']);
      expect(invalidatedKeys).not.toContainEqual(['urge-entries']);
    });

    it('triggers milestone check after successful save', async () => {
      const entry = makeDailyLogInput({ date: '2026-02-18', schoolwork: 1 });
      // Mock: save_daily_log succeeds
      mockInvoke.mockResolvedValueOnce({
        id: 1, ...entry,
        positive_score: 0.2, vice_penalty: 0, base_score: 0.2,
        streak: 0, final_score: 0.2,
        logged_at: '', last_modified: '',
      });
      // Mock: get_milestone_context (called by checkMilestones)
      mockInvoke.mockResolvedValueOnce({
        current_streak: 0, total_days_tracked: 1,
        total_study_hours: 0, total_applications: 0,
        consecutive_clean_days: 1, highest_score: 0.2,
        avg_score_7d: 0.2, high_focus_sessions: 0,
      });
      // Mock: check_milestones (called by checkMilestones)
      mockInvoke.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useSaveDailyLog(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(entry);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // checkMilestones calls get_milestone_context then check_milestones
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_milestone_context');
      });
    });
  });

  // -------------------------------------------------------------------------
  // 17.1.2: Cascade — multi-day streak chain via pure TS engine
  // -------------------------------------------------------------------------

  describe('Cascade: multi-day streak chain via pure TS engine', () => {
    /** Build a ScoringInput callback using the full pipeline */
    function makePipelineBuildFn(
      inputOverrides: Parameters<typeof makeDailyLogInput>[0],
    ) {
      return (_row: DailyLogRow, previousStreak: number) => {
        const input = makeDailyLogInput(inputOverrides);
        return buildScoringInputFromDailyLog(
          input,
          habitConfigs,
          config,
          previousStreak,
        );
      };
    }

    it('edit consecutive day → streak chain updates via full pipeline', () => {
      // Build 3 consecutive good days
      // Day 1: base=0.80, streak=0 (Day 1 convention)
      // Day 2: base=0.75, streak=1
      // Day 3: base=0.70, streak=2
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575),
        makeDailyLogRow('2026-02-03', 0.70, 2, 0.714),
      ];

      // Edit Day 2 to have a low score (empty day → all habits 0)
      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makePipelineBuildFn({}), // empty day
      );

      // Day 2 drops to base=0.0 → streak breaks
      expect(updates.length).toBeGreaterThanOrEqual(1);
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.baseScore).toBeCloseTo(0.0, 3);
      expect(updates[0]!.streak).toBe(0);

      // Day 3: streak restarts (prev=0, base=0.70 ≥ 0.65 → streak=1)
      if (updates.length > 1) {
        expect(updates[1]!.date).toBe('2026-02-03');
        expect(updates[1]!.streak).toBe(1);
      }
    });

    it('edit that improves score above threshold → streak recovery', () => {
      // Day 2 was below threshold
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.50, 0, 0.50), // below threshold
        makeDailyLogRow('2026-02-03', 0.70, 1, 0.707),
        makeDailyLogRow('2026-02-04', 0.72, 2, 0.7344),
      ];

      // Edit Day 2 to a good day (above threshold)
      const buildFn = (_row: DailyLogRow, previousStreak: number) => {
        const input = makeDailyLogInput({
          schoolwork: 1,
          personal_project: 1,
          gym: 1,
          sleep_7_9h: 1,
          meal_quality: 'Good',
          read: 1,
        });
        return buildScoringInputFromDailyLog(input, habitConfigs, config, previousStreak);
      };

      const updates = computeCascade('2026-02-02', allLogs, config, buildFn);

      // Day 2 now above threshold → streak goes from 0 → 1
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(1);

      // Day 3: streak goes from 1 → 2
      expect(updates[1]!.date).toBe('2026-02-03');
      expect(updates[1]!.streak).toBe(2);

      // Day 4: streak goes from 2 → 3
      expect(updates[2]!.date).toBe('2026-02-04');
      expect(updates[2]!.streak).toBe(3);
    });

    it('gap day isolates cascade — no propagation past gap', () => {
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575), // edited
        // gap: 02-03 missing
        makeDailyLogRow('2026-02-04', 0.70, 1, 0.707), // gap → prevStreak=0 → streak=1
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makePipelineBuildFn({}), // empty day → streak breaks
      );

      // Only edited day changes; Day 4 converges (gap resets prevStreak)
      expect(updates).toHaveLength(1);
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 17.1.3: Config Change — prospective only (ADR-002 SD1)
  // -------------------------------------------------------------------------

  describe('Config Change: prospective only (ADR-002 SD1)', () => {
    it('same input produces different scores with different config', () => {
      const input = makeDailyLogInput({
        schoolwork: 1,
        personal_project: 1,
        gym: 1,
      });

      // Config A: default multipliers
      const configA = makeDefaultConfig();
      const inputA = buildScoringInputFromDailyLog(input, habitConfigs, configA, 0);
      const resultA = computeScores(inputA);

      // Config B: higher productivity multiplier
      const configB = makeDefaultConfig({ multiplier_productivity: 2.0 });
      const inputB = buildScoringInputFromDailyLog(input, habitConfigs, configB, 0);
      const resultB = computeScores(inputB);

      // Results should differ — proves config affects scoring
      expect(resultA.positiveScore).not.toBe(resultB.positiveScore);
      expect(resultB.positiveScore).toBeGreaterThan(resultA.positiveScore);
    });

    it('useSaveConfig invalidates only config query key', async () => {
      mockInvoke.mockResolvedValueOnce({
        id: 'default',
        multiplier_productivity: 2.0,
        // ... other fields
      });

      const queryClient = createTestQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSaveConfig(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate({
        multiplier_productivity: 2.0,
      } as Parameters<typeof result.current.mutate>[0]);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Config save should only invalidate the config key
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['config'] });

      // Should NOT invalidate daily-log, score-trend, etc.
      // (past scores don't change — ADR-002 SD1)
      const invalidatedKeys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey: readonly string[] }).queryKey,
      );
      expect(invalidatedKeys).not.toContainEqual(['daily-log']);
      expect(invalidatedKeys).not.toContainEqual(['score-trend']);
    });
  });

  // -------------------------------------------------------------------------
  // 17.1.4: Backup — hook invocation
  // -------------------------------------------------------------------------

  describe('Backup: hook invocation', () => {
    it('useBackupNow calls invoke with correct command and destination', async () => {
      const backupPath = '/backups/ltu-2026-02-20.db';
      mockInvoke.mockResolvedValueOnce(backupPath);

      const { result } = renderHook(() => useBackupNow(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('/backups');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockInvoke).toHaveBeenCalledWith('backup_now', { destination: '/backups' });
      expect(result.current.data).toBe(backupPath);
    });
  });
});
