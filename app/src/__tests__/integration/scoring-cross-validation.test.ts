/**
 * Phase 17.3: Scoring Engine Cross-Validation
 *
 * Tests the FULL pipeline: DailyLogInput → buildScoringInputFromDailyLog →
 * computeScores → verify against SCORING_SPEC.md test vectors.
 *
 * Existing unit tests (scoring.test.ts) call computeScores() with pre-built
 * ScoringInput objects. These tests validate the input-building layer that
 * converts raw UI input into ScoringInput — the critical bridge where the
 * TS reference and Rust engine could disagree silently.
 */

import { computeScores } from '../../engine/scoring';
import { computeCascade } from '../../engine/cascade';
import { HabitCategory } from '../../types/enums';
import type { ScoringConfig, ScoringInput, DailyLogRow } from '../../types/engine';
import {
  makeDefaultConfig,
  makeDailyLogInput,
  makeHabitConfigs,
  buildScoringInputFromDailyLog,
  makeDailyLogRow,
} from './test-factories';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const config = makeDefaultConfig();
const habitConfigs = makeHabitConfigs();

/**
 * Helper: build ScoringInput from DailyLogInput through the full pipeline
 * and run computeScores.
 */
function scoreFromInput(
  inputOverrides: Parameters<typeof makeDailyLogInput>[0],
  previousStreak: number,
  configOverrides?: Partial<ScoringConfig>,
) {
  const input = makeDailyLogInput(inputOverrides);
  const cfg = configOverrides ? makeDefaultConfig(configOverrides) : config;
  const scoringInput = buildScoringInputFromDailyLog(
    input,
    habitConfigs,
    cfg,
    previousStreak,
  );
  return computeScores(scoringInput);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('17.3 Scoring Cross-Validation', () => {
  // -------------------------------------------------------------------------
  // Full pipeline: DailyLogInput → ScoringInput → ScoringOutput
  // -------------------------------------------------------------------------

  describe('Full pipeline: DailyLogInput → ScoringInput → ScoringOutput', () => {
    it('TV01: Perfect day — all habits, no vices, Day 1', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          job_search: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          supplements: 1,
          meal_quality: 'Great',
          stretching: 1,
          meditate: 1,
          read: 1,
          social: 'Meaningful Connection',
        },
        -1, // Day 1 convention
      );

      expect(result.positiveScore).toBeCloseTo(1.0, 3);
      expect(result.vicePenalty).toBeCloseTo(0.0, 3);
      expect(result.baseScore).toBeCloseTo(1.0, 3);
      expect(result.streak).toBe(0); // -1 + 1 = 0
      expect(result.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV02: Empty day — nothing done, no vices', () => {
      const result = scoreFromInput(
        { date: '2026-02-20' },
        3,
      );

      expect(result.positiveScore).toBeCloseTo(0.0, 3);
      expect(result.vicePenalty).toBeCloseTo(0.0, 3);
      expect(result.baseScore).toBeCloseTo(0.0, 3);
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.0, 3);
    });

    it('TV03: Vice-heavy day — all vices, no habits', () => {
      const result = scoreFromInput(
        {
          porn: 1,
          masturbate: 1,
          weed: 1,
          skip_class: 1,
          binged_content: 1,
          gaming_1h: 1,
          past_12am: 1,
          late_wake: 1,
          phone_use: 400,
        },
        0,
      );

      expect(result.positiveScore).toBeCloseTo(0.0, 3);
      // Raw sum = 0.25+0.10+0.12+0.08+0.07+0.06+0.05+0.03+0.12 = 0.88
      // Capped at vice_cap = 0.40
      expect(result.vicePenalty).toBeCloseTo(0.40, 3);
      expect(result.baseScore).toBeCloseTo(0.0, 3);
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.0, 3);
    });

    it('TV04: Good day with single relapse — breaks streak', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          meal_quality: 'Great',
          meditate: 1,
          read: 1,
          porn: 1,
        },
        4,
      );

      expect(result.positiveScore).toBeCloseTo(0.80212, 3);
      expect(result.vicePenalty).toBeCloseTo(0.25, 3);
      expect(result.baseScore).toBeCloseTo(0.60159, 3);
      // 0.60159 < 0.65 threshold → streak breaks
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.60159, 3);
    });

    it('TV05: Streak building — Day 2 after qualifying Day 1', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          gym: 1,
          sleep_7_9h: 1,
          supplements: 1,
          meal_quality: 'Good',
          stretching: 1,
          read: 1,
          past_12am: 1,
        },
        0,
      );

      expect(result.positiveScore).toBeCloseTo(0.87262, 3);
      expect(result.vicePenalty).toBeCloseTo(0.05, 3);
      expect(result.baseScore).toBeCloseTo(0.82899, 3);
      // 0.82899 ≥ 0.65 → streak = 0 + 1 = 1
      expect(result.streak).toBe(1);
      expect(result.finalScore).toBeCloseTo(0.83728, 3);
    });

    it('TV06: Streak at maximum bonus (Day 11+)', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          job_search: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          supplements: 1,
          meal_quality: 'Great',
          stretching: 1,
          meditate: 1,
          read: 1,
          social: 'Meaningful Connection',
        },
        10,
      );

      expect(result.positiveScore).toBeCloseTo(1.0, 3);
      expect(result.vicePenalty).toBeCloseTo(0.0, 3);
      expect(result.baseScore).toBeCloseTo(1.0, 3);
      expect(result.streak).toBe(11);
      // 1.0 × (1 + min(11×0.01, 0.10)) = 1.0 × 1.10 = 1.10 → capped at 1.0
      expect(result.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV08: Visible streak bonus (streak=8)', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          gym: 1,
          sleep_7_9h: 1,
          meal_quality: 'Good',
          read: 1,
        },
        7,
      );

      expect(result.positiveScore).toBeCloseTo(0.67494, 3);
      expect(result.vicePenalty).toBeCloseTo(0.0, 3);
      expect(result.baseScore).toBeCloseTo(0.67494, 3);
      expect(result.streak).toBe(8);
      // 0.67494 × (1 + min(8×0.01, 0.10)) = 0.67494 × 1.08 = 0.72893
      expect(result.finalScore).toBeCloseTo(0.72893, 3);
    });

    it('TV11A: Porn per-instance scaling (count=1)', () => {
      const result = scoreFromInput(
        { porn: 1 },
        0,
      );

      expect(result.vicePenalty).toBeCloseTo(0.25, 3);
    });

    it('TV11B: Porn per-instance scaling (count=2) — capped', () => {
      const result = scoreFromInput(
        { porn: 2 },
        0,
      );

      // Raw = 2 × 0.25 = 0.50, capped at vice_cap = 0.40
      expect(result.vicePenalty).toBeCloseTo(0.40, 3);
    });

    it('TV14: Fractional dropdown — social = "Brief/Text" (0.5)', () => {
      const result = scoreFromInput(
        { social: 'Brief/Text' },
        0,
      );

      // WeightedSum = 0.5 × 1.0 (growth multiplier) = 0.5
      // MaxWeighted = all habit points × category multipliers
      // PositiveScore = 0.5 / (maxWeighted × 0.85)
      expect(result.positiveScore).toBeCloseTo(0.01766, 3);
      expect(result.vicePenalty).toBeCloseTo(0.0, 3);
      expect(result.baseScore).toBeCloseTo(0.01766, 3);
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.01766, 3);
    });

    it('TV15A: Just above streak threshold', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          meal_quality: 'Great',
          read: 1,
          meditate: 1,
          porn: 1,
          late_wake: 1,
        },
        5,
      );

      expect(result.positiveScore).toBeCloseTo(0.90797, 3);
      expect(result.vicePenalty).toBeCloseTo(0.28, 3);
      expect(result.baseScore).toBeCloseTo(0.65374, 3);
      // 0.65374 ≥ 0.65 → streak = 5 + 1 = 6
      expect(result.streak).toBe(6);
      expect(result.finalScore).toBeCloseTo(0.69296, 3);
    });

    it('TV15B: Just below streak threshold', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          meal_quality: 'Great',
          read: 1,
          meditate: 1,
          porn: 1,
          late_wake: 1,
          past_12am: 1,
        },
        5,
      );

      expect(result.positiveScore).toBeCloseTo(0.90797, 3);
      expect(result.vicePenalty).toBeCloseTo(0.33, 3);
      expect(result.baseScore).toBeCloseTo(0.60834, 3);
      // 0.60834 < 0.65 → streak breaks
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.60834, 3);
    });

    it('TV18: Realistic average day', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          classes: 1,
          gym: 1,
          sleep_7_9h: 1,
          supplements: 1,
          meal_quality: 'Okay',
          stretching: 1,
          social: 'Casual Hangout',
          past_12am: 1,
          phone_use: 120,
        },
        2,
      );

      expect(result.positiveScore).toBeCloseTo(0.66795, 3);
      // past_12am (0.05) + phone tier 1 (0.03) = 0.08
      expect(result.vicePenalty).toBeCloseTo(0.08, 3);
      expect(result.baseScore).toBeCloseTo(0.61451, 3);
      // 0.61451 < 0.65 → streak breaks
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.61451, 3);
    });

    it('TV19: Everything-goes-wrong day (vice cap saves some score)', () => {
      const result = scoreFromInput(
        {
          sleep_7_9h: 1,
          supplements: 1,
          porn: 2,
          weed: 1,
          binged_content: 1,
          gaming_1h: 1,
          past_12am: 1,
          phone_use: 350,
        },
        0,
      );

      expect(result.positiveScore).toBeCloseTo(0.13780, 3);
      // Raw = 0.50+0.12+0.07+0.06+0.05+0.12 = 0.92, capped at 0.40
      expect(result.vicePenalty).toBeCloseTo(0.40, 3);
      expect(result.baseScore).toBeCloseTo(0.08268, 3);
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.08268, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Config override cross-validation
  // -------------------------------------------------------------------------

  describe('Config override cross-validation', () => {
    it('TV16: vice_cap=0 disables all vice penalties', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          porn: 3,
          weed: 1,
          phone_use: 400,
        },
        0,
        { vice_cap: 0.0 },
      );

      expect(result.positiveScore).toBeCloseTo(0.31800, 3);
      expect(result.vicePenalty).toBeCloseTo(0.0, 3);
      expect(result.baseScore).toBeCloseTo(0.31800, 3);
      expect(result.streak).toBe(0);
      expect(result.finalScore).toBeCloseTo(0.31800, 3);
    });

    it('TV17: target_fraction=1.0 (perfectionist mode) — all habits max', () => {
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          job_search: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          supplements: 1,
          meal_quality: 'Great',
          stretching: 1,
          meditate: 1,
          read: 1,
          social: 'Meaningful Connection',
        },
        -1,
        { target_fraction: 1.0 },
      );

      // target = maxWeighted × 1.0 = maxWeighted
      // positiveScore = maxWeighted / maxWeighted = 1.0
      expect(result.positiveScore).toBeCloseTo(1.0, 3);
    });

    it('TV17: target_fraction=1.0 — partial habits', () => {
      // With 10/13 habits: WeightedSum = 27.4
      // MaxWeighted = 33.3, target = 33.3 × 1.0 = 33.3
      // positiveScore = 27.4 / 33.3 = 0.82282
      const result = scoreFromInput(
        {
          schoolwork: 1,
          personal_project: 1,
          classes: 1,
          job_search: 1,
          gym: 1,
          sleep_7_9h: 1,
          wake_8am: 1,
          meal_quality: 'Good',
          meditate: 1,
          read: 1,
        },
        -1,
        { target_fraction: 1.0 },
      );

      expect(result.positiveScore).toBeCloseTo(0.82282, 3);
    });
  });

  // -------------------------------------------------------------------------
  // Cascade cross-validation via full pipeline
  // -------------------------------------------------------------------------

  describe('Cascade cross-validation via full pipeline', () => {
    it('TV20: 5-day chain cascade — edit Day 3 below threshold', () => {
      // Build rows with known stored scores (from SCORING_SPEC TV20)
      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575),
        makeDailyLogRow('2026-02-03', 0.70, 2, 0.714),
        makeDailyLogRow('2026-02-04', 0.72, 3, 0.7416),
        makeDailyLogRow('2026-02-05', 0.68, 4, 0.7072),
      ];

      // Build a buildScoringInput callback that produces base_score = 0.60
      // by using the full pipeline with a DailyLogInput that yields 0.60.
      // We use a single-habit approach: positiveScore = 0.60 with no vices.
      //
      // Math: With points=100, mult=1.5, target_fraction=0.85:
      //   maxWeighted = 100 × 1.5 = 150
      //   target = 150 × 0.85 = 127.5
      //   Need: value × 1.5 / 127.5 = 0.60
      //   value = 0.60 × 127.5 / 1.5 = 51.0
      //   But we use the makeBuildFn approach from cascade.test.ts for consistency.

      // Use a simple buildFn that produces a known baseScore, matching the
      // existing cascade.test.ts pattern for reliability.
      const buildFn = (
        _row: DailyLogRow,
        previousStreak: number,
      ): ScoringInput => ({
        habitValues: [
          {
            name: 'test_habit',
            value: 0.60 * 100 * config.target_fraction,
            points: 100,
            category: HabitCategory.Productivity,
          },
        ],
        viceValues: [],
        phoneMinutes: 0,
        previousStreak,
        config,
      });

      const updates = computeCascade(
        '2026-02-03',
        allLogs,
        config,
        buildFn,
      );

      expect(updates).toHaveLength(3);

      // Day 3: recomputed — base_score drops to 0.60, streak breaks
      const day3 = updates[0]!;
      expect(day3.date).toBe('2026-02-03');
      expect(day3.baseScore).toBeCloseTo(0.60, 3);
      expect(day3.streak).toBe(0);
      expect(day3.finalScore).toBeCloseTo(0.60, 3);

      // Day 4: streak restarts 0 → 1
      const day4 = updates[1]!;
      expect(day4.date).toBe('2026-02-04');
      expect(day4.streak).toBe(1);
      expect(day4.finalScore).toBeCloseTo(0.7272, 3);

      // Day 5: streak continues 1 → 2
      const day5 = updates[2]!;
      expect(day5.date).toBe('2026-02-05');
      expect(day5.streak).toBe(2);
      expect(day5.finalScore).toBeCloseTo(0.6936, 3);
    });

    it('TV20 variant: cascade with buildScoringInputFromDailyLog', () => {
      // Use the FULL pipeline: DailyLogInput → buildScoringInputFromDailyLog
      // For the edited day, provide a DailyLogInput that produces a base_score
      // around 0.60 (below threshold).
      const editedRow: DailyLogRow = {
        ...makeDailyLogRow('2026-02-03', 0.70, 2, 0.714),
        // These habit values will be used by buildScoringInputFromDailyLog
        sleep_7_9h: 1,
        supplements: 1,
      };

      const allLogs: DailyLogRow[] = [
        makeDailyLogRow('2026-02-01', 0.80, 0, 0.80),
        makeDailyLogRow('2026-02-02', 0.75, 1, 0.7575),
        editedRow,
        makeDailyLogRow('2026-02-04', 0.72, 3, 0.7416),
        makeDailyLogRow('2026-02-05', 0.68, 4, 0.7072),
      ];

      // Build input from DailyLogRow using full pipeline
      const buildFn = (row: DailyLogRow, previousStreak: number) => {
        const input = makeDailyLogInput({
          date: row.date,
          sleep_7_9h: row.sleep_7_9h,
          supplements: row.supplements,
        });
        return buildScoringInputFromDailyLog(
          input,
          habitConfigs,
          config,
          previousStreak,
        );
      };

      const updates = computeCascade(
        '2026-02-03',
        allLogs,
        config,
        buildFn,
      );

      // Edited day should have a low score (only 2 small health habits)
      expect(updates.length).toBeGreaterThanOrEqual(1);
      const day3 = updates[0]!;
      expect(day3.date).toBe('2026-02-03');
      // sleep_7_9h (2pts × 1.3) + supplements (1pt × 1.3) = 3.9
      // maxWeighted = 33.3 (all 13 habits × category multipliers)
      // target = 33.3 × 0.85 = 28.305
      // positiveScore = 3.9 / 28.305 = 0.13778
      expect(day3.positiveScore).toBeCloseTo(0.13778, 3);
      expect(day3.baseScore).toBeCloseTo(0.13778, 3);
      expect(day3.streak).toBe(0); // well below threshold
    });
  });
});
