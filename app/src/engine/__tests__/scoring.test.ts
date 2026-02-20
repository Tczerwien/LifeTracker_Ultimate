import { HabitCategory, PenaltyMode } from '../../types/enums';
import type { ScoringInput, ScoringConfig } from '../../types/engine';
import {
  categoryMultiplier,
  computeMaxWeighted,
  computePositiveScore,
  computeVicePenalty,
  computeBaseScore,
  computeStreak,
  computeFinalScore,
  computeScores,
} from '../scoring';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

interface HabitSeed {
  name: string;
  points: number;
  category: HabitCategory;
}

const SEED_HABITS: HabitSeed[] = [
  { name: 'schoolwork', points: 3, category: HabitCategory.Productivity },
  { name: 'personal_project', points: 3, category: HabitCategory.Productivity },
  { name: 'classes', points: 2, category: HabitCategory.Productivity },
  { name: 'job_search', points: 2, category: HabitCategory.Productivity },
  { name: 'gym', points: 3, category: HabitCategory.Health },
  { name: 'sleep_7_9h', points: 2, category: HabitCategory.Health },
  { name: 'wake_8am', points: 1, category: HabitCategory.Health },
  { name: 'supplements', points: 1, category: HabitCategory.Health },
  { name: 'meal_quality', points: 3, category: HabitCategory.Health },
  { name: 'stretching', points: 1, category: HabitCategory.Health },
  { name: 'meditate', points: 1, category: HabitCategory.Growth },
  { name: 'read', points: 1, category: HabitCategory.Growth },
  { name: 'social', points: 2, category: HabitCategory.Growth },
];

interface ViceSeed {
  name: string;
  penaltyValue: number;
  penaltyMode: PenaltyMode;
}

const SEED_VICES: ViceSeed[] = [
  { name: 'porn', penaltyValue: 0.25, penaltyMode: PenaltyMode.PerInstance },
  { name: 'masturbate', penaltyValue: 0.10, penaltyMode: PenaltyMode.Flat },
  { name: 'weed', penaltyValue: 0.12, penaltyMode: PenaltyMode.Flat },
  { name: 'skip_class', penaltyValue: 0.08, penaltyMode: PenaltyMode.Flat },
  { name: 'binged_content', penaltyValue: 0.07, penaltyMode: PenaltyMode.Flat },
  { name: 'gaming_1h', penaltyValue: 0.06, penaltyMode: PenaltyMode.Flat },
  { name: 'past_12am', penaltyValue: 0.05, penaltyMode: PenaltyMode.Flat },
  { name: 'late_wake', penaltyValue: 0.03, penaltyMode: PenaltyMode.Flat },
  // phone_use excluded — handled by ScoringInput.phoneMinutes
];

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

function allHabitsAtMax(): ScoringInput['habitValues'] {
  return SEED_HABITS.map((h) => ({ ...h, value: h.points }));
}

function allHabitsAtZero(): ScoringInput['habitValues'] {
  return SEED_HABITS.map((h) => ({ ...h, value: 0 }));
}

function habitsWith(
  overrides: Record<string, number>,
): ScoringInput['habitValues'] {
  return SEED_HABITS.map((h) => ({
    ...h,
    value: overrides[h.name] ?? 0,
  }));
}

function allVicesOff(): ScoringInput['viceValues'] {
  return SEED_VICES.map((v) => ({
    ...v,
    triggered: false,
    count: v.penaltyMode === PenaltyMode.PerInstance ? 0 : undefined,
  }));
}

function allVicesOn(): ScoringInput['viceValues'] {
  return SEED_VICES.map((v) => ({
    ...v,
    triggered: true,
    count: v.penaltyMode === PenaltyMode.PerInstance ? 1 : undefined,
  }));
}

function vicesWith(
  overrides: Record<string, { triggered?: boolean; count?: number }>,
): ScoringInput['viceValues'] {
  return SEED_VICES.map((v) => {
    const o = overrides[v.name];
    if (!o) {
      return {
        ...v,
        triggered: false,
        count: v.penaltyMode === PenaltyMode.PerInstance ? 0 : undefined,
      };
    }
    return {
      ...v,
      triggered: o.triggered ?? false,
      count: o.count,
    };
  });
}

function makeInput(params: {
  habits?: ScoringInput['habitValues'];
  vices?: ScoringInput['viceValues'];
  phoneMinutes?: number;
  previousStreak?: number;
  configOverrides?: Partial<ScoringConfig>;
}): ScoringInput {
  return {
    habitValues: params.habits ?? allHabitsAtZero(),
    viceValues: params.vices ?? allVicesOff(),
    phoneMinutes: params.phoneMinutes ?? 0,
    previousStreak: params.previousStreak ?? 0,
    config: makeDefaultConfig(params.configOverrides),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Scoring Engine', () => {
  // -----------------------------------------------------------------------
  // categoryMultiplier
  // -----------------------------------------------------------------------

  describe('categoryMultiplier', () => {
    const config = makeDefaultConfig();

    it('maps Productivity to multiplier_productivity', () => {
      expect(categoryMultiplier(HabitCategory.Productivity, config)).toBe(1.5);
    });

    it('maps Health to multiplier_health', () => {
      expect(categoryMultiplier(HabitCategory.Health, config)).toBe(1.3);
    });

    it('maps Growth to multiplier_growth', () => {
      expect(categoryMultiplier(HabitCategory.Growth, config)).toBe(1.0);
    });
  });

  // -----------------------------------------------------------------------
  // computeMaxWeighted
  // -----------------------------------------------------------------------

  describe('computeMaxWeighted', () => {
    const config = makeDefaultConfig();

    it('computes 33.3 for all 13 seed habits', () => {
      const habits = allHabitsAtMax();
      expect(computeMaxWeighted(habits, config)).toBeCloseTo(33.3, 3);
    });

    it('returns 0 for empty habits array (DS7)', () => {
      expect(computeMaxWeighted([], config)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // computePositiveScore
  // -----------------------------------------------------------------------

  describe('computePositiveScore', () => {
    const config = makeDefaultConfig();
    const maxWeighted = 33.3;

    it('returns 1.0 when all habits at max (exceeds target, capped)', () => {
      const habits = allHabitsAtMax();
      expect(
        computePositiveScore(habits, maxWeighted, 0.85, config),
      ).toBeCloseTo(1.0, 3);
    });

    it('returns 0.0 when all habits at zero', () => {
      const habits = allHabitsAtZero();
      expect(
        computePositiveScore(habits, maxWeighted, 0.85, config),
      ).toBeCloseTo(0.0, 3);
    });

    it('returns 0.0 when maxWeighted is 0 (DS7 guard)', () => {
      const habits = allHabitsAtZero();
      expect(computePositiveScore(habits, 0, 0.85, config)).toBe(0);
    });

    it('returns 0.0 when target is 0 (targetFraction = 0)', () => {
      const habits = allHabitsAtMax();
      expect(computePositiveScore(habits, maxWeighted, 0, config)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // computeVicePenalty
  // -----------------------------------------------------------------------

  describe('computeVicePenalty', () => {
    const config = makeDefaultConfig();

    it('returns 0 when no vices triggered', () => {
      expect(computeVicePenalty(allVicesOff(), 0, config)).toBe(0);
    });

    it('computes flat penalty correctly', () => {
      const vices = vicesWith({ past_12am: { triggered: true } });
      expect(computeVicePenalty(vices, 0, config)).toBeCloseTo(0.05, 3);
    });

    it('computes per_instance penalty correctly', () => {
      const vices = vicesWith({ porn: { triggered: true, count: 1 } });
      expect(computeVicePenalty(vices, 0, config)).toBeCloseTo(0.25, 3);
    });

    it('caps penalty at vice_cap', () => {
      const vices = vicesWith({ porn: { triggered: true, count: 2 } });
      // 2 × 0.25 = 0.50, capped at 0.40
      expect(computeVicePenalty(vices, 0, config)).toBeCloseTo(0.40, 3);
    });

    it('ignores PenaltyMode.Tiered entries in viceValues', () => {
      const vices: ScoringInput['viceValues'] = [
        {
          name: 'phone_use',
          triggered: true,
          penaltyValue: 0.12,
          penaltyMode: PenaltyMode.Tiered,
        },
      ];
      expect(computeVicePenalty(vices, 0, config)).toBe(0);
    });

    // TV10: Phone tier boundary values
    describe('phone tiers (TV10)', () => {
      it('TV10A: phone=60 (below t1=61) → penalty 0', () => {
        expect(computeVicePenalty(allVicesOff(), 60, config)).toBeCloseTo(0, 3);
      });

      it('TV10B: phone=61 (exactly t1) → penalty 0.03', () => {
        expect(computeVicePenalty(allVicesOff(), 61, config)).toBeCloseTo(
          0.03,
          3,
        );
      });

      it('TV10C: phone=180 (between t1 and t2) → penalty 0.03', () => {
        expect(computeVicePenalty(allVicesOff(), 180, config)).toBeCloseTo(
          0.03,
          3,
        );
      });

      it('TV10D: phone=181 (exactly t2) → penalty 0.07', () => {
        expect(computeVicePenalty(allVicesOff(), 181, config)).toBeCloseTo(
          0.07,
          3,
        );
      });

      it('TV10E: phone=301 (exactly t3) → penalty 0.12', () => {
        expect(computeVicePenalty(allVicesOff(), 301, config)).toBeCloseTo(
          0.12,
          3,
        );
      });

      it('TV10F: phone=0 → penalty 0', () => {
        expect(computeVicePenalty(allVicesOff(), 0, config)).toBeCloseTo(0, 3);
      });
    });

    // Edge cases
    it('E4: NaN phoneMinutes treated as 0', () => {
      expect(computeVicePenalty(allVicesOff(), NaN, config)).toBe(0);
    });

    it('E5: negative phoneMinutes treated as 0', () => {
      expect(computeVicePenalty(allVicesOff(), -100, config)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // computeBaseScore
  // -----------------------------------------------------------------------

  describe('computeBaseScore', () => {
    it('computes positiveScore × (1 - vicePenalty)', () => {
      expect(computeBaseScore(0.8, 0.25)).toBeCloseTo(0.6, 3);
    });
  });

  // -----------------------------------------------------------------------
  // computeStreak
  // -----------------------------------------------------------------------

  describe('computeStreak', () => {
    it('returns previousStreak + 1 when baseScore >= threshold', () => {
      expect(computeStreak(0.70, 3, 0.65)).toBe(4);
    });

    it('returns 0 when baseScore < threshold', () => {
      expect(computeStreak(0.60, 5, 0.65)).toBe(0);
    });

    it('returns 0 for Day 1 (previousStreak = -1) even if qualifying', () => {
      expect(computeStreak(1.0, -1, 0.65)).toBe(0);
    });

    it('returns 1 for gap day (previousStreak = 0) if qualifying', () => {
      expect(computeStreak(0.70, 0, 0.65)).toBe(1);
    });

    it('continues streak when baseScore exactly at threshold (E8)', () => {
      expect(computeStreak(0.65, 5, 0.65)).toBe(6);
    });

    it('breaks streak when baseScore just below threshold (E9)', () => {
      expect(computeStreak(0.6499, 5, 0.65)).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // computeFinalScore
  // -----------------------------------------------------------------------

  describe('computeFinalScore', () => {
    it('returns baseScore when streak = 0 (no bonus)', () => {
      expect(computeFinalScore(0.75, 0, 0.01, 0.10)).toBeCloseTo(0.75, 3);
    });

    it('applies streak bonus correctly', () => {
      // streak=5, bonus=5*0.01=0.05, final=0.75*1.05=0.7875
      expect(computeFinalScore(0.75, 5, 0.01, 0.10)).toBeCloseTo(0.7875, 3);
    });

    it('caps streak bonus at maxStreakBonus', () => {
      // streak=15, bonus would be 0.15 but capped at 0.10
      expect(computeFinalScore(0.80, 15, 0.01, 0.10)).toBeCloseTo(0.88, 3);
    });

    it('caps finalScore at 1.0 (DS6)', () => {
      // baseScore=0.95, streak=10, bonus=0.10, 0.95*1.10=1.045 → capped at 1.0
      expect(computeFinalScore(0.95, 10, 0.01, 0.10)).toBeCloseTo(1.0, 3);
    });
  });

  // -----------------------------------------------------------------------
  // computeScores — Full Pipeline Test Vectors
  // -----------------------------------------------------------------------

  describe('Test Vectors — Full Pipeline', () => {
    it('TV01: Perfect day, Day 1', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        previousStreak: -1, // Day 1 convention
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(1.0, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(1.0, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV02: Empty day — nothing done, no vices', () => {
      const input = makeInput({
        previousStreak: 3,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.0, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(0.0, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.0, 3);
    });

    it('TV03: Vice-heavy day — all vices, no habits', () => {
      const input = makeInput({
        vices: allVicesOn(),
        phoneMinutes: 400,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.0, 3);
      expect(r.vicePenalty).toBeCloseTo(0.4, 3);
      expect(r.baseScore).toBeCloseTo(0.0, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.0, 3);
    });

    it('TV04: Good day with single relapse — streak breaks', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          gym: 3,
          sleep_7_9h: 2,
          wake_8am: 1,
          meal_quality: 3,
          meditate: 1,
          read: 1,
        }),
        vices: vicesWith({ porn: { triggered: true, count: 1 } }),
        previousStreak: 4,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.80212, 3);
      expect(r.vicePenalty).toBeCloseTo(0.25, 3);
      expect(r.baseScore).toBeCloseTo(0.60159, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.60159, 3);
    });

    it('TV05: Streak building — Day 2 after qualifying Day 1', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          classes: 2,
          gym: 3,
          sleep_7_9h: 2,
          supplements: 1,
          meal_quality: 2,
          stretching: 1,
          read: 1,
        }),
        vices: vicesWith({ past_12am: { triggered: true } }),
        previousStreak: 0,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.87262, 3);
      expect(r.vicePenalty).toBeCloseTo(0.05, 3);
      expect(r.baseScore).toBeCloseTo(0.82899, 3);
      expect(r.streak).toBe(1);
      expect(r.finalScore).toBeCloseTo(0.83728, 3);
    });

    it('TV06: Streak at maximum bonus (Day 11+)', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        previousStreak: 10,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(1.0, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(1.0, 3);
      expect(r.streak).toBe(11);
      expect(r.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV07: Streak bonus visible — not capped by 1.0', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          classes: 2,
          job_search: 2,
          gym: 3,
          sleep_7_9h: 2,
          wake_8am: 1,
          meal_quality: 2,
          meditate: 1,
          read: 1,
        }),
        previousStreak: 9,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.96804, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(0.96804, 3);
      expect(r.streak).toBe(10);
      // 0.96804 × 1.10 = 1.06484 → capped at 1.0
      expect(r.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV08: Streak bonus visible — lower base score', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          gym: 3,
          sleep_7_9h: 2,
          meal_quality: 2,
          read: 1,
        }),
        previousStreak: 7,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.67494, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(0.67494, 3);
      expect(r.streak).toBe(8);
      expect(r.finalScore).toBeCloseTo(0.72893, 3);
    });

    it('TV09: Gap in tracking — streak reset to 0, today qualifies', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        previousStreak: 0, // Gap resets previousStreak to 0
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(1.0, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(1.0, 3);
      expect(r.streak).toBe(1);
      expect(r.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV12: Multiple vices exactly at cap', () => {
      // porn(0.25) + weed(0.12) + late_wake(0.03) = 0.40
      const input = makeInput({
        habits: allHabitsAtMax(),
        vices: vicesWith({
          porn: { triggered: true, count: 1 },
          weed: { triggered: true },
          late_wake: { triggered: true },
        }),
      });
      const r = computeScores(input);
      expect(r.vicePenalty).toBeCloseTo(0.4, 3);
    });

    it('TV13: Multiple vices below cap', () => {
      // skip_class(0.08) + binged_content(0.07) + past_12am(0.05) = 0.20
      const input = makeInput({
        habits: allHabitsAtMax(),
        vices: vicesWith({
          skip_class: { triggered: true },
          binged_content: { triggered: true },
          past_12am: { triggered: true },
        }),
      });
      const r = computeScores(input);
      expect(r.vicePenalty).toBeCloseTo(0.2, 3);
    });

    it('TV14: Fractional dropdown — social = 0.5 ("Brief/Text")', () => {
      const input = makeInput({
        habits: habitsWith({ social: 0.5 }),
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.01766, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(0.01766, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.01766, 3);
    });

    it('TV15A: Just above streak threshold — streak continues', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          classes: 2,
          gym: 3,
          sleep_7_9h: 2,
          wake_8am: 1,
          meal_quality: 3,
          read: 1,
          meditate: 1,
        }),
        vices: vicesWith({
          porn: { triggered: true, count: 1 },
          late_wake: { triggered: true },
        }),
        previousStreak: 5,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.90797, 3);
      expect(r.vicePenalty).toBeCloseTo(0.28, 3);
      expect(r.baseScore).toBeCloseTo(0.65374, 3);
      expect(r.streak).toBe(6);
      expect(r.finalScore).toBeCloseTo(0.69296, 3);
    });

    it('TV15B: Just below streak threshold — streak breaks', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          classes: 2,
          gym: 3,
          sleep_7_9h: 2,
          wake_8am: 1,
          meal_quality: 3,
          read: 1,
          meditate: 1,
        }),
        vices: vicesWith({
          porn: { triggered: true, count: 1 },
          late_wake: { triggered: true },
          past_12am: { triggered: true },
        }),
        previousStreak: 5,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.90797, 3);
      expect(r.vicePenalty).toBeCloseTo(0.33, 3);
      expect(r.baseScore).toBeCloseTo(0.60834, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.60834, 3);
    });

    it('TV16: Vice cap = 0 — vices disabled', () => {
      const input = makeInput({
        habits: habitsWith({ schoolwork: 3, personal_project: 3 }),
        vices: vicesWith({ porn: { triggered: true, count: 3 }, weed: { triggered: true } }),
        phoneMinutes: 400,
        configOverrides: { vice_cap: 0.0 },
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.318, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(0.318, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.318, 3);
    });

    it('TV17: Target fraction = 1.0 — perfectionist mode', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        previousStreak: 0,
        configOverrides: { target_fraction: 1.0 },
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(1.0, 3);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.baseScore).toBeCloseTo(1.0, 3);
      expect(r.streak).toBe(1);
      expect(r.finalScore).toBeCloseTo(1.0, 3);
    });

    it('TV18: Realistic average day', () => {
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          classes: 2,
          gym: 3,
          sleep_7_9h: 2,
          supplements: 1,
          meal_quality: 1,
          stretching: 1,
          social: 1,
        }),
        vices: vicesWith({ past_12am: { triggered: true } }),
        phoneMinutes: 120,
        previousStreak: 2,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.66795, 3);
      expect(r.vicePenalty).toBeCloseTo(0.08, 3);
      expect(r.baseScore).toBeCloseTo(0.61451, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.61451, 3);
    });

    it('TV19: Everything-goes-wrong day (cap preserves some score)', () => {
      const input = makeInput({
        habits: habitsWith({ sleep_7_9h: 2, supplements: 1 }),
        vices: vicesWith({
          porn: { triggered: true, count: 2 },
          weed: { triggered: true },
          binged_content: { triggered: true },
          gaming_1h: { triggered: true },
          past_12am: { triggered: true },
        }),
        phoneMinutes: 350,
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBeCloseTo(0.1378, 3);
      expect(r.vicePenalty).toBeCloseTo(0.4, 3);
      expect(r.baseScore).toBeCloseTo(0.08268, 3);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBeCloseTo(0.08268, 3);
    });
  });

  // -----------------------------------------------------------------------
  // TV11: Porn per-instance scaling (helper-level)
  // -----------------------------------------------------------------------

  describe('TV11: Porn per-instance scaling', () => {
    const config = makeDefaultConfig();

    it('TV11A: porn=1 → penalty 0.25', () => {
      const vices = vicesWith({ porn: { triggered: true, count: 1 } });
      expect(computeVicePenalty(vices, 0, config)).toBeCloseTo(0.25, 3);
    });

    it('TV11B: porn=2 → penalty capped at 0.40', () => {
      const vices = vicesWith({ porn: { triggered: true, count: 2 } });
      expect(computeVicePenalty(vices, 0, config)).toBeCloseTo(0.4, 3);
    });

    it('TV11C: porn=0 → penalty 0', () => {
      const vices = vicesWith({ porn: { triggered: false, count: 0 } });
      expect(computeVicePenalty(vices, 0, config)).toBeCloseTo(0, 3);
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases (E-table)
  // -----------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('E4: NaN phoneMinutes — full pipeline treats as 0', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        phoneMinutes: NaN,
        previousStreak: -1,
      });
      const r = computeScores(input);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
      expect(r.positiveScore).toBeCloseTo(1.0, 3);
    });

    it('E5: Negative phoneMinutes — full pipeline treats as 0', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        phoneMinutes: -500,
        previousStreak: -1,
      });
      const r = computeScores(input);
      expect(r.vicePenalty).toBeCloseTo(0.0, 3);
    });

    it('E17: All habits retired (empty array) → positiveScore = 0', () => {
      const input = makeInput({
        habits: [],
        vices: vicesWith({ past_12am: { triggered: true } }),
      });
      const r = computeScores(input);
      expect(r.positiveScore).toBe(0);
      expect(r.baseScore).toBe(0);
      expect(r.streak).toBe(0);
      expect(r.finalScore).toBe(0);
    });

    it('E23: FinalScore would exceed 1.0 from streak bonus — capped', () => {
      // baseScore = 0.95, streak = 10, bonus = 0.10
      // 0.95 × 1.10 = 1.045 → capped at 1.0
      const input = makeInput({
        habits: habitsWith({
          schoolwork: 3,
          personal_project: 3,
          classes: 2,
          job_search: 2,
          gym: 3,
          sleep_7_9h: 2,
          wake_8am: 1,
          supplements: 1,
          meal_quality: 3,
          stretching: 1,
          meditate: 1,
          read: 1,
        }),
        previousStreak: 10,
      });
      const r = computeScores(input);
      expect(r.streak).toBe(11);
      expect(r.finalScore).toBeCloseTo(1.0, 3);
    });

    it('E9: vice_cap = 0.0 means vices are completely disabled', () => {
      const input = makeInput({
        habits: allHabitsAtMax(),
        vices: allVicesOn(),
        phoneMinutes: 400,
        configOverrides: { vice_cap: 0.0 },
      });
      const r = computeScores(input);
      expect(r.vicePenalty).toBe(0);
      expect(r.baseScore).toBeCloseTo(1.0, 3);
    });

    it('E10: vice_cap = 1.0 allows full penalty to negate effort', () => {
      // All vices triggered: total raw = 0.88, with vice_cap=1.0 → 0.88
      const input = makeInput({
        habits: allHabitsAtMax(),
        vices: allVicesOn(),
        phoneMinutes: 400,
        configOverrides: { vice_cap: 1.0 },
      });
      const r = computeScores(input);
      // 0.25+0.10+0.12+0.08+0.07+0.06+0.05+0.03+0.12 = 0.88
      expect(r.vicePenalty).toBeCloseTo(0.88, 3);
      expect(r.baseScore).toBeCloseTo(1.0 * (1 - 0.88), 3);
    });
  });

  // -----------------------------------------------------------------------
  // Boundary Tests
  // -----------------------------------------------------------------------

  describe('Boundary Tests', () => {
    const config = makeDefaultConfig();

    it('phone at exactly 60 → no penalty (below t1=61)', () => {
      expect(computeVicePenalty(allVicesOff(), 60, config)).toBe(0);
    });

    it('phone at exactly 61 → t1 penalty', () => {
      expect(computeVicePenalty(allVicesOff(), 61, config)).toBeCloseTo(
        0.03,
        3,
      );
    });

    it('phone at exactly 180 → t1 penalty (below t2=181)', () => {
      expect(computeVicePenalty(allVicesOff(), 180, config)).toBeCloseTo(
        0.03,
        3,
      );
    });

    it('phone at exactly 181 → t2 penalty', () => {
      expect(computeVicePenalty(allVicesOff(), 181, config)).toBeCloseTo(
        0.07,
        3,
      );
    });

    it('phone at exactly 300 → t2 penalty (below t3=301)', () => {
      expect(computeVicePenalty(allVicesOff(), 300, config)).toBeCloseTo(
        0.07,
        3,
      );
    });

    it('phone at exactly 301 → t3 penalty', () => {
      expect(computeVicePenalty(allVicesOff(), 301, config)).toBeCloseTo(
        0.12,
        3,
      );
    });

    it('baseScore exactly at streakThreshold → streak continues', () => {
      expect(computeStreak(0.65, 5, 0.65)).toBe(6);
    });

    it('baseScore at streakThreshold - 0.001 → streak breaks', () => {
      expect(computeStreak(0.649, 5, 0.65)).toBe(0);
    });
  });
});

// TV20 (Cascade) is tested in cascade.test.ts (Phase 3, Step 3.3)
