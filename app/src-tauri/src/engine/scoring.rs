use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HabitCategory {
    Productivity,
    Health,
    Growth,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PenaltyMode {
    Flat,
    PerInstance,
    Tiered,
}

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringConfig {
    pub multiplier_productivity: f64,
    pub multiplier_health: f64,
    pub multiplier_growth: f64,
    pub target_fraction: f64,
    pub vice_cap: f64,
    pub streak_threshold: f64,
    pub streak_bonus_per_day: f64,
    pub max_streak_bonus: f64,
    pub phone_t1_min: f64,
    pub phone_t2_min: f64,
    pub phone_t3_min: f64,
    pub phone_t1_penalty: f64,
    pub phone_t2_penalty: f64,
    pub phone_t3_penalty: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitValue {
    pub name: String,
    pub value: f64,
    pub points: f64,
    pub category: HabitCategory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViceValue {
    pub name: String,
    pub triggered: bool,
    pub count: Option<u32>,
    pub penalty_value: f64,
    pub penalty_mode: PenaltyMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringInput {
    pub habit_values: Vec<HabitValue>,
    pub vice_values: Vec<ViceValue>,
    pub phone_minutes: f64,
    pub previous_streak: i32,
    pub config: ScoringConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringOutput {
    pub positive_score: f64,
    pub vice_penalty: f64,
    pub base_score: f64,
    pub streak: i32,
    pub final_score: f64,
}

// ---------------------------------------------------------------------------
// Helper: Category -> Multiplier
// ---------------------------------------------------------------------------

pub fn category_multiplier(category: HabitCategory, config: &ScoringConfig) -> f64 {
    match category {
        HabitCategory::Productivity => config.multiplier_productivity,
        HabitCategory::Health => config.multiplier_health,
        HabitCategory::Growth => config.multiplier_growth,
    }
}

// ---------------------------------------------------------------------------
// Helper: Max Weighted Sum (denominator basis)
// ---------------------------------------------------------------------------

pub fn compute_max_weighted(habits: &[HabitValue], config: &ScoringConfig) -> f64 {
    habits
        .iter()
        .fold(0.0, |sum, h| sum + h.points * category_multiplier(h.category, config))
}

// ---------------------------------------------------------------------------
// Helper: Positive Score
// ---------------------------------------------------------------------------

pub fn compute_positive_score(
    habits: &[HabitValue],
    max_weighted: f64,
    target_fraction: f64,
    config: &ScoringConfig,
) -> f64 {
    if max_weighted == 0.0 {
        return 0.0; // DS7
    }

    let target = max_weighted * target_fraction;
    if target == 0.0 {
        return 0.0;
    }

    let weighted_sum = habits
        .iter()
        .fold(0.0, |sum, h| sum + h.value * category_multiplier(h.category, config));

    f64::min(1.0, weighted_sum / target)
}

// ---------------------------------------------------------------------------
// Helper: Vice Penalty
// ---------------------------------------------------------------------------

pub fn compute_vice_penalty(
    vices: &[ViceValue],
    phone_minutes: f64,
    config: &ScoringConfig,
) -> f64 {
    // E4/E5: sanitize phone input
    let safe_phone = if phone_minutes.is_nan() || phone_minutes < 0.0 {
        0.0
    } else {
        phone_minutes
    };

    let mut sum = 0.0;

    for v in vices {
        match v.penalty_mode {
            PenaltyMode::Flat => {
                if v.triggered {
                    sum += v.penalty_value;
                }
            }
            PenaltyMode::PerInstance => {
                sum += (v.count.unwrap_or(0) as f64) * v.penalty_value;
            }
            PenaltyMode::Tiered => {
                // Phone is handled separately via phone_minutes — skip
            }
        }
    }

    // DS8: Phone tiers are mutually exclusive — highest qualifying tier wins
    if safe_phone >= config.phone_t3_min {
        sum += config.phone_t3_penalty;
    } else if safe_phone >= config.phone_t2_min {
        sum += config.phone_t2_penalty;
    } else if safe_phone >= config.phone_t1_min {
        sum += config.phone_t1_penalty;
    }

    f64::min(config.vice_cap, sum)
}

// ---------------------------------------------------------------------------
// Helper: Base Score
// ---------------------------------------------------------------------------

pub fn compute_base_score(positive_score: f64, vice_penalty: f64) -> f64 {
    positive_score * (1.0 - vice_penalty)
}

// ---------------------------------------------------------------------------
// Helper: Streak
// ---------------------------------------------------------------------------

pub fn compute_streak(base_score: f64, previous_streak: i32, streak_threshold: f64) -> i32 {
    // Day 1 convention: caller passes previous_streak = -1 → -1 + 1 = 0
    // Gap convention:   caller passes previous_streak = 0  → 0 + 1 = 1
    if base_score >= streak_threshold {
        previous_streak + 1
    } else {
        0
    }
}

// ---------------------------------------------------------------------------
// Helper: Final Score
// ---------------------------------------------------------------------------

pub fn compute_final_score(
    base_score: f64,
    streak: i32,
    streak_bonus_per_day: f64,
    max_streak_bonus: f64,
) -> f64 {
    let streak_multiplier = f64::min(streak as f64 * streak_bonus_per_day, max_streak_bonus);
    f64::min(1.0, base_score * (1.0 + streak_multiplier))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

pub fn compute_scores(input: &ScoringInput) -> ScoringOutput {
    let max_weighted = compute_max_weighted(&input.habit_values, &input.config);
    let positive_score = compute_positive_score(
        &input.habit_values,
        max_weighted,
        input.config.target_fraction,
        &input.config,
    );
    let vice_penalty = compute_vice_penalty(&input.vice_values, input.phone_minutes, &input.config);
    let base_score = compute_base_score(positive_score, vice_penalty);
    let streak = compute_streak(base_score, input.previous_streak, input.config.streak_threshold);
    let final_score = compute_final_score(
        base_score,
        streak,
        input.config.streak_bonus_per_day,
        input.config.max_streak_bonus,
    );

    ScoringOutput {
        positive_score,
        vice_penalty,
        base_score,
        streak,
        final_score,
    }
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------------
    // Test Utilities
    // -----------------------------------------------------------------------

    fn assert_close(actual: f64, expected: f64, label: &str) {
        let diff = (actual - expected).abs();
        assert!(
            diff < 0.001,
            "{}: expected {:.5}, got {:.5} (diff {:.6})",
            label, expected, actual, diff
        );
    }

    // -----------------------------------------------------------------------
    // Test Data Factories
    // -----------------------------------------------------------------------

    fn default_config() -> ScoringConfig {
        ScoringConfig {
            multiplier_productivity: 1.5,
            multiplier_health: 1.3,
            multiplier_growth: 1.0,
            target_fraction: 0.85,
            vice_cap: 0.40,
            streak_threshold: 0.65,
            streak_bonus_per_day: 0.01,
            max_streak_bonus: 0.10,
            phone_t1_min: 61.0,
            phone_t2_min: 181.0,
            phone_t3_min: 301.0,
            phone_t1_penalty: 0.03,
            phone_t2_penalty: 0.07,
            phone_t3_penalty: 0.12,
        }
    }

    fn config_with(overrides: impl FnOnce(&mut ScoringConfig)) -> ScoringConfig {
        let mut c = default_config();
        overrides(&mut c);
        c
    }

    /// 13 seed habits from SCORING_SPEC, all at value=0
    fn seed_habits() -> Vec<HabitValue> {
        vec![
            HabitValue { name: "schoolwork".into(),       value: 0.0, points: 3.0, category: HabitCategory::Productivity },
            HabitValue { name: "personal_project".into(), value: 0.0, points: 3.0, category: HabitCategory::Productivity },
            HabitValue { name: "classes".into(),           value: 0.0, points: 2.0, category: HabitCategory::Productivity },
            HabitValue { name: "job_search".into(),        value: 0.0, points: 2.0, category: HabitCategory::Productivity },
            HabitValue { name: "gym".into(),               value: 0.0, points: 3.0, category: HabitCategory::Health },
            HabitValue { name: "sleep_7_9h".into(),        value: 0.0, points: 2.0, category: HabitCategory::Health },
            HabitValue { name: "wake_8am".into(),          value: 0.0, points: 1.0, category: HabitCategory::Health },
            HabitValue { name: "supplements".into(),       value: 0.0, points: 1.0, category: HabitCategory::Health },
            HabitValue { name: "meal_quality".into(),      value: 0.0, points: 3.0, category: HabitCategory::Health },
            HabitValue { name: "stretching".into(),        value: 0.0, points: 1.0, category: HabitCategory::Health },
            HabitValue { name: "meditate".into(),          value: 0.0, points: 1.0, category: HabitCategory::Growth },
            HabitValue { name: "read".into(),              value: 0.0, points: 1.0, category: HabitCategory::Growth },
            HabitValue { name: "social".into(),            value: 0.0, points: 2.0, category: HabitCategory::Growth },
        ]
    }

    fn all_habits_max() -> Vec<HabitValue> {
        seed_habits().into_iter().map(|mut h| { h.value = h.points; h }).collect()
    }

    fn all_habits_zero() -> Vec<HabitValue> {
        seed_habits()
    }

    fn habits_with(overrides: &[(&str, f64)]) -> Vec<HabitValue> {
        seed_habits().into_iter().map(|mut h| {
            for &(name, val) in overrides {
                if h.name == name {
                    h.value = val;
                }
            }
            h
        }).collect()
    }

    /// 8 seed vices (excluding phone_use which is handled separately), all off
    fn seed_vices() -> Vec<ViceValue> {
        vec![
            ViceValue { name: "porn".into(),           triggered: false, count: Some(0), penalty_value: 0.25, penalty_mode: PenaltyMode::PerInstance },
            ViceValue { name: "masturbate".into(),     triggered: false, count: None,    penalty_value: 0.10, penalty_mode: PenaltyMode::Flat },
            ViceValue { name: "weed".into(),           triggered: false, count: None,    penalty_value: 0.12, penalty_mode: PenaltyMode::Flat },
            ViceValue { name: "skip_class".into(),     triggered: false, count: None,    penalty_value: 0.08, penalty_mode: PenaltyMode::Flat },
            ViceValue { name: "binged_content".into(), triggered: false, count: None,    penalty_value: 0.07, penalty_mode: PenaltyMode::Flat },
            ViceValue { name: "gaming_1h".into(),      triggered: false, count: None,    penalty_value: 0.06, penalty_mode: PenaltyMode::Flat },
            ViceValue { name: "past_12am".into(),      triggered: false, count: None,    penalty_value: 0.05, penalty_mode: PenaltyMode::Flat },
            ViceValue { name: "late_wake".into(),      triggered: false, count: None,    penalty_value: 0.03, penalty_mode: PenaltyMode::Flat },
        ]
    }

    fn all_vices_on() -> Vec<ViceValue> {
        seed_vices().into_iter().map(|mut v| {
            v.triggered = true;
            if v.penalty_mode == PenaltyMode::PerInstance {
                v.count = Some(1);
            }
            v
        }).collect()
    }

    fn vices_with(overrides: &[(&str, bool, Option<u32>)]) -> Vec<ViceValue> {
        seed_vices().into_iter().map(|mut v| {
            for &(name, triggered, count) in overrides {
                if v.name == name {
                    v.triggered = triggered;
                    v.count = count;
                }
            }
            v
        }).collect()
    }

    fn make_input(
        habits: Vec<HabitValue>,
        vices: Vec<ViceValue>,
        phone_minutes: f64,
        previous_streak: i32,
        config: ScoringConfig,
    ) -> ScoringInput {
        ScoringInput {
            habit_values: habits,
            vice_values: vices,
            phone_minutes,
            previous_streak,
            config,
        }
    }

    // -----------------------------------------------------------------------
    // categoryMultiplier
    // -----------------------------------------------------------------------

    #[test]
    fn test_category_multiplier_productivity() {
        let config = default_config();
        assert_eq!(category_multiplier(HabitCategory::Productivity, &config), 1.5);
    }

    #[test]
    fn test_category_multiplier_health() {
        let config = default_config();
        assert_eq!(category_multiplier(HabitCategory::Health, &config), 1.3);
    }

    #[test]
    fn test_category_multiplier_growth() {
        let config = default_config();
        assert_eq!(category_multiplier(HabitCategory::Growth, &config), 1.0);
    }

    // -----------------------------------------------------------------------
    // computeMaxWeighted
    // -----------------------------------------------------------------------

    #[test]
    fn test_max_weighted_all_13_habits() {
        let config = default_config();
        let habits = all_habits_max();
        assert_close(compute_max_weighted(&habits, &config), 33.3, "maxWeighted");
    }

    #[test]
    fn test_max_weighted_empty_habits_ds7() {
        let config = default_config();
        assert_eq!(compute_max_weighted(&[], &config), 0.0);
    }

    // -----------------------------------------------------------------------
    // computePositiveScore
    // -----------------------------------------------------------------------

    #[test]
    fn test_positive_score_all_max() {
        let config = default_config();
        let habits = all_habits_max();
        let mw = compute_max_weighted(&habits, &config);
        assert_close(compute_positive_score(&habits, mw, 0.85, &config), 1.0, "positiveScore all max");
    }

    #[test]
    fn test_positive_score_all_zero() {
        let config = default_config();
        let habits = all_habits_zero();
        let mw = compute_max_weighted(&habits, &config);
        assert_close(compute_positive_score(&habits, mw, 0.85, &config), 0.0, "positiveScore all zero");
    }

    #[test]
    fn test_positive_score_max_weighted_zero_ds7() {
        let config = default_config();
        assert_eq!(compute_positive_score(&[], 0.0, 0.85, &config), 0.0);
    }

    #[test]
    fn test_positive_score_target_fraction_zero() {
        let config = default_config();
        let habits = all_habits_max();
        let mw = compute_max_weighted(&habits, &config);
        assert_eq!(compute_positive_score(&habits, mw, 0.0, &config), 0.0);
    }

    // -----------------------------------------------------------------------
    // computeVicePenalty
    // -----------------------------------------------------------------------

    #[test]
    fn test_vice_penalty_none_triggered() {
        let config = default_config();
        assert_eq!(compute_vice_penalty(&seed_vices(), 0.0, &config), 0.0);
    }

    #[test]
    fn test_vice_penalty_flat() {
        let config = default_config();
        let vices = vices_with(&[("past_12am", true, None)]);
        assert_close(compute_vice_penalty(&vices, 0.0, &config), 0.05, "flat penalty");
    }

    #[test]
    fn test_vice_penalty_per_instance() {
        let config = default_config();
        let vices = vices_with(&[("porn", true, Some(1))]);
        assert_close(compute_vice_penalty(&vices, 0.0, &config), 0.25, "per_instance penalty");
    }

    #[test]
    fn test_vice_penalty_cap() {
        let config = default_config();
        let vices = vices_with(&[("porn", true, Some(2))]);
        // 2 * 0.25 = 0.50, capped at 0.40
        assert_close(compute_vice_penalty(&vices, 0.0, &config), 0.40, "capped penalty");
    }

    #[test]
    fn test_vice_penalty_tiered_skipped() {
        let config = default_config();
        let vices = vec![ViceValue {
            name: "phone_use".into(),
            triggered: true,
            count: None,
            penalty_value: 0.12,
            penalty_mode: PenaltyMode::Tiered,
        }];
        assert_eq!(compute_vice_penalty(&vices, 0.0, &config), 0.0);
    }

    // TV10: Phone tier boundary values
    #[test]
    fn test_phone_tv10a_below_t1() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 60.0, &config), 0.0, "TV10A");
    }

    #[test]
    fn test_phone_tv10b_exactly_t1() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 61.0, &config), 0.03, "TV10B");
    }

    #[test]
    fn test_phone_tv10c_between_t1_t2() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 180.0, &config), 0.03, "TV10C");
    }

    #[test]
    fn test_phone_tv10d_exactly_t2() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 181.0, &config), 0.07, "TV10D");
    }

    #[test]
    fn test_phone_tv10e_exactly_t3() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 301.0, &config), 0.12, "TV10E");
    }

    #[test]
    fn test_phone_tv10f_zero() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 0.0, &config), 0.0, "TV10F");
    }

    #[test]
    fn test_vice_penalty_nan_phone_e4() {
        let config = default_config();
        assert_eq!(compute_vice_penalty(&seed_vices(), f64::NAN, &config), 0.0);
    }

    #[test]
    fn test_vice_penalty_negative_phone_e5() {
        let config = default_config();
        assert_eq!(compute_vice_penalty(&seed_vices(), -100.0, &config), 0.0);
    }

    // -----------------------------------------------------------------------
    // computeBaseScore
    // -----------------------------------------------------------------------

    #[test]
    fn test_base_score_formula() {
        assert_close(compute_base_score(0.8, 0.25), 0.6, "baseScore");
    }

    // -----------------------------------------------------------------------
    // computeStreak
    // -----------------------------------------------------------------------

    #[test]
    fn test_streak_continues() {
        assert_eq!(compute_streak(0.70, 3, 0.65), 4);
    }

    #[test]
    fn test_streak_breaks() {
        assert_eq!(compute_streak(0.60, 5, 0.65), 0);
    }

    #[test]
    fn test_streak_day1() {
        // Day 1 convention: previousStreak = -1 → -1 + 1 = 0
        assert_eq!(compute_streak(1.0, -1, 0.65), 0);
    }

    #[test]
    fn test_streak_gap() {
        // Gap convention: previousStreak = 0 → 0 + 1 = 1
        assert_eq!(compute_streak(0.70, 0, 0.65), 1);
    }

    #[test]
    fn test_streak_at_threshold_e8() {
        // Exactly at threshold -> streak continues (>= check)
        assert_eq!(compute_streak(0.65, 5, 0.65), 6);
    }

    #[test]
    fn test_streak_below_threshold_e9() {
        // Just below threshold -> streak breaks
        assert_eq!(compute_streak(0.6499, 5, 0.65), 0);
    }

    // -----------------------------------------------------------------------
    // computeFinalScore
    // -----------------------------------------------------------------------

    #[test]
    fn test_final_score_no_streak() {
        assert_close(compute_final_score(0.75, 0, 0.01, 0.10), 0.75, "finalScore no streak");
    }

    #[test]
    fn test_final_score_with_streak() {
        // streak=5, bonus=5*0.01=0.05, final=0.75*1.05=0.7875
        assert_close(compute_final_score(0.75, 5, 0.01, 0.10), 0.7875, "finalScore with streak");
    }

    #[test]
    fn test_final_score_streak_bonus_capped() {
        // streak=15, bonus would be 0.15 but capped at 0.10
        assert_close(compute_final_score(0.80, 15, 0.01, 0.10), 0.88, "finalScore bonus capped");
    }

    #[test]
    fn test_final_score_capped_at_1_ds6() {
        // 0.95 * 1.10 = 1.045 → capped at 1.0
        assert_close(compute_final_score(0.95, 10, 0.01, 0.10), 1.0, "finalScore DS6 cap");
    }

    // -----------------------------------------------------------------------
    // Full Pipeline Test Vectors (TV01–TV19)
    // -----------------------------------------------------------------------

    #[test]
    fn test_tv01_perfect_day_day1() {
        let input = make_input(all_habits_max(), seed_vices(), 0.0, -1, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 1.0, "TV01 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV01 vicePenalty");
        assert_close(r.base_score, 1.0, "TV01 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 1.0, "TV01 finalScore");
    }

    #[test]
    fn test_tv02_empty_day() {
        let input = make_input(all_habits_zero(), seed_vices(), 0.0, 3, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.0, "TV02 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV02 vicePenalty");
        assert_close(r.base_score, 0.0, "TV02 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.0, "TV02 finalScore");
    }

    #[test]
    fn test_tv03_vice_heavy() {
        let input = make_input(all_habits_zero(), all_vices_on(), 400.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.0, "TV03 positiveScore");
        assert_close(r.vice_penalty, 0.4, "TV03 vicePenalty");
        assert_close(r.base_score, 0.0, "TV03 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.0, "TV03 finalScore");
    }

    #[test]
    fn test_tv04_good_day_single_relapse() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("wake_8am", 1.0),
            ("meal_quality", 3.0), ("meditate", 1.0), ("read", 1.0),
        ]);
        let vices = vices_with(&[("porn", true, Some(1))]);
        let input = make_input(habits, vices, 0.0, 4, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.80212, "TV04 positiveScore");
        assert_close(r.vice_penalty, 0.25, "TV04 vicePenalty");
        assert_close(r.base_score, 0.60159, "TV04 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.60159, "TV04 finalScore");
    }

    #[test]
    fn test_tv05_streak_building_day2() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0), ("classes", 2.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("supplements", 1.0),
            ("meal_quality", 2.0), ("stretching", 1.0), ("read", 1.0),
        ]);
        let vices = vices_with(&[("past_12am", true, None)]);
        let input = make_input(habits, vices, 0.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.87262, "TV05 positiveScore");
        assert_close(r.vice_penalty, 0.05, "TV05 vicePenalty");
        assert_close(r.base_score, 0.82899, "TV05 baseScore");
        assert_eq!(r.streak, 1);
        assert_close(r.final_score, 0.83728, "TV05 finalScore");
    }

    #[test]
    fn test_tv06_streak_max_bonus() {
        let input = make_input(all_habits_max(), seed_vices(), 0.0, 10, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 1.0, "TV06 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV06 vicePenalty");
        assert_close(r.base_score, 1.0, "TV06 baseScore");
        assert_eq!(r.streak, 11);
        assert_close(r.final_score, 1.0, "TV06 finalScore");
    }

    #[test]
    fn test_tv07_streak_bonus_capped_by_1() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0), ("classes", 2.0), ("job_search", 2.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("wake_8am", 1.0),
            ("meal_quality", 2.0), ("meditate", 1.0), ("read", 1.0),
        ]);
        let input = make_input(habits, seed_vices(), 0.0, 9, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.96804, "TV07 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV07 vicePenalty");
        assert_close(r.base_score, 0.96804, "TV07 baseScore");
        assert_eq!(r.streak, 10);
        // 0.96804 * 1.10 = 1.06484 → capped at 1.0
        assert_close(r.final_score, 1.0, "TV07 finalScore");
    }

    #[test]
    fn test_tv08_streak_bonus_visible() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0),
            ("meal_quality", 2.0), ("read", 1.0),
        ]);
        let input = make_input(habits, seed_vices(), 0.0, 7, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.67494, "TV08 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV08 vicePenalty");
        assert_close(r.base_score, 0.67494, "TV08 baseScore");
        assert_eq!(r.streak, 8);
        assert_close(r.final_score, 0.72893, "TV08 finalScore");
    }

    #[test]
    fn test_tv09_gap_reset() {
        let input = make_input(all_habits_max(), seed_vices(), 0.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 1.0, "TV09 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV09 vicePenalty");
        assert_close(r.base_score, 1.0, "TV09 baseScore");
        assert_eq!(r.streak, 1);
        assert_close(r.final_score, 1.0, "TV09 finalScore");
    }

    #[test]
    fn test_tv12_vices_exactly_at_cap() {
        // porn(0.25) + weed(0.12) + late_wake(0.03) = 0.40
        let vices = vices_with(&[
            ("porn", true, Some(1)),
            ("weed", true, None),
            ("late_wake", true, None),
        ]);
        let input = make_input(all_habits_max(), vices, 0.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.vice_penalty, 0.4, "TV12 vicePenalty");
    }

    #[test]
    fn test_tv13_vices_below_cap() {
        // skip_class(0.08) + binged_content(0.07) + past_12am(0.05) = 0.20
        let vices = vices_with(&[
            ("skip_class", true, None),
            ("binged_content", true, None),
            ("past_12am", true, None),
        ]);
        let input = make_input(all_habits_max(), vices, 0.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.vice_penalty, 0.2, "TV13 vicePenalty");
    }

    #[test]
    fn test_tv14_fractional_dropdown() {
        let habits = habits_with(&[("social", 0.5)]);
        let input = make_input(habits, seed_vices(), 0.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.01766, "TV14 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV14 vicePenalty");
        assert_close(r.base_score, 0.01766, "TV14 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.01766, "TV14 finalScore");
    }

    #[test]
    fn test_tv15a_above_threshold() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0), ("classes", 2.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("wake_8am", 1.0),
            ("meal_quality", 3.0), ("read", 1.0), ("meditate", 1.0),
        ]);
        let vices = vices_with(&[
            ("porn", true, Some(1)),
            ("late_wake", true, None),
        ]);
        let input = make_input(habits, vices, 0.0, 5, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.90797, "TV15A positiveScore");
        assert_close(r.vice_penalty, 0.28, "TV15A vicePenalty");
        assert_close(r.base_score, 0.65374, "TV15A baseScore");
        assert_eq!(r.streak, 6);
        assert_close(r.final_score, 0.69296, "TV15A finalScore");
    }

    #[test]
    fn test_tv15b_below_threshold() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0), ("classes", 2.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("wake_8am", 1.0),
            ("meal_quality", 3.0), ("read", 1.0), ("meditate", 1.0),
        ]);
        let vices = vices_with(&[
            ("porn", true, Some(1)),
            ("late_wake", true, None),
            ("past_12am", true, None),
        ]);
        let input = make_input(habits, vices, 0.0, 5, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.90797, "TV15B positiveScore");
        assert_close(r.vice_penalty, 0.33, "TV15B vicePenalty");
        assert_close(r.base_score, 0.60834, "TV15B baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.60834, "TV15B finalScore");
    }

    #[test]
    fn test_tv16_vice_cap_zero() {
        let habits = habits_with(&[("schoolwork", 3.0), ("personal_project", 3.0)]);
        let vices = vices_with(&[
            ("porn", true, Some(3)),
            ("weed", true, None),
        ]);
        let config = config_with(|c| c.vice_cap = 0.0);
        let input = make_input(habits, vices, 400.0, 0, config);
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.318, "TV16 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV16 vicePenalty");
        assert_close(r.base_score, 0.318, "TV16 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.318, "TV16 finalScore");
    }

    #[test]
    fn test_tv17_target_fraction_1() {
        let config = config_with(|c| c.target_fraction = 1.0);
        let input = make_input(all_habits_max(), seed_vices(), 0.0, 0, config);
        let r = compute_scores(&input);
        assert_close(r.positive_score, 1.0, "TV17 positiveScore");
        assert_close(r.vice_penalty, 0.0, "TV17 vicePenalty");
        assert_close(r.base_score, 1.0, "TV17 baseScore");
        assert_eq!(r.streak, 1);
        assert_close(r.final_score, 1.0, "TV17 finalScore");
    }

    #[test]
    fn test_tv18_realistic_average() {
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("classes", 2.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("supplements", 1.0),
            ("meal_quality", 1.0), ("stretching", 1.0), ("social", 1.0),
        ]);
        let vices = vices_with(&[("past_12am", true, None)]);
        let input = make_input(habits, vices, 120.0, 2, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.66795, "TV18 positiveScore");
        assert_close(r.vice_penalty, 0.08, "TV18 vicePenalty");
        assert_close(r.base_score, 0.61451, "TV18 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.61451, "TV18 finalScore");
    }

    #[test]
    fn test_tv19_everything_wrong() {
        let habits = habits_with(&[("sleep_7_9h", 2.0), ("supplements", 1.0)]);
        let vices = vices_with(&[
            ("porn", true, Some(2)),
            ("weed", true, None),
            ("binged_content", true, None),
            ("gaming_1h", true, None),
            ("past_12am", true, None),
        ]);
        let input = make_input(habits, vices, 350.0, 0, default_config());
        let r = compute_scores(&input);
        assert_close(r.positive_score, 0.1378, "TV19 positiveScore");
        assert_close(r.vice_penalty, 0.4, "TV19 vicePenalty");
        assert_close(r.base_score, 0.08268, "TV19 baseScore");
        assert_eq!(r.streak, 0);
        assert_close(r.final_score, 0.08268, "TV19 finalScore");
    }

    // -----------------------------------------------------------------------
    // TV11: Porn per-instance scaling
    // -----------------------------------------------------------------------

    #[test]
    fn test_tv11a_porn_1() {
        let config = default_config();
        let vices = vices_with(&[("porn", true, Some(1))]);
        assert_close(compute_vice_penalty(&vices, 0.0, &config), 0.25, "TV11A");
    }

    #[test]
    fn test_tv11b_porn_2_capped() {
        let config = default_config();
        let vices = vices_with(&[("porn", true, Some(2))]);
        assert_close(compute_vice_penalty(&vices, 0.0, &config), 0.4, "TV11B");
    }

    #[test]
    fn test_tv11c_porn_0() {
        let config = default_config();
        let vices = vices_with(&[("porn", false, Some(0))]);
        assert_close(compute_vice_penalty(&vices, 0.0, &config), 0.0, "TV11C");
    }

    // -----------------------------------------------------------------------
    // Edge Cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_e4_nan_phone_full_pipeline() {
        let input = make_input(all_habits_max(), seed_vices(), f64::NAN, -1, default_config());
        let r = compute_scores(&input);
        assert_close(r.vice_penalty, 0.0, "E4 vicePenalty");
        assert_close(r.positive_score, 1.0, "E4 positiveScore");
    }

    #[test]
    fn test_e5_negative_phone_full_pipeline() {
        let input = make_input(all_habits_max(), seed_vices(), -500.0, -1, default_config());
        let r = compute_scores(&input);
        assert_close(r.vice_penalty, 0.0, "E5 vicePenalty");
    }

    #[test]
    fn test_e17_all_habits_retired() {
        let vices = vices_with(&[("past_12am", true, None)]);
        let input = make_input(vec![], vices, 0.0, 0, default_config());
        let r = compute_scores(&input);
        assert_eq!(r.positive_score, 0.0);
        assert_eq!(r.base_score, 0.0);
        assert_eq!(r.streak, 0);
        assert_eq!(r.final_score, 0.0);
    }

    #[test]
    fn test_e23_final_score_exceeds_1() {
        // baseScore high + streak=11 → bonus capped, final capped at 1.0
        let habits = habits_with(&[
            ("schoolwork", 3.0), ("personal_project", 3.0), ("classes", 2.0), ("job_search", 2.0),
            ("gym", 3.0), ("sleep_7_9h", 2.0), ("wake_8am", 1.0), ("supplements", 1.0),
            ("meal_quality", 3.0), ("stretching", 1.0), ("meditate", 1.0), ("read", 1.0),
        ]);
        let input = make_input(habits, seed_vices(), 0.0, 10, default_config());
        let r = compute_scores(&input);
        assert_eq!(r.streak, 11);
        assert_close(r.final_score, 1.0, "E23 finalScore");
    }

    #[test]
    fn test_e9_vice_cap_zero_all_vices() {
        let config = config_with(|c| c.vice_cap = 0.0);
        let input = make_input(all_habits_max(), all_vices_on(), 400.0, 0, config);
        let r = compute_scores(&input);
        assert_eq!(r.vice_penalty, 0.0);
        assert_close(r.base_score, 1.0, "E9 baseScore");
    }

    #[test]
    fn test_e10_vice_cap_1_full_penalty() {
        let config = config_with(|c| c.vice_cap = 1.0);
        let input = make_input(all_habits_max(), all_vices_on(), 400.0, 0, config);
        let r = compute_scores(&input);
        // 0.25+0.10+0.12+0.08+0.07+0.06+0.05+0.03+0.12 = 0.88
        assert_close(r.vice_penalty, 0.88, "E10 vicePenalty");
        assert_close(r.base_score, 1.0 * (1.0 - 0.88), "E10 baseScore");
    }

    // -----------------------------------------------------------------------
    // Boundary Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_boundary_phone_60() {
        let config = default_config();
        assert_eq!(compute_vice_penalty(&seed_vices(), 60.0, &config), 0.0);
    }

    #[test]
    fn test_boundary_phone_61() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 61.0, &config), 0.03, "phone 61");
    }

    #[test]
    fn test_boundary_phone_180() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 180.0, &config), 0.03, "phone 180");
    }

    #[test]
    fn test_boundary_phone_181() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 181.0, &config), 0.07, "phone 181");
    }

    #[test]
    fn test_boundary_phone_300() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 300.0, &config), 0.07, "phone 300");
    }

    #[test]
    fn test_boundary_phone_301() {
        let config = default_config();
        assert_close(compute_vice_penalty(&seed_vices(), 301.0, &config), 0.12, "phone 301");
    }

    #[test]
    fn test_boundary_streak_at_threshold() {
        assert_eq!(compute_streak(0.65, 5, 0.65), 6);
    }

    #[test]
    fn test_boundary_streak_below_threshold() {
        assert_eq!(compute_streak(0.649, 5, 0.65), 0);
    }
}
