use chrono::NaiveDate;

use super::scoring::{compute_final_score, compute_streak, ScoringConfig, ScoringOutput};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// One day's update produced by the cascade.
#[derive(Debug, Clone)]
pub struct CascadeUpdate {
    pub date: String,
    pub streak: i32,
    pub final_score: f64,
    /// Present only for the edited day (first element in the returned array).
    pub positive_score: Option<f64>,
    pub vice_penalty: Option<f64>,
    pub base_score: Option<f64>,
}

// ---------------------------------------------------------------------------
// Helper: Previous Calendar Day
// ---------------------------------------------------------------------------

/// Returns the YYYY-MM-DD string for the calendar day before `date_str`.
fn previous_calendar_day(date_str: &str) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date '{}': {}", date_str, e))?;
    let prev = date
        .pred_opt()
        .ok_or_else(|| format!("Cannot compute day before '{}'", date_str))?;
    Ok(prev.format("%Y-%m-%d").to_string())
}

// ---------------------------------------------------------------------------
// Public API: compute_cascade
// ---------------------------------------------------------------------------

/// Compute the forward cascade after an edited day's scores are recomputed.
///
/// The caller is responsible for:
/// 1. Querying the DB for the edited row
/// 2. Building a `ScoringInput` from DB data
/// 3. Calling `compute_scores` for the edited day → `edited_scores`
/// 4. Querying subsequent days from DB (sorted ascending)
/// 5. Calling this function with the results
/// 6. Writing all returned updates within a single transaction
///
/// # Arguments
/// * `edited_date` - The YYYY-MM-DD date that was edited.
/// * `edited_scores` - The fully recomputed `ScoringOutput` for the edited day.
/// * `subsequent_days` - Days after the edited day, sorted ascending by date.
///   Each tuple: `(date, base_score, streak, final_score)` — the STORED values.
/// * `config` - Current scoring config.
///
/// # Returns
/// `Vec<CascadeUpdate>` for every day whose scores changed.
/// First element is the edited day with all 5 scores populated.
/// Subsequent elements carry only `streak` + `final_score`.
/// If nothing changed on subsequent days, returns just the edited day.
pub fn compute_cascade(
    edited_date: &str,
    edited_scores: &ScoringOutput,
    subsequent_days: &[(String, f64, i32, f64)],
    config: &ScoringConfig,
) -> Vec<CascadeUpdate> {
    let mut updates = Vec::new();

    // Always include the edited day as the first update (all 5 scores)
    updates.push(CascadeUpdate {
        date: edited_date.to_string(),
        streak: edited_scores.streak,
        final_score: edited_scores.final_score,
        positive_score: Some(edited_scores.positive_score),
        vice_penalty: Some(edited_scores.vice_penalty),
        base_score: Some(edited_scores.base_score),
    });

    // Forward walk through subsequent days
    let mut last_processed_date = edited_date.to_string();
    let mut last_streak = edited_scores.streak;

    for (date, base_score, stored_streak, stored_final) in subsequent_days {
        // Gap detection: if previous calendar day != last_processed_date, gap resets streak
        let prev_day = match previous_calendar_day(date) {
            Ok(d) => d,
            Err(_) => break,
        };
        let prev_streak = if prev_day == last_processed_date {
            last_streak
        } else {
            0 // gap → reset
        };

        let new_streak = compute_streak(*base_score, prev_streak, config.streak_threshold);
        let new_final = compute_final_score(
            *base_score,
            new_streak,
            config.streak_bonus_per_day,
            config.max_streak_bonus,
        );

        // Convergence check: if recomputed values match stored, stop walking
        if new_streak == *stored_streak && new_final == *stored_final {
            break;
        }

        updates.push(CascadeUpdate {
            date: date.clone(),
            streak: new_streak,
            final_score: new_final,
            positive_score: None,
            vice_penalty: None,
            base_score: None,
        });

        last_processed_date = date.clone();
        last_streak = new_streak;
    }

    updates
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::scoring::ScoringConfig;

    fn assert_close(actual: f64, expected: f64, label: &str) {
        let diff = (actual - expected).abs();
        assert!(
            diff < 0.001,
            "{}: expected {:.5}, got {:.5} (diff {:.6})",
            label, expected, actual, diff
        );
    }

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

    // -----------------------------------------------------------------------
    // Helper: previous_calendar_day
    // -----------------------------------------------------------------------

    #[test]
    fn test_previous_calendar_day_basic() {
        assert_eq!(previous_calendar_day("2026-02-15").unwrap(), "2026-02-14");
    }

    #[test]
    fn test_previous_calendar_day_month_boundary() {
        // 2026 is not a leap year
        assert_eq!(previous_calendar_day("2026-03-01").unwrap(), "2026-02-28");
    }

    #[test]
    fn test_previous_calendar_day_year_boundary() {
        assert_eq!(previous_calendar_day("2026-01-01").unwrap(), "2025-12-31");
    }

    // -----------------------------------------------------------------------
    // TV20: Cascade changes streak chain
    // -----------------------------------------------------------------------

    #[test]
    fn test_tv20_cascade() {
        let config = default_config();

        // Day 3 edited: base_score drops from 0.70 to 0.60 (below threshold 0.65)
        let edited_scores = ScoringOutput {
            positive_score: 0.60,
            vice_penalty: 0.0,
            base_score: 0.60,
            streak: 0, // below threshold → streak breaks
            final_score: 0.60,
        };

        // Subsequent days (stored values before cascade)
        let subsequent = vec![
            ("2026-02-04".into(), 0.72_f64, 3_i32, 0.7416_f64),
            ("2026-02-05".into(), 0.68_f64, 4_i32, 0.7072_f64),
        ];

        let updates = compute_cascade("2026-02-03", &edited_scores, &subsequent, &config);

        assert_eq!(updates.len(), 3);

        // Edited day: all 5 scores
        let day3 = &updates[0];
        assert_eq!(day3.date, "2026-02-03");
        assert_close(day3.positive_score.unwrap(), 0.60, "TV20 day3 positiveScore");
        assert_close(day3.vice_penalty.unwrap(), 0.0, "TV20 day3 vicePenalty");
        assert_close(day3.base_score.unwrap(), 0.60, "TV20 day3 baseScore");
        assert_eq!(day3.streak, 0);
        assert_close(day3.final_score, 0.60, "TV20 day3 finalScore");

        // Day 4: streak restarts from 0 → 1
        let day4 = &updates[1];
        assert_eq!(day4.date, "2026-02-04");
        assert_eq!(day4.streak, 1);
        assert_close(day4.final_score, 0.7272, "TV20 day4 finalScore");
        assert!(day4.positive_score.is_none());

        // Day 5: streak continues 1 → 2
        let day5 = &updates[2];
        assert_eq!(day5.date, "2026-02-05");
        assert_eq!(day5.streak, 2);
        assert_close(day5.final_score, 0.6936, "TV20 day5 finalScore");
    }

    // -----------------------------------------------------------------------
    // Single day — no subsequent days
    // -----------------------------------------------------------------------

    #[test]
    fn test_single_day_no_subsequent() {
        let config = default_config();
        let edited_scores = ScoringOutput {
            positive_score: 0.90,
            vice_penalty: 0.0,
            base_score: 0.90,
            streak: 0,
            final_score: 0.90,
        };

        let updates = compute_cascade("2026-02-01", &edited_scores, &[], &config);

        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].date, "2026-02-01");
        assert_close(updates[0].final_score, 0.90, "single day finalScore");
    }

    // -----------------------------------------------------------------------
    // Immediate convergence
    // -----------------------------------------------------------------------

    #[test]
    fn test_immediate_convergence() {
        let config = default_config();

        // Edited day: streak breaks (base=0.60 < 0.65)
        let edited_scores = ScoringOutput {
            positive_score: 0.60,
            vice_penalty: 0.0,
            base_score: 0.60,
            streak: 0,
            final_score: 0.60,
        };

        // Next day is already below threshold with streak=0
        // base=0.50, stored streak=0, stored final=0.50
        // Recomputed: prev_streak=0 (from edited day), base=0.50 < 0.65 → new_streak=0, new_final=0.50
        // Matches stored → convergence
        let subsequent = vec![("2026-02-03".into(), 0.50_f64, 0_i32, 0.50_f64)];

        let updates = compute_cascade("2026-02-02", &edited_scores, &subsequent, &config);

        // Only edited day (convergence on first subsequent)
        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].date, "2026-02-02");
    }

    // -----------------------------------------------------------------------
    // Long chain — propagates through all subsequent days
    // -----------------------------------------------------------------------

    #[test]
    fn test_long_chain() {
        let config = default_config();

        // Edited day 2: drops from 0.75 to 0.50 (below threshold)
        let edited_scores = ScoringOutput {
            positive_score: 0.50,
            vice_penalty: 0.0,
            base_score: 0.50,
            streak: 0,
            final_score: 0.50,
        };

        let subsequent = vec![
            ("2026-02-03".into(), 0.70_f64, 2_i32, 0.714_f64),
            ("2026-02-04".into(), 0.72_f64, 3_i32, 0.7416_f64),
            ("2026-02-05".into(), 0.68_f64, 4_i32, 0.7072_f64),
            ("2026-02-06".into(), 0.66_f64, 5_i32, 0.693_f64),
        ];

        let updates = compute_cascade("2026-02-02", &edited_scores, &subsequent, &config);

        // Edited day + 4 subsequent = 5 total
        assert_eq!(updates.len(), 5);

        assert_eq!(updates[0].date, "2026-02-02");
        assert_eq!(updates[0].streak, 0);

        // Day 3: streak was 2 → now 1
        assert_eq!(updates[1].date, "2026-02-03");
        assert_eq!(updates[1].streak, 1);
        assert_close(updates[1].final_score, 0.707, "long chain day3");

        // Day 4: streak was 3 → now 2
        assert_eq!(updates[2].date, "2026-02-04");
        assert_eq!(updates[2].streak, 2);
        assert_close(updates[2].final_score, 0.7344, "long chain day4");

        // Day 5: streak was 4 → now 3
        assert_eq!(updates[3].date, "2026-02-05");
        assert_eq!(updates[3].streak, 3);
        assert_close(updates[3].final_score, 0.7004, "long chain day5");

        // Day 6: streak was 5 → now 4
        assert_eq!(updates[4].date, "2026-02-06");
        assert_eq!(updates[4].streak, 4);
        assert_close(updates[4].final_score, 0.6864, "long chain day6");
    }

    // -----------------------------------------------------------------------
    // Gap isolates cascade
    // -----------------------------------------------------------------------

    #[test]
    fn test_gap_isolates() {
        let config = default_config();

        // Edited day 2: drops to 0.50 (below threshold)
        let edited_scores = ScoringOutput {
            positive_score: 0.50,
            vice_penalty: 0.0,
            base_score: 0.50,
            streak: 0,
            final_score: 0.50,
        };

        // Gap: 02-03 and 02-04 missing
        // Day 5 was computed with gap → prev_streak=0 → streak=1 (base=0.70 >= 0.65)
        // Recomputed: gap detected → prev_streak=0 → streak=1, final=0.707
        // Stored: streak=1, final=0.707 → convergence!
        let subsequent = vec![
            ("2026-02-05".into(), 0.70_f64, 1_i32, 0.707_f64),
            ("2026-02-06".into(), 0.68_f64, 2_i32, 0.6936_f64),
        ];

        let updates = compute_cascade("2026-02-02", &edited_scores, &subsequent, &config);

        // Only edited day (gap resets, subsequent converges immediately)
        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].date, "2026-02-02");
    }

    // -----------------------------------------------------------------------
    // Streak breaker stops cascade
    // -----------------------------------------------------------------------

    #[test]
    fn test_streak_breaker_stops() {
        let config = default_config();

        // Edited day 2: drops to 0.50 (below threshold)
        let edited_scores = ScoringOutput {
            positive_score: 0.50,
            vice_penalty: 0.0,
            base_score: 0.50,
            streak: 0,
            final_score: 0.50,
        };

        // Day 3: above threshold, stored streak=2
        // Day 4: below threshold, stored streak=0, stored final=0.40
        // Day 5+: streak resumes
        let subsequent = vec![
            ("2026-02-03".into(), 0.70_f64, 2_i32, 0.714_f64),
            ("2026-02-04".into(), 0.40_f64, 0_i32, 0.40_f64),
            ("2026-02-05".into(), 0.72_f64, 1_i32, 0.7272_f64),
        ];

        let updates = compute_cascade("2026-02-02", &edited_scores, &subsequent, &config);

        // Edited day + day 3 updated; day 4 converges (streak=0 stays 0)
        assert_eq!(updates.len(), 2);

        assert_eq!(updates[0].date, "2026-02-02");
        assert_eq!(updates[0].streak, 0);

        assert_eq!(updates[1].date, "2026-02-03");
        assert_eq!(updates[1].streak, 1);
        assert_close(updates[1].final_score, 0.707, "breaker day3");

        // Day 4 and beyond should NOT appear
        let dates: Vec<&str> = updates.iter().map(|u| u.date.as_str()).collect();
        assert!(!dates.contains(&"2026-02-04"));
        assert!(!dates.contains(&"2026-02-05"));
    }

    // -----------------------------------------------------------------------
    // Streak recovery — edit improves day above threshold
    // -----------------------------------------------------------------------

    #[test]
    fn test_streak_recovery() {
        let config = default_config();

        // Edited day 2: improves from 0.50 to 0.75 (now above threshold)
        // previousStreak from day 1 = 0 → streak = 0+1 = 1
        let edited_scores = ScoringOutput {
            positive_score: 0.75,
            vice_penalty: 0.0,
            base_score: 0.75,
            streak: 1,
            final_score: 0.7575,
        };

        // Subsequent days had lower streaks because day 2 was below threshold
        let subsequent = vec![
            ("2026-02-03".into(), 0.70_f64, 1_i32, 0.707_f64),
            ("2026-02-04".into(), 0.72_f64, 2_i32, 0.7344_f64),
            ("2026-02-05".into(), 0.68_f64, 3_i32, 0.7004_f64),
        ];

        let updates = compute_cascade("2026-02-02", &edited_scores, &subsequent, &config);

        assert_eq!(updates.len(), 4);

        // Edited day
        assert_eq!(updates[0].date, "2026-02-02");
        assert_eq!(updates[0].streak, 1);
        assert_close(updates[0].final_score, 0.7575, "recovery day2");

        // Day 3: streak was 1 → now 2
        assert_eq!(updates[1].date, "2026-02-03");
        assert_eq!(updates[1].streak, 2);
        assert_close(updates[1].final_score, 0.714, "recovery day3");

        // Day 4: streak was 2 → now 3
        assert_eq!(updates[2].date, "2026-02-04");
        assert_eq!(updates[2].streak, 3);
        assert_close(updates[2].final_score, 0.7416, "recovery day4");

        // Day 5: streak was 3 → now 4
        assert_eq!(updates[3].date, "2026-02-05");
        assert_eq!(updates[3].streak, 4);
        assert_close(updates[3].final_score, 0.7072, "recovery day5");
    }

    // -----------------------------------------------------------------------
    // Gap detection via date comparison
    // -----------------------------------------------------------------------

    #[test]
    fn test_gap_detection_dates() {
        let config = default_config();

        // Edited day 1
        let edited_scores = ScoringOutput {
            positive_score: 0.80,
            vice_penalty: 0.0,
            base_score: 0.80,
            streak: 0,
            final_score: 0.80,
        };

        // Day 3 (gap — day 2 missing) and day 4 (consecutive to day 3)
        // Day 3: gap from day 1 → prev_streak=0, base=0.70 >= 0.65 → streak=1
        // Stored streak=1, stored final=0.707 → convergence
        let subsequent = vec![
            ("2026-02-03".into(), 0.70_f64, 1_i32, 0.707_f64),
            ("2026-02-04".into(), 0.68_f64, 2_i32, 0.6936_f64),
        ];

        let updates = compute_cascade("2026-02-01", &edited_scores, &subsequent, &config);

        // Gap detected → day 3 gets prev_streak=0 → streak=1 → matches stored → convergence
        assert_eq!(updates.len(), 1);
        assert_eq!(updates[0].date, "2026-02-01");
    }
}
