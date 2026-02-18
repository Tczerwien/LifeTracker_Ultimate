import { HabitPool, InputType, PenaltyMode, HabitCategory } from '../../types/enums';
import type { DailyLogRow } from '../../types/engine';
import type { HabitConfig } from '../../types/models';
import { computeCorrelations } from '../correlation';

// ---------------------------------------------------------------------------
// Test Data Factories
// ---------------------------------------------------------------------------

function makeHabitConfig(overrides?: Partial<HabitConfig>): HabitConfig {
  return {
    id: 1,
    name: 'schoolwork',
    display_name: 'Schoolwork',
    pool: HabitPool.Good,
    category: HabitCategory.Productivity,
    input_type: InputType.Checkbox,
    points: 3,
    penalty: 0,
    penalty_mode: PenaltyMode.Flat,
    options_json: null,
    sort_order: 1,
    is_active: true,
    column_name: 'schoolwork',
    created_at: '2026-01-01T00:00:00Z',
    retired_at: null,
    ...overrides,
  };
}

function makeRow(
  date: string,
  finalScore: number | null,
  habitOverrides?: Partial<DailyLogRow>,
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
    positive_score: finalScore,
    vice_penalty: 0,
    base_score: finalScore,
    streak: 0,
    final_score: finalScore,
    ...habitOverrides,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Correlation Engine (computeCorrelations)', () => {
  // -----------------------------------------------------------------------
  // 1. Perfect positive correlation
  // -----------------------------------------------------------------------
  it('returns r close to 1.0 for perfectly positively correlated habit', () => {
    const config = makeHabitConfig();
    const logs: DailyLogRow[] = [];
    for (let i = 0; i < 30; i++) {
      const isHigh = i % 2 === 0;
      logs.push(
        makeRow(`2026-01-${pad2(i + 1)}`, isHigh ? 0.9 : 0.3, {
          schoolwork: isHigh ? 1 : 0,
        }),
      );
    }

    const results = computeCorrelations(logs, [config]);
    expect(results).toHaveLength(1);

    const result = results[0]!;
    expect(result.habit).toBe('schoolwork');
    expect(result.r).not.toBeNull();
    expect(result.r!).toBeGreaterThan(0.95);
    expect(result.n).toBe(30);
    expect(result.flag).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 2. Perfect negative correlation
  // -----------------------------------------------------------------------
  it('returns r close to -1.0 for perfectly negatively correlated habit', () => {
    const config = makeHabitConfig();
    const logs: DailyLogRow[] = [];
    for (let i = 0; i < 30; i++) {
      const isHigh = i % 2 === 0;
      logs.push(
        makeRow(`2026-01-${pad2(i + 1)}`, isHigh ? 0.9 : 0.3, {
          schoolwork: isHigh ? 0 : 1,
        }),
      );
    }

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).not.toBeNull();
    expect(result.r!).toBeLessThan(-0.95);
  });

  // -----------------------------------------------------------------------
  // 3. Zero variance — always checked
  // -----------------------------------------------------------------------
  it('returns r=0 with zero_variance flag when habit is always 1', () => {
    const config = makeHabitConfig();
    const logs = Array.from({ length: 30 }, (_, i) =>
      makeRow(`2026-01-${pad2(i + 1)}`, 0.5 + i * 0.01, {
        schoolwork: 1,
      }),
    );

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).toBe(0);
    expect(result.flag).toBe('zero_variance');
    expect(result.n).toBe(30);
  });

  // -----------------------------------------------------------------------
  // 4. Zero variance — never checked
  // -----------------------------------------------------------------------
  it('returns r=0 with zero_variance flag when habit is always 0', () => {
    const config = makeHabitConfig();
    const logs = Array.from({ length: 30 }, (_, i) =>
      makeRow(`2026-01-${pad2(i + 1)}`, 0.5 + i * 0.01, {
        schoolwork: 0,
      }),
    );

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).toBe(0);
    expect(result.flag).toBe('zero_variance');
  });

  // -----------------------------------------------------------------------
  // 5. Insufficient data (n < 7)
  // -----------------------------------------------------------------------
  it('returns r=null with insufficient_data flag when n < 7', () => {
    const config = makeHabitConfig();
    const logs = Array.from({ length: 3 }, (_, i) =>
      makeRow(`2026-01-${pad2(i + 1)}`, 0.7, { schoolwork: i % 2 }),
    );

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).toBeNull();
    expect(result.flag).toBe('insufficient_data');
    expect(result.n).toBe(3);
  });

  // -----------------------------------------------------------------------
  // 6. Exactly 7 entries — minimum threshold met
  // -----------------------------------------------------------------------
  it('computes r when n equals the minimum threshold of 7', () => {
    const config = makeHabitConfig();
    const logs = Array.from({ length: 7 }, (_, i) =>
      makeRow(`2026-01-${pad2(i + 1)}`, 0.5 + i * 0.05, {
        schoolwork: i % 2,
      }),
    );

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).not.toBeNull();
    expect(typeof result.r).toBe('number');
    expect(result.flag).toBeUndefined();
    expect(result.n).toBe(7);
  });

  // -----------------------------------------------------------------------
  // 7. Mixed realistic data (50+ entries)
  // -----------------------------------------------------------------------
  it('handles 50 rows of mixed realistic data without NaN', () => {
    const config = makeHabitConfig();
    const logs = Array.from({ length: 50 }, (_, i) => {
      const habitVal = i % 3 === 0 ? 1 : 0;
      const score = 0.5 + habitVal * 0.3 + (i % 7) * 0.01;
      return makeRow(`2026-${pad2(Math.floor(i / 28) + 1)}-${pad2((i % 28) + 1)}`, Math.min(1.0, score), {
        schoolwork: habitVal,
      });
    });

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).not.toBeNull();
    expect(result.r).not.toBeNaN();
    expect(result.r!).toBeGreaterThanOrEqual(-1);
    expect(result.r!).toBeLessThanOrEqual(1);
    expect(result.n).toBe(50);
    expect(result.flag).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 8. Empty input
  // -----------------------------------------------------------------------
  it('returns empty array for empty logs', () => {
    const config = makeHabitConfig();
    const results = computeCorrelations([], [config]);
    expect(results).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 9. All habits retired
  // -----------------------------------------------------------------------
  it('returns empty array when all habits are retired', () => {
    const retiredConfig = makeHabitConfig({
      retired_at: '2025-12-01T00:00:00Z',
      is_active: false,
    });
    const logs = Array.from({ length: 10 }, (_, i) =>
      makeRow(`2026-01-${pad2(i + 1)}`, 0.7),
    );

    const results = computeCorrelations(logs, [retiredConfig]);
    expect(results).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 10. Retired habits excluded, active included
  // -----------------------------------------------------------------------
  it('excludes retired habits while including active ones', () => {
    const activeConfig = makeHabitConfig({
      id: 1,
      name: 'schoolwork',
      column_name: 'schoolwork',
    });
    const retiredConfig = makeHabitConfig({
      id: 2,
      name: 'gym',
      display_name: 'Gym',
      column_name: 'gym',
      retired_at: '2025-12-01T00:00:00Z',
      is_active: false,
    });

    const logs = Array.from({ length: 10 }, (_, i) =>
      makeRow(`2026-01-${pad2(i + 1)}`, 0.5 + i * 0.04, {
        schoolwork: i % 2,
        gym: i % 2,
      }),
    );

    const results = computeCorrelations(logs, [activeConfig, retiredConfig]);
    expect(results).toHaveLength(1);
    expect(results[0]!.habit).toBe('schoolwork');

    const habitNames = results.map((r) => r.habit);
    expect(habitNames).not.toContain('gym');
  });

  // -----------------------------------------------------------------------
  // 11. Sorting by |r| descending
  // -----------------------------------------------------------------------
  it('sorts results by |r| descending', () => {
    const schoolworkConfig = makeHabitConfig({
      id: 1,
      name: 'schoolwork',
      column_name: 'schoolwork',
      sort_order: 1,
    });
    const gymConfig = makeHabitConfig({
      id: 2,
      name: 'gym',
      display_name: 'Gym',
      column_name: 'gym',
      sort_order: 2,
    });
    const readConfig = makeHabitConfig({
      id: 3,
      name: 'read',
      display_name: 'Read',
      column_name: 'read',
      category: HabitCategory.Growth,
      points: 1,
      sort_order: 3,
    });

    // schoolwork perfectly tracks score, gym always 0, read inversely tracks
    const logs = Array.from({ length: 8 }, (_, i) => {
      const isHigh = i % 2 === 0;
      return makeRow(`2026-01-${pad2(i + 1)}`, isHigh ? 0.9 : 0.1, {
        schoolwork: isHigh ? 1 : 0,
        gym: 0,
        read: isHigh ? 0 : 1,
      });
    });

    const results = computeCorrelations(logs, [
      schoolworkConfig,
      gymConfig,
      readConfig,
    ]);

    expect(results).toHaveLength(3);

    // gym has zero variance (always 0) → r=0, must be last
    expect(results[2]!.habit).toBe('gym');
    expect(results[2]!.flag).toBe('zero_variance');

    // schoolwork and read tie at |r|≈1.0 — either order is valid
    const topTwo = [results[0]!.habit, results[1]!.habit];
    expect(topTwo).toContain('schoolwork');
    expect(topTwo).toContain('read');
  });

  // -----------------------------------------------------------------------
  // 12. Multiple habits with different input types
  // -----------------------------------------------------------------------
  it('handles multiple habits including dropdown types', () => {
    const schoolworkConfig = makeHabitConfig({
      id: 1,
      name: 'schoolwork',
      column_name: 'schoolwork',
      input_type: InputType.Checkbox,
    });
    const mealConfig = makeHabitConfig({
      id: 2,
      name: 'meal_quality',
      display_name: 'Meal Quality',
      column_name: 'meal_quality',
      input_type: InputType.Dropdown,
      options_json: JSON.stringify({
        Poor: 0,
        Okay: 1,
        Good: 2,
        Great: 3,
      }),
      points: 3,
      sort_order: 5,
    });

    const mealLabels = ['Poor', 'Okay', 'Good', 'Great'] as const;

    // 14 rows: schoolwork correlates with score, meal_quality tracks monotonically
    const logs = Array.from({ length: 14 }, (_, i) => {
      const score = 0.3 + (i / 14) * 0.6;
      const mealIdx = Math.min(Math.floor((i / 14) * 4), 3);
      return makeRow(`2026-01-${pad2(i + 1)}`, score, {
        schoolwork: score > 0.55 ? 1 : 0,
        meal_quality: mealLabels[mealIdx]!,
      });
    });

    const results = computeCorrelations(logs, [schoolworkConfig, mealConfig]);

    expect(results).toHaveLength(2);

    for (const r of results) {
      expect(r.n).toBe(14);
      expect(r.r).not.toBeNull();
    }

    // First result has highest |r|
    const absFirst = Math.abs(results[0]!.r!);
    const absSecond = Math.abs(results[1]!.r!);
    expect(absFirst).toBeGreaterThanOrEqual(absSecond);
  });

  // -----------------------------------------------------------------------
  // 13. Rows with null final_score excluded from paired data
  // -----------------------------------------------------------------------
  it('excludes rows where final_score is null from paired data', () => {
    const config = makeHabitConfig();
    const logs = [
      // 6 scored rows + 1 null-score row = only 6 valid pairs
      ...Array.from({ length: 6 }, (_, i) =>
        makeRow(`2026-01-${pad2(i + 1)}`, 0.7, { schoolwork: i % 2 }),
      ),
      makeRow('2026-01-07', null, { schoolwork: 1 }),
    ];

    const results = computeCorrelations(logs, [config]);
    const result = results[0]!;
    expect(result.r).toBeNull();
    expect(result.n).toBe(6);
    expect(result.flag).toBe('insufficient_data');
  });
});
