import type {
  ScoringConfig,
  ScoringInput,
  DailyLogRow,
} from '../../types/engine';
import { HabitCategory } from '../../types/enums';
import { computeCascade } from '../cascade';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeDefaultConfig(
  overrides?: Partial<ScoringConfig>,
): ScoringConfig {
  return {
    multiplier_productivity: 1.5,
    multiplier_health: 1.3,
    multiplier_growth: 1.0,
    target_fraction: 0.85,
    vice_cap: 0.40,
    streak_threshold: 0.65,
    streak_bonus_per_day: 0.01,
    max_streak_bonus: 0.10,
    phone_t1_min: 61,
    phone_t2_min: 181,
    phone_t3_min: 301,
    phone_t1_penalty: 0.03,
    phone_t2_penalty: 0.07,
    phone_t3_penalty: 0.12,
    ...overrides,
  };
}

/**
 * Creates a DailyLogRow with all habits/vices at 0 and specific stored scores.
 * Assumes no vices: positive_score = base_score, vice_penalty = 0.
 */
function makeRow(
  date: string,
  baseScore: number,
  streak: number,
  finalScore: number,
): DailyLogRow {
  return {
    date,
    // Productivity
    schoolwork: 0,
    personal_project: 0,
    classes: 0,
    job_search: 0,
    // Health
    gym: 0,
    sleep_7_9h: 0,
    wake_8am: 0,
    supplements: 0,
    meal_quality: 'None',
    stretching: 0,
    // Growth
    meditate: 0,
    read: 0,
    social: 'None',
    // Vices
    porn: 0,
    masturbate: 0,
    weed: 0,
    skip_class: 0,
    binged_content: 0,
    gaming_1h: 0,
    past_12am: 0,
    late_wake: 0,
    phone_use: 0,
    // Computed scores
    positive_score: baseScore,
    vice_penalty: 0,
    base_score: baseScore,
    streak,
    final_score: finalScore,
  };
}

/**
 * Creates a buildScoringInput callback that produces the given baseScore
 * when run through computeScores. Uses a single habit with no vices so
 * positiveScore = baseScore and vicePenalty = 0.
 *
 * Math: positiveScore = (value × mult) / (points × mult × target_fraction)
 * With points=100, mult=1.5, target_fraction=0.85:
 *   target = 100 × 1.5 × 0.85 = 127.5
 *   positiveScore = (value × 1.5) / 127.5 = value / 85
 *   So value = desiredBaseScore × 85
 */
function makeBuildFn(
  desiredBaseScore: number,
  config: ScoringConfig,
): (row: DailyLogRow, previousStreak: number) => ScoringInput {
  const value = desiredBaseScore * 100 * config.target_fraction;
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
    config,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Edit Cascade (computeCascade)', () => {
  const config = makeDefaultConfig();

  // -------------------------------------------------------------------------
  // Test 1: TV20 — Cascade changes streak chain
  // -------------------------------------------------------------------------

  describe('TV20: cascade through streak chain', () => {
    const allLogs = [
      makeRow('2026-02-01', 0.80, 0, 0.80),
      makeRow('2026-02-02', 0.75, 1, 0.7575),
      makeRow('2026-02-03', 0.70, 2, 0.714),
      makeRow('2026-02-04', 0.72, 3, 0.7416),
      makeRow('2026-02-05', 0.68, 4, 0.7072),
    ];

    it('produces 3 updates when Day 3 drops below threshold', () => {
      const updates = computeCascade(
        '2026-02-03',
        allLogs,
        config,
        makeBuildFn(0.60, config),
      );

      expect(updates).toHaveLength(3);

      // Edited day: all 5 scores recomputed
      const day3 = updates[0]!;
      expect(day3.date).toBe('2026-02-03');
      expect(day3.positiveScore).toBeCloseTo(0.60, 3);
      expect(day3.vicePenalty).toBeCloseTo(0.0, 3);
      expect(day3.baseScore).toBeCloseTo(0.60, 3);
      expect(day3.streak).toBe(0);
      expect(day3.finalScore).toBeCloseTo(0.60, 3);

      // Day 4: streak restarts from 0 → 1
      const day4 = updates[1]!;
      expect(day4.date).toBe('2026-02-04');
      expect(day4.streak).toBe(1);
      expect(day4.finalScore).toBeCloseTo(0.7272, 3);
      expect(day4.positiveScore).toBeUndefined();

      // Day 5: streak continues 1 → 2
      const day5 = updates[2]!;
      expect(day5.date).toBe('2026-02-05');
      expect(day5.streak).toBe(2);
      expect(day5.finalScore).toBeCloseTo(0.6936, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Test 2: Single day edit — no forward walk
  // -------------------------------------------------------------------------

  describe('single day edit (only entry in history)', () => {
    it('returns 1 update with all 5 scores', () => {
      const allLogs = [makeRow('2026-02-01', 0.80, 0, 0.80)];

      const updates = computeCascade(
        '2026-02-01',
        allLogs,
        config,
        makeBuildFn(0.90, config),
      );

      expect(updates).toHaveLength(1);

      const u = updates[0]!;
      expect(u.date).toBe('2026-02-01');
      expect(u.positiveScore).toBeCloseTo(0.90, 3);
      expect(u.vicePenalty).toBeCloseTo(0.0, 3);
      expect(u.baseScore).toBeCloseTo(0.90, 3);
      expect(u.streak).toBe(0); // Day 1 convention: -1 + 1 = 0
      expect(u.finalScore).toBeCloseTo(0.90, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Test 3: Convergence immediate — next day below threshold
  // -------------------------------------------------------------------------

  describe('immediate convergence (next day below threshold)', () => {
    it('stops at the first subsequent day when it already has streak=0', () => {
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.75, 1, 0.7575),
        makeRow('2026-02-03', 0.50, 0, 0.50),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.60, config),
      );

      // Only the edited day is updated; Day 3 converges immediately
      expect(updates).toHaveLength(1);
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(0);
      expect(updates[0]!.finalScore).toBeCloseTo(0.60, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Test 4: No change needed — recomputed values match stored
  // -------------------------------------------------------------------------

  describe('no change needed (recomputed matches stored)', () => {
    it('returns empty array when all scores are identical', () => {
      // Use streak=0 days (below threshold) to avoid floating-point mismatch
      // between literal final_score values and computed ones. In production,
      // stored values are computed by the same engine, so === is exact.
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.50, 0, 0.50), // below threshold → streak=0
        makeRow('2026-02-03', 0.40, 0, 0.40), // below threshold → streak=0
      ];

      // buildFn produces the same base_score (0.50) as currently stored
      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.50, config),
      );

      expect(updates).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Long chain — propagates to all remaining days
  // -------------------------------------------------------------------------

  describe('long chain with no convergence until end', () => {
    it('propagates through all 5 subsequent days', () => {
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.75, 1, 0.7575),
        makeRow('2026-02-03', 0.70, 2, 0.714),
        makeRow('2026-02-04', 0.72, 3, 0.7416),
        makeRow('2026-02-05', 0.68, 4, 0.7072),
        makeRow('2026-02-06', 0.66, 5, 0.693),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.50, config),
      );

      // Edited day + 4 subsequent = 5 total
      expect(updates).toHaveLength(5);

      // Edited day
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(0);
      expect(updates[0]!.finalScore).toBeCloseTo(0.50, 3);

      // Day 3: streak was 2 → now 1
      expect(updates[1]!.date).toBe('2026-02-03');
      expect(updates[1]!.streak).toBe(1);
      expect(updates[1]!.finalScore).toBeCloseTo(0.707, 3);

      // Day 4: streak was 3 → now 2
      expect(updates[2]!.date).toBe('2026-02-04');
      expect(updates[2]!.streak).toBe(2);
      expect(updates[2]!.finalScore).toBeCloseTo(0.7344, 3);

      // Day 5: streak was 4 → now 3
      expect(updates[3]!.date).toBe('2026-02-05');
      expect(updates[3]!.streak).toBe(3);
      expect(updates[3]!.finalScore).toBeCloseTo(0.7004, 3);

      // Day 6: streak was 5 → now 4
      expect(updates[4]!.date).toBe('2026-02-06');
      expect(updates[4]!.streak).toBe(4);
      expect(updates[4]!.finalScore).toBeCloseTo(0.6864, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Test 6: Gap days isolate the cascade
  // -------------------------------------------------------------------------

  describe('gap days act as cascade firewall', () => {
    it('converges after gap because previousStreak resets to 0', () => {
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.75, 1, 0.7575), // edited
        // gap: 02-03 and 02-04 missing
        makeRow('2026-02-05', 0.70, 1, 0.707), // gap → prev=0 → streak=1
        makeRow('2026-02-06', 0.68, 2, 0.6936),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.50, config),
      );

      // Only edited day updated; Day 5 converges (gap resets prevStreak)
      expect(updates).toHaveLength(1);
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(0);
      expect(updates[0]!.finalScore).toBeCloseTo(0.50, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Test 7: Streak-breaking day stops cascade mid-chain
  // -------------------------------------------------------------------------

  describe('streak breaker stops cascade propagation', () => {
    it('does not propagate past a sub-threshold day', () => {
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.75, 1, 0.7575), // edited
        makeRow('2026-02-03', 0.70, 2, 0.714),
        makeRow('2026-02-04', 0.40, 0, 0.40), // streak breaker
        makeRow('2026-02-05', 0.72, 1, 0.7272),
        makeRow('2026-02-06', 0.68, 2, 0.6936),
        makeRow('2026-02-07', 0.90, 3, 0.927),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.50, config),
      );

      // Day 2 (edited) + Day 3 updated; Day 4 (streak breaker) converges
      expect(updates).toHaveLength(2);

      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(0);

      expect(updates[1]!.date).toBe('2026-02-03');
      expect(updates[1]!.streak).toBe(1);
      expect(updates[1]!.finalScore).toBeCloseTo(0.707, 3);
    });

    it('leaves days after the breaker untouched', () => {
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.75, 1, 0.7575),
        makeRow('2026-02-03', 0.70, 2, 0.714),
        makeRow('2026-02-04', 0.40, 0, 0.40),
        makeRow('2026-02-05', 0.72, 1, 0.7272),
        makeRow('2026-02-06', 0.68, 2, 0.6936),
        makeRow('2026-02-07', 0.90, 3, 0.927),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.50, config),
      );

      // Days 5, 6, 7 should NOT appear in updates
      const updatedDates = updates.map((u) => u.date);
      expect(updatedDates).not.toContain('2026-02-05');
      expect(updatedDates).not.toContain('2026-02-06');
      expect(updatedDates).not.toContain('2026-02-07');
    });
  });

  // -------------------------------------------------------------------------
  // Test 8: Streak recovery — edit improves day above threshold
  // -------------------------------------------------------------------------

  describe('streak recovery (edit improves day above threshold)', () => {
    it('propagates increased streaks through all subsequent days', () => {
      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.50, 0, 0.50), // was below threshold; edited
        makeRow('2026-02-03', 0.70, 1, 0.707),
        makeRow('2026-02-04', 0.72, 2, 0.7344),
        makeRow('2026-02-05', 0.68, 3, 0.7004),
      ];

      // Improve Day 2 from 0.50 → 0.75 (now above threshold)
      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.75, config),
      );

      expect(updates).toHaveLength(4);

      // Edited day: streak goes from 0 → 1
      expect(updates[0]!.date).toBe('2026-02-02');
      expect(updates[0]!.streak).toBe(1);
      expect(updates[0]!.finalScore).toBeCloseTo(0.7575, 3);
      expect(updates[0]!.baseScore).toBeCloseTo(0.75, 3);

      // Day 3: streak was 1 → now 2
      expect(updates[1]!.date).toBe('2026-02-03');
      expect(updates[1]!.streak).toBe(2);
      expect(updates[1]!.finalScore).toBeCloseTo(0.714, 3);

      // Day 4: streak was 2 → now 3
      expect(updates[2]!.date).toBe('2026-02-04');
      expect(updates[2]!.streak).toBe(3);
      expect(updates[2]!.finalScore).toBeCloseTo(0.7416, 3);

      // Day 5: streak was 3 → now 4
      expect(updates[3]!.date).toBe('2026-02-05');
      expect(updates[3]!.streak).toBe(4);
      expect(updates[3]!.finalScore).toBeCloseTo(0.7072, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('throws when editedDate is not in allLogs', () => {
      const allLogs = [makeRow('2026-02-01', 0.80, 0, 0.80)];

      expect(() =>
        computeCascade(
          '2026-02-15',
          allLogs,
          config,
          makeBuildFn(0.80, config),
        ),
      ).toThrow('not found');
    });

    it('handles allLogs provided in reverse order (defensive sort)', () => {
      const allLogs = [
        makeRow('2026-02-05', 0.68, 4, 0.7072),
        makeRow('2026-02-03', 0.70, 2, 0.714),
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-04', 0.72, 3, 0.7416),
        makeRow('2026-02-02', 0.75, 1, 0.7575),
      ];

      // Same as TV20 but shuffled — should produce identical results
      const updates = computeCascade(
        '2026-02-03',
        allLogs,
        config,
        makeBuildFn(0.60, config),
      );

      expect(updates).toHaveLength(3);
      expect(updates[0]!.date).toBe('2026-02-03');
      expect(updates[1]!.date).toBe('2026-02-04');
      expect(updates[2]!.date).toBe('2026-02-05');
    });

    it('stops walk at unscored day (null base_score)', () => {
      const unscoredRow: DailyLogRow = {
        ...makeRow('2026-02-03', 0, 0, 0),
        positive_score: null,
        vice_penalty: null,
        base_score: null,
        streak: null,
        final_score: null,
      };

      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        makeRow('2026-02-02', 0.75, 1, 0.7575),
        unscoredRow,
        makeRow('2026-02-04', 0.70, 2, 0.714),
      ];

      const updates = computeCascade(
        '2026-02-02',
        allLogs,
        config,
        makeBuildFn(0.50, config),
      );

      // Edited day updated, but walk stops at null Day 3
      expect(updates).toHaveLength(1);
      expect(updates[0]!.date).toBe('2026-02-02');
      // Day 4 should not be reached
      const dates = updates.map((u) => u.date);
      expect(dates).not.toContain('2026-02-04');
    });

    it('uses previousStreak = -1 when no prior rows exist (Day 1)', () => {
      // The buildFn receives previousStreak from cascade.
      // With no prior rows, it should be -1 (Day 1 convention).
      let capturedPreviousStreak: number | undefined;

      const capturingBuildFn = (
        _row: DailyLogRow,
        previousStreak: number,
      ): ScoringInput => {
        capturedPreviousStreak = previousStreak;
        return makeBuildFn(0.80, config)(_row, previousStreak);
      };

      const allLogs = [makeRow('2026-02-01', 0.80, 0, 0.80)];

      computeCascade('2026-02-01', allLogs, config, capturingBuildFn);

      expect(capturedPreviousStreak).toBe(-1);
    });

    it('uses previousStreak = 0 when prior row exists but is not consecutive', () => {
      let capturedPreviousStreak: number | undefined;

      const capturingBuildFn = (
        _row: DailyLogRow,
        previousStreak: number,
      ): ScoringInput => {
        capturedPreviousStreak = previousStreak;
        return makeBuildFn(0.80, config)(_row, previousStreak);
      };

      const allLogs = [
        makeRow('2026-02-01', 0.80, 0, 0.80),
        // gap: 02-02 through 02-04 missing
        makeRow('2026-02-05', 0.70, 1, 0.707),
      ];

      computeCascade('2026-02-05', allLogs, config, capturingBuildFn);

      expect(capturedPreviousStreak).toBe(0);
    });
  });
});
