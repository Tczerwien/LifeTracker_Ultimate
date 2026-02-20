use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::engine::cascade::compute_cascade;
use crate::engine::scoring::{
    compute_scores, HabitCategory, HabitValue, PenaltyMode, ScoringConfig, ScoringInput,
    ScoringOutput, ViceValue,
};
use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full daily log row returned to the frontend.
/// Field names and types must match the TypeScript `DailyLog` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyLog {
    pub id: i64,
    pub date: String,

    // Productivity
    pub schoolwork: i64,
    pub personal_project: i64,
    pub classes: i64,
    pub job_search: i64,

    // Health
    pub gym: i64,
    pub sleep_7_9h: i64,
    pub wake_8am: i64,
    pub supplements: i64,
    pub meal_quality: String,
    pub stretching: i64,

    // Growth
    pub meditate: i64,
    pub read: i64,
    pub social: String,

    // Vices
    pub porn: i64,
    pub masturbate: i64,
    pub weed: i64,
    pub skip_class: i64,
    pub binged_content: i64,
    pub gaming_1h: i64,
    pub past_12am: i64,
    pub late_wake: i64,
    pub phone_use: i64,

    // Computed scores (nullable — None when not yet scored)
    pub positive_score: Option<f64>,
    pub vice_penalty: Option<f64>,
    pub base_score: Option<f64>,
    pub streak: Option<i32>,
    pub final_score: Option<f64>,

    // Timestamps
    pub logged_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving a daily log entry.
/// Contains only user-editable fields — no id, scores, or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyLogInput {
    pub date: String,

    // Productivity
    pub schoolwork: i64,
    pub personal_project: i64,
    pub classes: i64,
    pub job_search: i64,

    // Health
    pub gym: i64,
    pub sleep_7_9h: i64,
    pub wake_8am: i64,
    pub supplements: i64,
    pub meal_quality: String,
    pub stretching: i64,

    // Growth
    pub meditate: i64,
    pub read: i64,
    pub social: String,

    // Vices
    pub porn: i64,
    pub masturbate: i64,
    pub weed: i64,
    pub skip_class: i64,
    pub binged_content: i64,
    pub gaming_1h: i64,
    pub past_12am: i64,
    pub late_wake: i64,
    pub phone_use: i64,
}

/// Internal representation of a habit_config row needed for scoring input construction.
pub(crate) struct HabitConfigRow {
    name: String,
    pool: String,
    category: Option<String>,
    input_type: String,
    points: f64,
    penalty: f64,
    penalty_mode: String,
    options_json: Option<String>,
    column_name: String,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Column list used in all daily_log SELECT queries.
/// Order must match positional indices in `row_to_daily_log`.
pub const DAILY_LOG_COLUMNS: &str = "\
    id, date, \
    schoolwork, personal_project, classes, job_search, \
    gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
    meditate, \"read\", social, \
    porn, masturbate, weed, skip_class, binged_content, gaming_1h, past_12am, late_wake, phone_use, \
    positive_score, vice_penalty, base_score, streak, final_score, \
    logged_at, last_modified";

// ---------------------------------------------------------------------------
// Row Mapper
// ---------------------------------------------------------------------------

/// Maps a rusqlite Row to a DailyLog struct using positional indices.
/// Column order must match `DAILY_LOG_COLUMNS`.
pub fn row_to_daily_log(row: &rusqlite::Row) -> rusqlite::Result<DailyLog> {
    Ok(DailyLog {
        id: row.get(0)?,
        date: row.get(1)?,
        schoolwork: row.get(2)?,
        personal_project: row.get(3)?,
        classes: row.get(4)?,
        job_search: row.get(5)?,
        gym: row.get(6)?,
        sleep_7_9h: row.get(7)?,
        wake_8am: row.get(8)?,
        supplements: row.get(9)?,
        meal_quality: row.get(10)?,
        stretching: row.get(11)?,
        meditate: row.get(12)?,
        read: row.get(13)?,
        social: row.get(14)?,
        porn: row.get(15)?,
        masturbate: row.get(16)?,
        weed: row.get(17)?,
        skip_class: row.get(18)?,
        binged_content: row.get(19)?,
        gaming_1h: row.get(20)?,
        past_12am: row.get(21)?,
        late_wake: row.get(22)?,
        phone_use: row.get(23)?,
        positive_score: row.get(24)?,
        vice_penalty: row.get(25)?,
        base_score: row.get(26)?,
        streak: row.get(27)?,
        final_score: row.get(28)?,
        logged_at: row.get(29)?,
        last_modified: row.get(30)?,
    })
}

// ---------------------------------------------------------------------------
// Column Value Extraction (match dispatchers)
// ---------------------------------------------------------------------------

/// Extracts the integer value of a habit/vice column from a DailyLogInput by column_name.
fn get_column_value_i64(entry: &DailyLogInput, column_name: &str) -> i64 {
    match column_name {
        "schoolwork" => entry.schoolwork,
        "personal_project" => entry.personal_project,
        "classes" => entry.classes,
        "job_search" => entry.job_search,
        "gym" => entry.gym,
        "sleep_7_9h" => entry.sleep_7_9h,
        "wake_8am" => entry.wake_8am,
        "supplements" => entry.supplements,
        "stretching" => entry.stretching,
        "meditate" => entry.meditate,
        "read" => entry.read,
        "porn" => entry.porn,
        "masturbate" => entry.masturbate,
        "weed" => entry.weed,
        "skip_class" => entry.skip_class,
        "binged_content" => entry.binged_content,
        "gaming_1h" => entry.gaming_1h,
        "past_12am" => entry.past_12am,
        "late_wake" => entry.late_wake,
        "phone_use" => entry.phone_use,
        _ => 0,
    }
}

/// Extracts the string value of a dropdown habit column from a DailyLogInput by column_name.
fn get_column_value_string(entry: &DailyLogInput, column_name: &str) -> String {
    match column_name {
        "meal_quality" => entry.meal_quality.clone(),
        "social" => entry.social.clone(),
        _ => "None".to_string(),
    }
}

// ---------------------------------------------------------------------------
// Dropdown Resolution
// ---------------------------------------------------------------------------

/// Resolves a dropdown text key to its numeric value using the options_json mapping.
///
/// Example: options_json = `{"Poor":0,"Good":2,"Great":3}`, text_key = "Great" → 3.0
fn resolve_dropdown_value(text_key: &str, options_json: &Option<String>) -> f64 {
    let json_str = match options_json {
        Some(s) => s,
        None => return 0.0,
    };
    let parsed: serde_json::Value = match serde_json::from_str(json_str) {
        Ok(v) => v,
        Err(_) => return 0.0,
    };
    match parsed.get(text_key) {
        Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        _ => 0.0,
    }
}

// ---------------------------------------------------------------------------
// Category Parsing
// ---------------------------------------------------------------------------

/// Maps a DB category string to the Rust HabitCategory enum.
fn parse_category(s: &str) -> HabitCategory {
    match s {
        "Productivity" => HabitCategory::Productivity,
        "Health" => HabitCategory::Health,
        _ => HabitCategory::Growth,
    }
}

// ---------------------------------------------------------------------------
// DB Loaders
// ---------------------------------------------------------------------------

/// Loads the scoring configuration from the app_config singleton row.
pub(crate) fn load_scoring_config(conn: &Connection) -> CommandResult<ScoringConfig> {
    conn.query_row(
        "SELECT multiplier_productivity, multiplier_health, multiplier_growth, \
         target_fraction, vice_cap, streak_threshold, \
         streak_bonus_per_day, max_streak_bonus, \
         phone_t1_min, phone_t2_min, phone_t3_min, \
         phone_t1_penalty, phone_t2_penalty, phone_t3_penalty \
         FROM app_config WHERE id = 'default'",
        [],
        |row| {
            Ok(ScoringConfig {
                multiplier_productivity: row.get(0)?,
                multiplier_health: row.get(1)?,
                multiplier_growth: row.get(2)?,
                target_fraction: row.get(3)?,
                vice_cap: row.get(4)?,
                streak_threshold: row.get(5)?,
                streak_bonus_per_day: row.get(6)?,
                max_streak_bonus: row.get(7)?,
                // phone_t*_min are INTEGER in DB but f64 in ScoringConfig
                phone_t1_min: row.get::<_, i64>(8)? as f64,
                phone_t2_min: row.get::<_, i64>(9)? as f64,
                phone_t3_min: row.get::<_, i64>(10)? as f64,
                phone_t1_penalty: row.get(11)?,
                phone_t2_penalty: row.get(12)?,
                phone_t3_penalty: row.get(13)?,
            })
        },
    )
    .map_err(CommandError::from)
}

/// Loads all active habit configuration rows.
pub(crate) fn load_active_habit_configs(conn: &Connection) -> CommandResult<Vec<HabitConfigRow>> {
    let mut stmt = conn.prepare(
        "SELECT name, pool, category, input_type, points, penalty, \
         penalty_mode, options_json, column_name \
         FROM habit_config WHERE is_active = 1 \
         ORDER BY pool, sort_order",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(HabitConfigRow {
            name: row.get(0)?,
            pool: row.get(1)?,
            category: row.get(2)?,
            input_type: row.get(3)?,
            points: row.get(4)?,
            penalty: row.get(5)?,
            penalty_mode: row.get(6)?,
            options_json: row.get(7)?,
            column_name: row.get(8)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

/// Loads subsequent scored daily_log rows after the given date for cascade input.
fn load_subsequent_days(
    conn: &Connection,
    date: &str,
) -> CommandResult<Vec<(String, f64, i32, f64)>> {
    let mut stmt = conn.prepare(
        "SELECT date, base_score, streak, final_score \
         FROM daily_log \
         WHERE date > ?1 \
           AND base_score IS NOT NULL \
           AND streak IS NOT NULL \
           AND final_score IS NOT NULL \
         ORDER BY date ASC",
    )?;

    let rows = stmt.query_map([date], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, f64>(1)?,
            row.get::<_, i32>(2)?,
            row.get::<_, f64>(3)?,
        ))
    })?;

    rows.collect::<Result<Vec<_>, _>>().map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Scoring Input Builders
// ---------------------------------------------------------------------------

/// Builds HabitValue entries for all active good habits.
pub(crate) fn build_habit_values(entry: &DailyLogInput, configs: &[HabitConfigRow]) -> Vec<HabitValue> {
    configs
        .iter()
        .filter(|c| c.pool == "good")
        .map(|c| {
            let category = parse_category(c.category.as_deref().unwrap_or("Growth"));
            let value = match c.input_type.as_str() {
                "checkbox" => {
                    let raw = get_column_value_i64(entry, &c.column_name);
                    if raw >= 1 {
                        c.points
                    } else {
                        0.0
                    }
                }
                "dropdown" => {
                    let text_key = get_column_value_string(entry, &c.column_name);
                    resolve_dropdown_value(&text_key, &c.options_json)
                }
                _ => 0.0,
            };

            HabitValue {
                name: c.name.clone(),
                value,
                points: c.points,
                category,
            }
        })
        .collect()
}

/// Builds ViceValue entries for all active vices.
pub(crate) fn build_vice_values(entry: &DailyLogInput, configs: &[HabitConfigRow]) -> Vec<ViceValue> {
    configs
        .iter()
        .filter(|c| c.pool == "vice")
        .map(|c| {
            let raw = get_column_value_i64(entry, &c.column_name);
            match c.penalty_mode.as_str() {
                "flat" => ViceValue {
                    name: c.name.clone(),
                    triggered: raw >= 1,
                    count: None,
                    penalty_value: c.penalty,
                    penalty_mode: PenaltyMode::Flat,
                },
                "per_instance" => ViceValue {
                    name: c.name.clone(),
                    triggered: raw > 0,
                    count: Some(raw as u32),
                    penalty_value: c.penalty,
                    penalty_mode: PenaltyMode::PerInstance,
                },
                "tiered" => ViceValue {
                    name: c.name.clone(),
                    triggered: false,
                    count: None,
                    penalty_value: 0.0,
                    penalty_mode: PenaltyMode::Tiered,
                },
                _ => ViceValue {
                    name: c.name.clone(),
                    triggered: false,
                    count: None,
                    penalty_value: 0.0,
                    penalty_mode: PenaltyMode::Flat,
                },
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Previous Streak Determination
// ---------------------------------------------------------------------------

/// Determines the previous_streak value for scoring.
///
/// - Day 1 (no earlier rows): returns -1 (convention: -1 + 1 = streak 0)
/// - Gap (earlier rows exist but no row for previous calendar day): returns 0
/// - Consecutive (previous day has a streak value): returns that streak
/// - Previous day exists but streak is NULL: returns 0
fn determine_previous_streak(conn: &Connection, date: &str) -> CommandResult<i32> {
    let count_before: i64 = conn.query_row(
        "SELECT COUNT(*) FROM daily_log WHERE date < ?1",
        [date],
        |row| row.get(0),
    )?;

    if count_before == 0 {
        return Ok(-1); // Day 1 convention
    }

    // Try to get previous calendar day's streak
    let prev_streak: Option<Option<i32>> = conn
        .query_row(
            "SELECT streak FROM daily_log WHERE date = date(?1, '-1 day')",
            [date],
            |row| row.get::<_, Option<i32>>(0),
        )
        .optional()?;

    // None = no row for previous day (gap) → 0
    // Some(None) = row exists but streak is NULL → 0
    // Some(Some(val)) = row exists with streak value → val
    Ok(prev_streak.flatten().unwrap_or(0))
}

// ---------------------------------------------------------------------------
// Reusable SELECT Helper
// ---------------------------------------------------------------------------

/// Queries a single daily_log row by date.
fn query_daily_log_by_date(conn: &Connection, date: &str) -> CommandResult<Option<DailyLog>> {
    let sql = format!(
        "SELECT {} FROM daily_log WHERE date = ?1",
        DAILY_LOG_COLUMNS
    );
    conn.query_row(&sql, [date], row_to_daily_log)
        .optional()
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

/// Fetch a single day's daily log entry with all computed scores.
/// Returns None if no entry exists for the given date.
#[tauri::command]
pub fn get_daily_log(
    state: tauri::State<'_, AppState>,
    date: String,
) -> CommandResult<Option<DailyLog>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_daily_log_by_date(&db, &date)
}

/// Fetch daily log entries for a date range, ordered by date ascending.
#[tauri::command]
pub fn get_daily_logs(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<DailyLog>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    let sql = format!(
        "SELECT {} FROM daily_log WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
        DAILY_LOG_COLUMNS
    );
    let mut stmt = db.prepare(&sql)?;
    let rows = stmt.query_map(params![start, end], row_to_daily_log)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

/// Returns the streak value for a given date. Returns 0 if no entry or streak is NULL.
#[tauri::command]
pub fn get_streak_at_date(
    state: tauri::State<'_, AppState>,
    date: String,
) -> CommandResult<i32> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    let streak: i32 = db
        .query_row(
            "SELECT COALESCE(streak, 0) FROM daily_log WHERE date = ?1",
            [&date],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(0);
    Ok(streak)
}

/// Save a daily log entry: compute scores, upsert the row, and run the cascade.
///
/// This is the most complex command. The full algorithm runs within a single
/// SQLite transaction (ADR-002 SD2, ADR-005 SD2):
///
/// 1. Check if a row already exists for this date
/// 2. Load active habit configs and scoring config from DB
/// 3. Build ScoringInput from the entry data + configs
/// 4. Compute scores via the Rust scoring engine
/// 5. INSERT or UPDATE the daily_log row with habit values + computed scores
/// 6. Run cascade if subsequent scored days exist
/// 7. Commit and return the saved row
#[tauri::command]
pub fn save_daily_log(
    state: tauri::State<'_, AppState>,
    entry: DailyLogInput,
) -> CommandResult<DailyLog> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;

    // Run the entire save + cascade within a single transaction
    {
        let tx = db.unchecked_transaction().map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        // Step 1: Check if row already exists (for logged_at preservation + cascade decision)
        let existing: Option<(i64, String)> = tx
            .query_row(
                "SELECT id, logged_at FROM daily_log WHERE date = ?1",
                [&entry.date],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        // Step 2: Determine timestamps
        let now = chrono::Utc::now().to_rfc3339();
        let logged_at = match &existing {
            Some((_, original_logged_at)) => original_logged_at.clone(),
            None => now.clone(),
        };

        // Step 3: Load configs
        let habit_configs = load_active_habit_configs(&tx)?;
        let scoring_config = load_scoring_config(&tx)?;

        // Step 4: Build ScoringInput
        let habit_values = build_habit_values(&entry, &habit_configs);
        let vice_values = build_vice_values(&entry, &habit_configs);
        let previous_streak = determine_previous_streak(&tx, &entry.date)?;

        let scoring_input = ScoringInput {
            habit_values,
            vice_values,
            phone_minutes: entry.phone_use as f64,
            previous_streak,
            config: scoring_config.clone(),
        };

        // Step 5: Compute scores
        let scores: ScoringOutput = compute_scores(&scoring_input);

        // Step 6: INSERT or UPDATE
        if existing.is_some() {
            // UPDATE — preserve logged_at
            tx.execute(
                "UPDATE daily_log SET \
                 schoolwork = ?2, personal_project = ?3, classes = ?4, job_search = ?5, \
                 gym = ?6, sleep_7_9h = ?7, wake_8am = ?8, supplements = ?9, \
                 meal_quality = ?10, stretching = ?11, \
                 meditate = ?12, \"read\" = ?13, social = ?14, \
                 porn = ?15, masturbate = ?16, weed = ?17, skip_class = ?18, \
                 binged_content = ?19, gaming_1h = ?20, past_12am = ?21, \
                 late_wake = ?22, phone_use = ?23, \
                 positive_score = ?24, vice_penalty = ?25, base_score = ?26, \
                 streak = ?27, final_score = ?28, \
                 last_modified = ?29 \
                 WHERE date = ?1",
                params![
                    entry.date,
                    entry.schoolwork,
                    entry.personal_project,
                    entry.classes,
                    entry.job_search,
                    entry.gym,
                    entry.sleep_7_9h,
                    entry.wake_8am,
                    entry.supplements,
                    entry.meal_quality,
                    entry.stretching,
                    entry.meditate,
                    entry.read,
                    entry.social,
                    entry.porn,
                    entry.masturbate,
                    entry.weed,
                    entry.skip_class,
                    entry.binged_content,
                    entry.gaming_1h,
                    entry.past_12am,
                    entry.late_wake,
                    entry.phone_use,
                    scores.positive_score,
                    scores.vice_penalty,
                    scores.base_score,
                    scores.streak,
                    scores.final_score,
                    &now,
                ],
            )?;
        } else {
            // INSERT — new row
            tx.execute(
                "INSERT INTO daily_log (\
                 date, \
                 schoolwork, personal_project, classes, job_search, \
                 gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
                 meditate, \"read\", social, \
                 porn, masturbate, weed, skip_class, binged_content, gaming_1h, \
                 past_12am, late_wake, phone_use, \
                 positive_score, vice_penalty, base_score, streak, final_score, \
                 logged_at, last_modified\
                 ) VALUES (\
                 ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, \
                 ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, \
                 ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30\
                 )",
                params![
                    entry.date,
                    entry.schoolwork,
                    entry.personal_project,
                    entry.classes,
                    entry.job_search,
                    entry.gym,
                    entry.sleep_7_9h,
                    entry.wake_8am,
                    entry.supplements,
                    entry.meal_quality,
                    entry.stretching,
                    entry.meditate,
                    entry.read,
                    entry.social,
                    entry.porn,
                    entry.masturbate,
                    entry.weed,
                    entry.skip_class,
                    entry.binged_content,
                    entry.gaming_1h,
                    entry.past_12am,
                    entry.late_wake,
                    entry.phone_use,
                    scores.positive_score,
                    scores.vice_penalty,
                    scores.base_score,
                    scores.streak,
                    scores.final_score,
                    logged_at,
                    &now,
                ],
            )?;
        }

        // Step 7: Run cascade if subsequent scored days exist
        let subsequent_days = load_subsequent_days(&tx, &entry.date)?;
        if !subsequent_days.is_empty() {
            let cascade_updates =
                compute_cascade(&entry.date, &scores, &subsequent_days, &scoring_config);

            // Skip first element — that's the edited day, already written above
            for update in cascade_updates.iter().skip(1) {
                tx.execute(
                    "UPDATE daily_log SET streak = ?2, final_score = ?3, last_modified = ?4 \
                     WHERE date = ?1",
                    params![update.date, update.streak, update.final_score, &now],
                )?;
            }
        }

        // Step 8: Commit
        tx.commit()?;
    }

    // Step 9: Read back and return the saved row
    query_daily_log_by_date(&db, &entry.date)?
        .ok_or_else(|| CommandError::from("Failed to read back saved daily log"))
}

// ===========================================================================
// Tests
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    // -----------------------------------------------------------------------
    // Test Helpers
    // -----------------------------------------------------------------------

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        run_migrations(&mut conn).expect("Migration should succeed");
        conn
    }

    fn make_default_input(date: &str) -> DailyLogInput {
        DailyLogInput {
            date: date.to_string(),
            schoolwork: 0,
            personal_project: 0,
            classes: 0,
            job_search: 0,
            gym: 0,
            sleep_7_9h: 0,
            wake_8am: 0,
            supplements: 0,
            meal_quality: "None".to_string(),
            stretching: 0,
            meditate: 0,
            read: 0,
            social: "None".to_string(),
            porn: 0,
            masturbate: 0,
            weed: 0,
            skip_class: 0,
            binged_content: 0,
            gaming_1h: 0,
            past_12am: 0,
            late_wake: 0,
            phone_use: 0,
        }
    }

    fn make_perfect_day_input(date: &str) -> DailyLogInput {
        DailyLogInput {
            date: date.to_string(),
            schoolwork: 1,
            personal_project: 1,
            classes: 1,
            job_search: 1,
            gym: 1,
            sleep_7_9h: 1,
            wake_8am: 1,
            supplements: 1,
            meal_quality: "Great".to_string(),
            stretching: 1,
            meditate: 1,
            read: 1,
            social: "Meaningful Connection".to_string(),
            porn: 0,
            masturbate: 0,
            weed: 0,
            skip_class: 0,
            binged_content: 0,
            gaming_1h: 0,
            past_12am: 0,
            late_wake: 0,
            phone_use: 0,
        }
    }

    /// Tolerance for floating-point score comparisons.
    fn assert_close(actual: f64, expected: f64, label: &str) {
        let diff = (actual - expected).abs();
        assert!(
            diff < 0.001,
            "{}: expected {:.6}, got {:.6} (diff {:.6})",
            label,
            expected,
            actual,
            diff
        );
    }

    /// Insert a raw daily_log row with all defaults + computed scores for testing.
    fn insert_scored_row(
        conn: &Connection,
        date: &str,
        base_score: f64,
        streak: i32,
        final_score: f64,
    ) {
        conn.execute(
            "INSERT INTO daily_log (\
             date, schoolwork, personal_project, classes, job_search, \
             gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
             meditate, \"read\", social, \
             porn, masturbate, weed, skip_class, binged_content, gaming_1h, \
             past_12am, late_wake, phone_use, \
             positive_score, vice_penalty, base_score, streak, final_score, \
             logged_at, last_modified\
             ) VALUES (\
             ?1, 0, 0, 0, 0, 0, 0, 0, 0, 'None', 0, 0, 0, 'None', \
             0, 0, 0, 0, 0, 0, 0, 0, 0, \
             0.0, 0.0, ?2, ?3, ?4, \
             '2026-01-20T00:00:00Z', '2026-01-20T00:00:00Z'\
             )",
            params![date, base_score, streak, final_score],
        )
        .unwrap();
    }

    // -----------------------------------------------------------------------
    // Row Mapper Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_row_mapper_round_trip() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO daily_log (\
             date, schoolwork, personal_project, classes, job_search, \
             gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
             meditate, \"read\", social, \
             porn, masturbate, weed, skip_class, binged_content, gaming_1h, \
             past_12am, late_wake, phone_use, \
             positive_score, vice_penalty, base_score, streak, final_score, \
             logged_at, last_modified\
             ) VALUES (\
             '2026-02-01', 1, 0, 1, 0, 1, 1, 0, 0, 'Good', 0, \
             1, 0, 'Brief/Text', \
             0, 0, 0, 0, 0, 0, 0, 0, 45, \
             0.75, 0.05, 0.7125, 3, 0.734, \
             '2026-02-01T10:00:00Z', '2026-02-01T10:00:00Z'\
             )",
            [],
        )
        .unwrap();

        let result = query_daily_log_by_date(&conn, "2026-02-01").unwrap();
        assert!(result.is_some());
        let log = result.unwrap();
        assert_eq!(log.date, "2026-02-01");
        assert_eq!(log.schoolwork, 1);
        assert_eq!(log.personal_project, 0);
        assert_eq!(log.classes, 1);
        assert_eq!(log.gym, 1);
        assert_eq!(log.meal_quality, "Good");
        assert_eq!(log.social, "Brief/Text");
        assert_eq!(log.phone_use, 45);
        assert_close(log.positive_score.unwrap(), 0.75, "positive_score");
        assert_close(log.vice_penalty.unwrap(), 0.05, "vice_penalty");
        assert_eq!(log.streak, Some(3));
    }

    #[test]
    fn test_row_mapper_nullable_scores() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO daily_log (\
             date, schoolwork, personal_project, classes, job_search, \
             gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
             meditate, \"read\", social, \
             porn, masturbate, weed, skip_class, binged_content, gaming_1h, \
             past_12am, late_wake, phone_use, \
             logged_at, last_modified\
             ) VALUES (\
             '2026-02-02', 0, 0, 0, 0, 0, 0, 0, 0, 'None', 0, \
             0, 0, 'None', \
             0, 0, 0, 0, 0, 0, 0, 0, 0, \
             '2026-02-02T10:00:00Z', '2026-02-02T10:00:00Z'\
             )",
            [],
        )
        .unwrap();

        let log = query_daily_log_by_date(&conn, "2026-02-02").unwrap().unwrap();
        assert!(log.positive_score.is_none());
        assert!(log.vice_penalty.is_none());
        assert!(log.base_score.is_none());
        assert!(log.streak.is_none());
        assert!(log.final_score.is_none());
    }

    // -----------------------------------------------------------------------
    // get_daily_log Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_daily_log_not_found() {
        let conn = setup_test_db();
        let result = query_daily_log_by_date(&conn, "2099-01-01").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_daily_log_found() {
        let conn = setup_test_db();
        insert_scored_row(&conn, "2026-02-10", 0.8, 5, 0.84);
        let log = query_daily_log_by_date(&conn, "2026-02-10").unwrap().unwrap();
        assert_eq!(log.date, "2026-02-10");
        assert_close(log.base_score.unwrap(), 0.8, "base_score");
        assert_eq!(log.streak, Some(5));
    }

    // -----------------------------------------------------------------------
    // get_daily_logs Tests (range)
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_daily_logs_empty_range() {
        let conn = setup_test_db();
        let sql = format!(
            "SELECT {} FROM daily_log WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
            DAILY_LOG_COLUMNS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        let rows: Vec<DailyLog> = stmt
            .query_map(params!["2099-01-01", "2099-12-31"], row_to_daily_log)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn test_get_daily_logs_ordered() {
        let conn = setup_test_db();
        insert_scored_row(&conn, "2026-02-12", 0.5, 0, 0.5);
        insert_scored_row(&conn, "2026-02-10", 0.7, 1, 0.71);
        insert_scored_row(&conn, "2026-02-11", 0.6, 0, 0.6);

        let sql = format!(
            "SELECT {} FROM daily_log WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
            DAILY_LOG_COLUMNS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        let rows: Vec<DailyLog> = stmt
            .query_map(params!["2026-02-10", "2026-02-12"], row_to_daily_log)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].date, "2026-02-10");
        assert_eq!(rows[1].date, "2026-02-11");
        assert_eq!(rows[2].date, "2026-02-12");
    }

    #[test]
    fn test_get_daily_logs_boundary_filtering() {
        let conn = setup_test_db();
        insert_scored_row(&conn, "2026-02-09", 0.5, 0, 0.5);
        insert_scored_row(&conn, "2026-02-10", 0.6, 0, 0.6);
        insert_scored_row(&conn, "2026-02-11", 0.7, 0, 0.7);
        insert_scored_row(&conn, "2026-02-12", 0.8, 0, 0.8);

        let sql = format!(
            "SELECT {} FROM daily_log WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
            DAILY_LOG_COLUMNS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        let rows: Vec<DailyLog> = stmt
            .query_map(params!["2026-02-10", "2026-02-11"], row_to_daily_log)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].date, "2026-02-10");
        assert_eq!(rows[1].date, "2026-02-11");
    }

    // -----------------------------------------------------------------------
    // get_streak_at_date Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_streak_missing_date() {
        let conn = setup_test_db();
        let streak: i32 = conn
            .query_row(
                "SELECT COALESCE(streak, 0) FROM daily_log WHERE date = ?1",
                ["2099-01-01"],
                |row| row.get(0),
            )
            .optional()
            .unwrap()
            .unwrap_or(0);
        assert_eq!(streak, 0);
    }

    #[test]
    fn test_streak_null_value() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO daily_log (\
             date, logged_at, last_modified\
             ) VALUES ('2026-02-15', '2026-02-15T10:00:00Z', '2026-02-15T10:00:00Z')",
            [],
        )
        .unwrap();
        let streak: i32 = conn
            .query_row(
                "SELECT COALESCE(streak, 0) FROM daily_log WHERE date = ?1",
                ["2026-02-15"],
                |row| row.get(0),
            )
            .optional()
            .unwrap()
            .unwrap_or(0);
        assert_eq!(streak, 0);
    }

    #[test]
    fn test_streak_with_value() {
        let conn = setup_test_db();
        insert_scored_row(&conn, "2026-02-15", 0.8, 7, 0.87);
        let streak: i32 = conn
            .query_row(
                "SELECT COALESCE(streak, 0) FROM daily_log WHERE date = ?1",
                ["2026-02-15"],
                |row| row.get(0),
            )
            .optional()
            .unwrap()
            .unwrap_or(0);
        assert_eq!(streak, 7);
    }

    // -----------------------------------------------------------------------
    // Dropdown Resolution Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_resolve_dropdown_meal_quality() {
        let options = Some(r#"{"Poor":0,"Okay":1,"Good":2,"Great":3}"#.to_string());
        assert_close(resolve_dropdown_value("Great", &options), 3.0, "Great");
        assert_close(resolve_dropdown_value("Good", &options), 2.0, "Good");
        assert_close(resolve_dropdown_value("None", &options), 0.0, "None (missing key)");
        assert_close(resolve_dropdown_value("Poor", &options), 0.0, "Poor");
    }

    #[test]
    fn test_resolve_dropdown_social() {
        let options =
            Some(r#"{"None":0,"Brief/Text":0.5,"Casual Hangout":1,"Meaningful Connection":2}"#.to_string());
        assert_close(resolve_dropdown_value("Meaningful Connection", &options), 2.0, "Meaningful Connection");
        assert_close(resolve_dropdown_value("Brief/Text", &options), 0.5, "Brief/Text");
        assert_close(resolve_dropdown_value("None", &options), 0.0, "None");
        assert_close(resolve_dropdown_value("Casual Hangout", &options), 1.0, "Casual Hangout");
    }

    #[test]
    fn test_resolve_dropdown_none_json() {
        assert_close(resolve_dropdown_value("Great", &None), 0.0, "None options_json");
    }

    // -----------------------------------------------------------------------
    // Scoring Input Builder Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_build_habit_values_checkbox() {
        let conn = setup_test_db();
        let configs = load_active_habit_configs(&conn).unwrap();

        let mut input = make_default_input("2026-02-01");
        input.schoolwork = 1;
        input.gym = 1;

        let habits = build_habit_values(&input, &configs);

        let schoolwork = habits.iter().find(|h| h.name == "schoolwork").unwrap();
        assert_close(schoolwork.value, 3.0, "schoolwork value (checked)");
        assert_close(schoolwork.points, 3.0, "schoolwork points");

        let classes = habits.iter().find(|h| h.name == "classes").unwrap();
        assert_close(classes.value, 0.0, "classes value (unchecked)");
        assert_close(classes.points, 2.0, "classes points");

        let gym = habits.iter().find(|h| h.name == "gym").unwrap();
        assert_close(gym.value, 3.0, "gym value (checked)");
    }

    #[test]
    fn test_build_habit_values_dropdown() {
        let conn = setup_test_db();
        let configs = load_active_habit_configs(&conn).unwrap();

        let mut input = make_default_input("2026-02-01");
        input.meal_quality = "Great".to_string();
        input.social = "Brief/Text".to_string();

        let habits = build_habit_values(&input, &configs);

        let meal = habits.iter().find(|h| h.name == "meal_quality").unwrap();
        assert_close(meal.value, 3.0, "meal_quality Great");
        assert_close(meal.points, 3.0, "meal_quality points");

        let social = habits.iter().find(|h| h.name == "social").unwrap();
        assert_close(social.value, 0.5, "social Brief/Text");
        assert_close(social.points, 2.0, "social points");
    }

    #[test]
    fn test_build_vice_values_flat() {
        let conn = setup_test_db();
        let configs = load_active_habit_configs(&conn).unwrap();

        let mut input = make_default_input("2026-02-01");
        input.masturbate = 1;
        input.weed = 0;

        let vices = build_vice_values(&input, &configs);

        let mast = vices.iter().find(|v| v.name == "masturbate").unwrap();
        assert!(mast.triggered);
        assert_close(mast.penalty_value, 0.10, "masturbate penalty");

        let weed = vices.iter().find(|v| v.name == "weed").unwrap();
        assert!(!weed.triggered);
    }

    #[test]
    fn test_build_vice_values_per_instance() {
        let conn = setup_test_db();
        let configs = load_active_habit_configs(&conn).unwrap();

        let mut input = make_default_input("2026-02-01");
        input.porn = 2;

        let vices = build_vice_values(&input, &configs);
        let porn = vices.iter().find(|v| v.name == "porn").unwrap();
        assert!(porn.triggered);
        assert_eq!(porn.count, Some(2));
        assert_close(porn.penalty_value, 0.25, "porn penalty");
        assert_eq!(porn.penalty_mode, PenaltyMode::PerInstance);
    }

    #[test]
    fn test_build_vice_values_tiered() {
        let conn = setup_test_db();
        let configs = load_active_habit_configs(&conn).unwrap();

        let input = make_default_input("2026-02-01");
        let vices = build_vice_values(&input, &configs);

        let phone = vices.iter().find(|v| v.name == "phone_use").unwrap();
        assert!(!phone.triggered);
        assert_eq!(phone.penalty_mode, PenaltyMode::Tiered);
    }

    // -----------------------------------------------------------------------
    // Previous Streak Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_previous_streak_day_1() {
        let conn = setup_test_db();
        let streak = determine_previous_streak(&conn, "2026-02-01").unwrap();
        assert_eq!(streak, -1, "Day 1 should return -1");
    }

    #[test]
    fn test_previous_streak_gap() {
        let conn = setup_test_db();
        insert_scored_row(&conn, "2026-02-01", 0.8, 0, 0.8);
        // Gap: 2026-02-02 missing, asking about 2026-02-03
        let streak = determine_previous_streak(&conn, "2026-02-03").unwrap();
        assert_eq!(streak, 0, "Gap should return 0");
    }

    #[test]
    fn test_previous_streak_consecutive() {
        let conn = setup_test_db();
        insert_scored_row(&conn, "2026-02-01", 0.8, 0, 0.8);
        insert_scored_row(&conn, "2026-02-02", 0.9, 1, 0.91);
        let streak = determine_previous_streak(&conn, "2026-02-03").unwrap();
        assert_eq!(streak, 1, "Should return previous day's streak");
    }

    #[test]
    fn test_previous_streak_null() {
        let conn = setup_test_db();
        // Insert row with NULL streak
        conn.execute(
            "INSERT INTO daily_log (\
             date, logged_at, last_modified\
             ) VALUES ('2026-02-01', '2026-02-01T10:00:00Z', '2026-02-01T10:00:00Z')",
            [],
        )
        .unwrap();
        let streak = determine_previous_streak(&conn, "2026-02-02").unwrap();
        assert_eq!(streak, 0, "NULL streak should return 0");
    }

    // -----------------------------------------------------------------------
    // save_daily_log Integration Tests
    // -----------------------------------------------------------------------

    /// Helper: runs save_daily_log against a raw connection (no Tauri State).
    fn save_daily_log_direct(conn: &Connection, entry: DailyLogInput) -> CommandResult<DailyLog> {
        {
            let tx = conn.unchecked_transaction().map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

            let existing: Option<(i64, String)> = tx
                .query_row(
                    "SELECT id, logged_at FROM daily_log WHERE date = ?1",
                    [&entry.date],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()?;

            let now = chrono::Utc::now().to_rfc3339();
            let logged_at = match &existing {
                Some((_, original)) => original.clone(),
                None => now.clone(),
            };

            let habit_configs = load_active_habit_configs(&tx)?;
            let scoring_config = load_scoring_config(&tx)?;

            let habit_values = build_habit_values(&entry, &habit_configs);
            let vice_values = build_vice_values(&entry, &habit_configs);
            let previous_streak = determine_previous_streak(&tx, &entry.date)?;

            let scoring_input = ScoringInput {
                habit_values,
                vice_values,
                phone_minutes: entry.phone_use as f64,
                previous_streak,
                config: scoring_config.clone(),
            };

            let scores = compute_scores(&scoring_input);

            if existing.is_some() {
                tx.execute(
                    "UPDATE daily_log SET \
                     schoolwork = ?2, personal_project = ?3, classes = ?4, job_search = ?5, \
                     gym = ?6, sleep_7_9h = ?7, wake_8am = ?8, supplements = ?9, \
                     meal_quality = ?10, stretching = ?11, \
                     meditate = ?12, \"read\" = ?13, social = ?14, \
                     porn = ?15, masturbate = ?16, weed = ?17, skip_class = ?18, \
                     binged_content = ?19, gaming_1h = ?20, past_12am = ?21, \
                     late_wake = ?22, phone_use = ?23, \
                     positive_score = ?24, vice_penalty = ?25, base_score = ?26, \
                     streak = ?27, final_score = ?28, \
                     last_modified = ?29 \
                     WHERE date = ?1",
                    params![
                        entry.date, entry.schoolwork, entry.personal_project,
                        entry.classes, entry.job_search, entry.gym, entry.sleep_7_9h,
                        entry.wake_8am, entry.supplements, entry.meal_quality, entry.stretching,
                        entry.meditate, entry.read, entry.social,
                        entry.porn, entry.masturbate, entry.weed, entry.skip_class,
                        entry.binged_content, entry.gaming_1h, entry.past_12am,
                        entry.late_wake, entry.phone_use,
                        scores.positive_score, scores.vice_penalty, scores.base_score,
                        scores.streak, scores.final_score, &now,
                    ],
                )?;
            } else {
                tx.execute(
                    "INSERT INTO daily_log (\
                     date, schoolwork, personal_project, classes, job_search, \
                     gym, sleep_7_9h, wake_8am, supplements, meal_quality, stretching, \
                     meditate, \"read\", social, \
                     porn, masturbate, weed, skip_class, binged_content, gaming_1h, \
                     past_12am, late_wake, phone_use, \
                     positive_score, vice_penalty, base_score, streak, final_score, \
                     logged_at, last_modified\
                     ) VALUES (\
                     ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, \
                     ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, \
                     ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30\
                     )",
                    params![
                        entry.date, entry.schoolwork, entry.personal_project,
                        entry.classes, entry.job_search, entry.gym, entry.sleep_7_9h,
                        entry.wake_8am, entry.supplements, entry.meal_quality, entry.stretching,
                        entry.meditate, entry.read, entry.social,
                        entry.porn, entry.masturbate, entry.weed, entry.skip_class,
                        entry.binged_content, entry.gaming_1h, entry.past_12am,
                        entry.late_wake, entry.phone_use,
                        scores.positive_score, scores.vice_penalty, scores.base_score,
                        scores.streak, scores.final_score, logged_at, &now,
                    ],
                )?;
            }

            let subsequent_days = load_subsequent_days(&tx, &entry.date)?;
            if !subsequent_days.is_empty() {
                let cascade_updates =
                    compute_cascade(&entry.date, &scores, &subsequent_days, &scoring_config);
                for update in cascade_updates.iter().skip(1) {
                    tx.execute(
                        "UPDATE daily_log SET streak = ?2, final_score = ?3, last_modified = ?4 \
                         WHERE date = ?1",
                        params![update.date, update.streak, update.final_score, &now],
                    )?;
                }
            }

            tx.commit()?;
        }

        query_daily_log_by_date(conn, &entry.date)?
            .ok_or_else(|| CommandError::from("Failed to read back saved daily log"))
    }

    #[test]
    fn test_save_new_entry_scores_computed() {
        let conn = setup_test_db();
        let input = make_default_input("2026-02-01");
        let result = save_daily_log_direct(&conn, input).unwrap();

        assert_eq!(result.date, "2026-02-01");
        // Empty day: positive_score = 0, vice_penalty = 0, base_score = 0
        assert!(result.positive_score.is_some());
        assert_close(result.positive_score.unwrap(), 0.0, "positive_score");
        assert_close(result.vice_penalty.unwrap(), 0.0, "vice_penalty");
        assert_close(result.base_score.unwrap(), 0.0, "base_score");
        assert_eq!(result.streak, Some(0)); // Day 1, base_score < threshold
        assert_close(result.final_score.unwrap(), 0.0, "final_score");
    }

    #[test]
    fn test_save_perfect_day_tv01() {
        let conn = setup_test_db();
        let input = make_perfect_day_input("2026-02-01");
        let result = save_daily_log_direct(&conn, input).unwrap();

        // TV01: All habits max, no vices, Day 1
        assert_close(result.positive_score.unwrap(), 1.0, "TV01 positive_score");
        assert_close(result.vice_penalty.unwrap(), 0.0, "TV01 vice_penalty");
        assert_close(result.base_score.unwrap(), 1.0, "TV01 base_score");
        assert_eq!(result.streak, Some(0)); // Day 1: previous_streak=-1, -1+1=0
        assert_close(result.final_score.unwrap(), 1.0, "TV01 final_score");
    }

    #[test]
    fn test_save_update_preserves_logged_at() {
        let conn = setup_test_db();

        // First save
        let input1 = make_default_input("2026-02-01");
        let result1 = save_daily_log_direct(&conn, input1).unwrap();
        let original_logged_at = result1.logged_at.clone();

        // Wait a tiny moment then update
        std::thread::sleep(std::time::Duration::from_millis(10));

        // Second save — update with different values
        let mut input2 = make_default_input("2026-02-01");
        input2.schoolwork = 1;
        let result2 = save_daily_log_direct(&conn, input2).unwrap();

        assert_eq!(result2.logged_at, original_logged_at, "logged_at should be preserved");
        assert_ne!(result2.last_modified, original_logged_at, "last_modified should be updated");
        assert_eq!(result2.schoolwork, 1, "schoolwork should be updated");
    }

    #[test]
    fn test_save_update_recomputes_scores() {
        let conn = setup_test_db();

        // First: empty day
        let input1 = make_default_input("2026-02-01");
        let result1 = save_daily_log_direct(&conn, input1).unwrap();
        assert_close(result1.positive_score.unwrap(), 0.0, "initial positive_score");

        // Update: add some habits
        let input2 = make_perfect_day_input("2026-02-01");
        let result2 = save_daily_log_direct(&conn, input2).unwrap();
        assert_close(result2.positive_score.unwrap(), 1.0, "updated positive_score");
    }

    #[test]
    fn test_save_with_vices() {
        let conn = setup_test_db();

        let mut input = make_perfect_day_input("2026-02-01");
        input.porn = 1; // per_instance, penalty = 0.25

        let result = save_daily_log_direct(&conn, input).unwrap();

        // Vice penalty should be 0.25 (1 × 0.25)
        assert_close(result.vice_penalty.unwrap(), 0.25, "vice_penalty with porn=1");
        // base_score = 1.0 × (1 - 0.25) = 0.75
        assert_close(result.base_score.unwrap(), 0.75, "base_score with vice");
    }

    #[test]
    fn test_save_consecutive_days_streak() {
        let conn = setup_test_db();

        // Day 1: perfect
        let input1 = make_perfect_day_input("2026-02-01");
        let result1 = save_daily_log_direct(&conn, input1).unwrap();
        assert_eq!(result1.streak, Some(0)); // Day 1 convention

        // Day 2: perfect
        let input2 = make_perfect_day_input("2026-02-02");
        let result2 = save_daily_log_direct(&conn, input2).unwrap();
        assert_eq!(result2.streak, Some(1)); // previous_streak=0, 0+1=1

        // Day 3: perfect
        let input3 = make_perfect_day_input("2026-02-03");
        let result3 = save_daily_log_direct(&conn, input3).unwrap();
        assert_eq!(result3.streak, Some(2)); // previous_streak=1, 1+1=2
    }

    #[test]
    fn test_save_cascade_on_edit() {
        let conn = setup_test_db();

        // Create 3 consecutive perfect days
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-01")).unwrap();
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-02")).unwrap();
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-03")).unwrap();

        // Verify initial streaks
        let day2 = query_daily_log_by_date(&conn, "2026-02-02").unwrap().unwrap();
        assert_eq!(day2.streak, Some(1));
        let day3 = query_daily_log_by_date(&conn, "2026-02-03").unwrap().unwrap();
        assert_eq!(day3.streak, Some(2));

        // Edit Day 1: make it empty (breaks streak chain)
        let empty_day1 = make_default_input("2026-02-01");
        save_daily_log_direct(&conn, empty_day1).unwrap();

        // Day 1 now has base_score < threshold → streak should be 0
        let day1_edited = query_daily_log_by_date(&conn, "2026-02-01").unwrap().unwrap();
        assert_eq!(day1_edited.streak, Some(0));

        // Day 2: previous streak was 0 from Day 1, Day 2 base_score >= threshold → streak should be 1
        let day2_after = query_daily_log_by_date(&conn, "2026-02-02").unwrap().unwrap();
        assert_eq!(day2_after.streak, Some(1));

        // Day 3: previous streak was 1 from Day 2 → streak should be 2
        let day3_after = query_daily_log_by_date(&conn, "2026-02-03").unwrap().unwrap();
        assert_eq!(day3_after.streak, Some(2));
    }

    #[test]
    fn test_save_cascade_streak_break() {
        let conn = setup_test_db();

        // 3 consecutive perfect days
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-01")).unwrap();
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-02")).unwrap();
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-03")).unwrap();

        // Edit Day 2: make it empty (below threshold)
        save_daily_log_direct(&conn, make_default_input("2026-02-02")).unwrap();

        // Day 2 breaks the chain: streak = 0
        let day2 = query_daily_log_by_date(&conn, "2026-02-02").unwrap().unwrap();
        assert_eq!(day2.streak, Some(0));

        // Day 3: previous was Day 2 (streak=0), Day 3 is still perfect (base >= threshold)
        // → streak = 0 + 1 = 1
        let day3 = query_daily_log_by_date(&conn, "2026-02-03").unwrap().unwrap();
        assert_eq!(day3.streak, Some(1));
    }

    #[test]
    fn test_save_backfill_triggers_cascade() {
        let conn = setup_test_db();

        // Create Day 1 and Day 3 (gap at Day 2)
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-01")).unwrap();
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-03")).unwrap();

        // Day 3: previous day (Feb 2) is a gap → previous_streak = 0 → streak = 1
        let day3_before = query_daily_log_by_date(&conn, "2026-02-03").unwrap().unwrap();
        assert_eq!(day3_before.streak, Some(1));

        // Now backfill Day 2 with a perfect day
        save_daily_log_direct(&conn, make_perfect_day_input("2026-02-02")).unwrap();

        // Day 2: previous was Day 1 (streak=0) → streak = 1
        let day2 = query_daily_log_by_date(&conn, "2026-02-02").unwrap().unwrap();
        assert_eq!(day2.streak, Some(1));

        // Day 3: now has consecutive day before (Day 2 streak=1) → streak = 2
        let day3_after = query_daily_log_by_date(&conn, "2026-02-03").unwrap().unwrap();
        assert_eq!(day3_after.streak, Some(2));
    }

    #[test]
    fn test_save_return_matches_db() {
        let conn = setup_test_db();

        let input = make_perfect_day_input("2026-02-01");
        let result = save_daily_log_direct(&conn, input).unwrap();

        // Read back from DB independently
        let from_db = query_daily_log_by_date(&conn, "2026-02-01").unwrap().unwrap();

        assert_eq!(result.id, from_db.id);
        assert_eq!(result.date, from_db.date);
        assert_eq!(result.schoolwork, from_db.schoolwork);
        assert_eq!(result.meal_quality, from_db.meal_quality);
        assert_eq!(result.positive_score, from_db.positive_score);
        assert_eq!(result.streak, from_db.streak);
        assert_eq!(result.final_score, from_db.final_score);
        assert_eq!(result.logged_at, from_db.logged_at);
    }

    // -----------------------------------------------------------------------
    // Scoring Config Loader Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_load_scoring_config() {
        let conn = setup_test_db();
        let config = load_scoring_config(&conn).unwrap();

        assert_close(config.multiplier_productivity, 1.5, "multiplier_productivity");
        assert_close(config.multiplier_health, 1.3, "multiplier_health");
        assert_close(config.multiplier_growth, 1.0, "multiplier_growth");
        assert_close(config.target_fraction, 0.85, "target_fraction");
        assert_close(config.vice_cap, 0.40, "vice_cap");
        assert_close(config.streak_threshold, 0.65, "streak_threshold");
        assert_close(config.phone_t1_min, 61.0, "phone_t1_min");
        assert_close(config.phone_t2_min, 181.0, "phone_t2_min");
        assert_close(config.phone_t3_min, 301.0, "phone_t3_min");
    }

    #[test]
    fn test_load_active_habit_configs() {
        let conn = setup_test_db();
        let configs = load_active_habit_configs(&conn).unwrap();

        // 13 good + 9 vices = 22 active habits
        assert_eq!(configs.len(), 22);

        let good_count = configs.iter().filter(|c| c.pool == "good").count();
        let vice_count = configs.iter().filter(|c| c.pool == "vice").count();
        assert_eq!(good_count, 13);
        assert_eq!(vice_count, 9);
    }
}
