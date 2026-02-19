use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full weekly_review row returned to the frontend.
/// Field names and types must match the TypeScript `WeeklyReview` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyReview {
    pub id: i64,
    pub week_start: String,
    pub week_end: String,
    pub week_number: i64,

    // Auto-computed stats (nullable — None before save)
    pub avg_score: Option<f64>,
    pub days_tracked: Option<i64>,
    pub best_day_score: Option<f64>,
    pub worst_day_score: Option<f64>,
    pub habits_completed: Option<i64>,
    pub study_hours: Option<f64>,
    pub applications_sent: Option<i64>,
    pub relapses: Option<i64>,
    pub urges_resisted: Option<i64>,
    pub streak_at_end: Option<i64>,

    // Manual reflection
    pub biggest_win: String,
    pub biggest_challenge: String,
    pub next_week_goal: String,
    pub reflection: String,

    // Snapshot data
    pub snapshot_date: Option<String>,
    pub score_snapshot: Option<String>,

    // Timestamps
    pub logged_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving a weekly review.
/// Contains only user-editable fields — no id, stats, snapshot, or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyReviewInput {
    pub week_start: String,
    pub week_end: String,
    pub week_number: i64,
    pub biggest_win: String,
    pub biggest_challenge: String,
    pub next_week_goal: String,
    pub reflection: String,
}

/// Live-computed weekly stats (not stored in DB).
/// Returned by `compute_weekly_stats` for the review UI preview.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyStats {
    pub avg_score: Option<f64>,
    pub days_tracked: i64,
    pub best_day_score: Option<f64>,
    pub worst_day_score: Option<f64>,
    pub total_study_hours: f64,
    pub applications_sent: i64,
    pub relapses: i64,
    pub urges_resisted: i64,
    pub current_streak: Option<i32>,
}

// ---------------------------------------------------------------------------
// Column Constants & Row Mapper
// ---------------------------------------------------------------------------

const WEEKLY_REVIEW_COLUMNS: &str = "\
    id, week_start, week_end, week_number, \
    avg_score, days_tracked, best_day_score, worst_day_score, \
    habits_completed, study_hours, applications_sent, \
    relapses, urges_resisted, streak_at_end, \
    biggest_win, biggest_challenge, next_week_goal, reflection, \
    snapshot_date, score_snapshot, \
    logged_at, last_modified";

fn row_to_weekly_review(row: &rusqlite::Row) -> rusqlite::Result<WeeklyReview> {
    Ok(WeeklyReview {
        id: row.get(0)?,
        week_start: row.get(1)?,
        week_end: row.get(2)?,
        week_number: row.get(3)?,
        avg_score: row.get(4)?,
        days_tracked: row.get(5)?,
        best_day_score: row.get(6)?,
        worst_day_score: row.get(7)?,
        habits_completed: row.get(8)?,
        study_hours: row.get(9)?,
        applications_sent: row.get(10)?,
        relapses: row.get(11)?,
        urges_resisted: row.get(12)?,
        streak_at_end: row.get(13)?,
        biggest_win: row.get(14)?,
        biggest_challenge: row.get(15)?,
        next_week_goal: row.get(16)?,
        reflection: row.get(17)?,
        snapshot_date: row.get(18)?,
        score_snapshot: row.get(19)?,
        logged_at: row.get(20)?,
        last_modified: row.get(21)?,
    })
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

fn query_weekly_review_by_week_start(
    conn: &Connection,
    week_start: &str,
) -> CommandResult<Option<WeeklyReview>> {
    let sql = format!(
        "SELECT {} FROM weekly_review WHERE week_start = ?1",
        WEEKLY_REVIEW_COLUMNS
    );
    conn.query_row(&sql, [week_start], row_to_weekly_review)
        .optional()
        .map_err(CommandError::from)
}

/// Compute the week_end date (Sunday) from a week_start date (Monday).
/// Uses SQLite date arithmetic: week_start + 6 days.
fn compute_week_end(conn: &Connection, week_start: &str) -> CommandResult<String> {
    conn.query_row(
        "SELECT date(?1, '+6 days')",
        [week_start],
        |row| row.get(0),
    )
    .map_err(CommandError::from)
}

/// Compute live weekly stats from the database (not saved).
fn compute_weekly_stats_impl(
    conn: &Connection,
    week_start: &str,
    week_end: &str,
) -> CommandResult<WeeklyStats> {
    // 1. Score stats + days tracked
    let (avg_score, min_score, max_score, days_tracked): (
        Option<f64>,
        Option<f64>,
        Option<f64>,
        i64,
    ) = conn
        .query_row(
            "SELECT AVG(final_score), MIN(final_score), MAX(final_score), COUNT(*) \
             FROM daily_log WHERE date >= ?1 AND date <= ?2 AND final_score IS NOT NULL",
            params![week_start, week_end],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(CommandError::from)?;

    // 2. Study hours
    let total_study_hours: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 \
             FROM study_session WHERE date >= ?1 AND date <= ?2",
            params![week_start, week_end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    // 3. Applications sent
    let applications_sent: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM application \
             WHERE date_applied >= ?1 AND date_applied <= ?2",
            params![week_start, week_end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    // 4. Relapses
    let relapses: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM relapse_entry \
             WHERE date >= ?1 AND date <= ?2",
            params![week_start, week_end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    // 5. Urges resisted (did_pass starts with 'Yes')
    let urges_resisted: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM urge_entry \
             WHERE date >= ?1 AND date <= ?2 AND did_pass LIKE 'Yes%'",
            params![week_start, week_end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    // 6. Current streak: from last tracked day in the week
    let current_streak: Option<i32> = conn
        .query_row(
            "SELECT streak FROM daily_log \
             WHERE date >= ?1 AND date <= ?2 AND streak IS NOT NULL \
             ORDER BY date DESC LIMIT 1",
            params![week_start, week_end],
            |row| row.get(0),
        )
        .optional()
        .map_err(CommandError::from)?
        .flatten();

    Ok(WeeklyStats {
        avg_score,
        days_tracked,
        best_day_score: max_score,
        worst_day_score: min_score,
        total_study_hours,
        applications_sent,
        relapses,
        urges_resisted,
        current_streak,
    })
}

/// Count total good habit completions for the week.
/// A habit is "completed" if its column value > 0 (for checkbox/number)
/// or is not 'None'/'' (for dropdown).
fn compute_habits_completed(
    conn: &Connection,
    week_start: &str,
    week_end: &str,
) -> CommandResult<i64> {
    // Query active good habits
    let mut stmt = conn.prepare(
        "SELECT column_name, input_type FROM habit_config \
         WHERE pool = 'good' AND is_active = 1",
    )?;
    let habits: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    let mut total_completions: i64 = 0;

    for (column_name, input_type) in &habits {
        // Validate column name against known columns to prevent SQL injection
        if !is_valid_daily_log_column(column_name) {
            continue;
        }

        let quoted_col = quote_column_name(column_name);
        let count: i64 = if input_type == "dropdown" {
            conn.query_row(
                &format!(
                    "SELECT COUNT(*) FROM daily_log \
                     WHERE date >= ?1 AND date <= ?2 AND {} != 'None' AND {} != ''",
                    quoted_col, quoted_col
                ),
                params![week_start, week_end],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?
        } else {
            conn.query_row(
                &format!(
                    "SELECT COUNT(*) FROM daily_log \
                     WHERE date >= ?1 AND date <= ?2 AND {} > 0",
                    quoted_col
                ),
                params![week_start, week_end],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?
        };
        total_completions += count;
    }

    Ok(total_completions)
}

/// Build the score snapshot: JSON array of 7 final_score values for Mon–Sun.
/// Null for missing days.
fn build_score_snapshot(
    conn: &Connection,
    week_start: &str,
    week_end: &str,
) -> CommandResult<String> {
    // Query all daily_log entries for the week
    let mut stmt = conn.prepare(
        "SELECT date, final_score FROM daily_log \
         WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
    )?;
    let rows: Vec<(String, Option<f64>)> = stmt
        .query_map(params![week_start, week_end], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    // Build a map of date -> final_score
    let score_map: std::collections::HashMap<String, Option<f64>> =
        rows.into_iter().collect();

    // Generate 7 dates Mon(+0) through Sun(+6)
    let mut snapshot: Vec<serde_json::Value> = Vec::with_capacity(7);
    for offset in 0..7 {
        let date: String = conn
            .query_row(
                &format!("SELECT date(?1, '+{} days')", offset),
                [week_start],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        match score_map.get(&date) {
            Some(Some(score)) => snapshot.push(serde_json::json!(*score)),
            _ => snapshot.push(serde_json::Value::Null),
        }
    }

    serde_json::to_string(&snapshot).map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Column Validation (SQL injection prevention)
// ---------------------------------------------------------------------------

/// Known valid column names in daily_log table.
const VALID_DAILY_LOG_COLUMNS: &[&str] = &[
    "schoolwork",
    "personal_project",
    "classes",
    "job_search",
    "gym",
    "sleep_7_9h",
    "wake_8am",
    "supplements",
    "meal_quality",
    "stretching",
    "meditate",
    "read",
    "social",
    "porn",
    "masturbate",
    "weed",
    "skip_class",
    "binged_content",
    "gaming_1h",
    "past_12am",
    "late_wake",
    "phone_use",
];

fn is_valid_daily_log_column(name: &str) -> bool {
    VALID_DAILY_LOG_COLUMNS.contains(&name)
}

/// Quote column name for SQL. Handles the reserved word "read".
fn quote_column_name(name: &str) -> String {
    if name == "read" {
        "\"read\"".to_string()
    } else {
        name.to_string()
    }
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_weekly_review(
    state: tauri::State<'_, AppState>,
    week_start: String,
) -> CommandResult<Option<WeeklyReview>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_weekly_review_by_week_start(&db, &week_start)
}

#[tauri::command]
pub fn compute_weekly_stats(
    state: tauri::State<'_, AppState>,
    week_start: String,
) -> CommandResult<WeeklyStats> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    let week_end = compute_week_end(&db, &week_start)?;
    compute_weekly_stats_impl(&db, &week_start, &week_end)
}

#[tauri::command]
pub fn save_weekly_review(
    state: tauri::State<'_, AppState>,
    review: WeeklyReviewInput,
) -> CommandResult<WeeklyReview> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    save_weekly_review_impl(&db, review)
}

fn save_weekly_review_impl(
    conn: &Connection,
    review: WeeklyReviewInput,
) -> CommandResult<WeeklyReview> {
    let now = chrono::Utc::now().to_rfc3339();
    let week_end = compute_week_end(conn, &review.week_start)?;

    {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        // 1. Compute stats
        let stats = compute_weekly_stats_impl(&tx, &review.week_start, &week_end)?;
        let habits_completed =
            compute_habits_completed(&tx, &review.week_start, &week_end)?;

        // 2. Build score snapshot (ADR-002 SD3: frozen at save time)
        let score_snapshot = build_score_snapshot(&tx, &review.week_start, &week_end)?;

        // 3. Check for existing row
        let existing: Option<(i64, String)> = tx
            .query_row(
                "SELECT id, logged_at FROM weekly_review WHERE week_start = ?1",
                [&review.week_start],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        match existing {
            Some((_id, original_logged_at)) => {
                // 4a. UPDATE — preserve original logged_at
                tx.execute(
                    "UPDATE weekly_review SET \
                     week_end = ?2, week_number = ?3, \
                     avg_score = ?4, days_tracked = ?5, \
                     best_day_score = ?6, worst_day_score = ?7, \
                     habits_completed = ?8, study_hours = ?9, \
                     applications_sent = ?10, relapses = ?11, \
                     urges_resisted = ?12, streak_at_end = ?13, \
                     biggest_win = ?14, biggest_challenge = ?15, \
                     next_week_goal = ?16, reflection = ?17, \
                     snapshot_date = ?18, score_snapshot = ?19, \
                     logged_at = ?20, last_modified = ?21 \
                     WHERE week_start = ?1",
                    params![
                        review.week_start,
                        week_end,
                        review.week_number,
                        stats.avg_score,
                        stats.days_tracked,
                        stats.best_day_score,
                        stats.worst_day_score,
                        habits_completed,
                        stats.total_study_hours,
                        stats.applications_sent,
                        stats.relapses,
                        stats.urges_resisted,
                        stats.current_streak.map(|s| s as i64),
                        review.biggest_win,
                        review.biggest_challenge,
                        review.next_week_goal,
                        review.reflection,
                        &now,
                        score_snapshot,
                        original_logged_at,
                        &now,
                    ],
                )?;
            }
            None => {
                // 4b. INSERT — logged_at = now
                tx.execute(
                    "INSERT INTO weekly_review (\
                     week_start, week_end, week_number, \
                     avg_score, days_tracked, \
                     best_day_score, worst_day_score, \
                     habits_completed, study_hours, \
                     applications_sent, relapses, \
                     urges_resisted, streak_at_end, \
                     biggest_win, biggest_challenge, \
                     next_week_goal, reflection, \
                     snapshot_date, score_snapshot, \
                     logged_at, last_modified\
                     ) VALUES (\
                     ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, \
                     ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
                    params![
                        review.week_start,
                        week_end,
                        review.week_number,
                        stats.avg_score,
                        stats.days_tracked,
                        stats.best_day_score,
                        stats.worst_day_score,
                        habits_completed,
                        stats.total_study_hours,
                        stats.applications_sent,
                        stats.relapses,
                        stats.urges_resisted,
                        stats.current_streak.map(|s| s as i64),
                        review.biggest_win,
                        review.biggest_challenge,
                        review.next_week_goal,
                        review.reflection,
                        &now,
                        score_snapshot,
                        &now,
                        &now,
                    ],
                )?;
            }
        }

        tx.commit()?;
    }

    // 5. Read back and return
    query_weekly_review_by_week_start(conn, &review.week_start)?
        .ok_or_else(|| CommandError::from("Failed to read back saved weekly review"))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        run_migrations(&mut conn).expect("Migrations should succeed");
        conn
    }

    fn make_review_input(week_start: &str) -> WeeklyReviewInput {
        WeeklyReviewInput {
            week_start: week_start.to_string(),
            week_end: String::new(), // computed by save
            week_number: 8,
            biggest_win: "Completed project".to_string(),
            biggest_challenge: "Time management".to_string(),
            next_week_goal: "Exercise more".to_string(),
            reflection: "Good week overall".to_string(),
        }
    }

    /// Insert a minimal daily_log row for testing.
    fn insert_daily_log(conn: &Connection, date: &str, final_score: f64, streak: i32) {
        let now = chrono::Utc::now().to_rfc3339();
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
             ?1, 1, 0, 1, 0, 1, 1, 1, 0, 'None', 0, 0, 0, 'None', \
             0, 0, 0, 0, 0, 0, 0, 0, 0, \
             50.0, 0.0, 50.0, ?2, ?3, ?4, ?5)",
            params![date, streak, final_score, &now, &now],
        )
        .unwrap();
    }

    // -----------------------------------------------------------------------
    // A. get_weekly_review tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_weekly_review_none_when_missing() {
        let conn = setup_test_db();
        let result = query_weekly_review_by_week_start(&conn, "2026-02-16").unwrap();
        assert!(result.is_none());
    }

    // -----------------------------------------------------------------------
    // B. compute_weekly_stats tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_compute_weekly_stats_empty_week() {
        let conn = setup_test_db();
        let stats = compute_weekly_stats_impl(&conn, "2026-02-16", "2026-02-22").unwrap();
        assert_eq!(stats.days_tracked, 0);
        assert!(stats.avg_score.is_none());
        assert!(stats.best_day_score.is_none());
        assert!(stats.worst_day_score.is_none());
        assert_eq!(stats.total_study_hours, 0.0);
        assert_eq!(stats.applications_sent, 0);
        assert_eq!(stats.relapses, 0);
        assert_eq!(stats.urges_resisted, 0);
        assert!(stats.current_streak.is_none());
    }

    #[test]
    fn test_compute_weekly_stats_with_data() {
        let conn = setup_test_db();

        // Insert daily logs for 3 days in the week
        insert_daily_log(&conn, "2026-02-16", 75.0, 5); // Monday
        insert_daily_log(&conn, "2026-02-17", 85.0, 6); // Tuesday
        insert_daily_log(&conn, "2026-02-18", 65.0, 7); // Wednesday

        // Insert study sessions
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, resources, notes, \
             logged_at, last_modified\
             ) VALUES ('2026-02-16', 'Math', 'Self-Study', '09:00', '11:00', \
             120, 4, 'Library', '', '', '', ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        // Insert application
        conn.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, current_status, \
             url, notes, salary, contact_name, contact_email, \
             login_username, login_password, archived, logged_at, last_modified\
             ) VALUES ('2026-02-17', 'Acme', 'Engineer', 'LinkedIn', 'Applied', \
             '', '', '', '', '', '', '', 0, ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        // Insert relapse
        conn.execute(
            "INSERT INTO relapse_entry (\
             date, time, duration, trigger, location, device, \
             activity_before, emotional_state, resistance_technique, \
             urge_intensity, notes, created_at, last_modified\
             ) VALUES ('2026-02-18', '23:00', '< 5 min', 'Boredom', 'Bedroom', \
             'Phone', 'Scrolling', 'Stressed', 'None', 5, '', ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        // Insert urge (resisted)
        conn.execute(
            "INSERT INTO urge_entry (\
             date, time, intensity, technique, effectiveness, \
             duration, did_pass, trigger, notes, created_at, last_modified\
             ) VALUES ('2026-02-16', '22:00', 6, 'Cold Shower', 4, \
             '5-15 min', 'Yes - completely', 'Late night', '', ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        let stats = compute_weekly_stats_impl(&conn, "2026-02-16", "2026-02-22").unwrap();

        assert_eq!(stats.days_tracked, 3);
        assert!((stats.avg_score.unwrap() - 75.0).abs() < 0.01);
        assert!((stats.best_day_score.unwrap() - 85.0).abs() < 0.01);
        assert!((stats.worst_day_score.unwrap() - 65.0).abs() < 0.01);
        assert!((stats.total_study_hours - 2.0).abs() < 0.01);
        assert_eq!(stats.applications_sent, 1);
        assert_eq!(stats.relapses, 1);
        assert_eq!(stats.urges_resisted, 1);
        assert_eq!(stats.current_streak, Some(7));
    }

    // -----------------------------------------------------------------------
    // C. save_weekly_review tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_save_weekly_review_creates_new() {
        let conn = setup_test_db();
        let input = make_review_input("2026-02-16");
        let saved = save_weekly_review_impl(&conn, input).unwrap();

        assert_eq!(saved.week_start, "2026-02-16");
        assert_eq!(saved.week_end, "2026-02-22");
        assert_eq!(saved.biggest_win, "Completed project");
        assert!(!saved.logged_at.is_empty());
        assert!(!saved.last_modified.is_empty());
        assert!(saved.snapshot_date.is_some());
        assert!(saved.score_snapshot.is_some());
    }

    #[test]
    fn test_save_weekly_review_updates_existing() {
        let conn = setup_test_db();
        let input = make_review_input("2026-02-16");
        let first_save = save_weekly_review_impl(&conn, input).unwrap();
        let original_logged_at = first_save.logged_at.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let mut updated_input = make_review_input("2026-02-16");
        updated_input.biggest_win = "Even better win".to_string();
        let second_save = save_weekly_review_impl(&conn, updated_input).unwrap();

        // logged_at preserved from first save
        assert_eq!(second_save.logged_at, original_logged_at);
        // last_modified updated
        assert_ne!(second_save.last_modified, first_save.last_modified);
        // Content updated
        assert_eq!(second_save.biggest_win, "Even better win");
    }

    #[test]
    fn test_score_snapshot_has_7_elements() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-02-16", 75.0, 1);

        let input = make_review_input("2026-02-16");
        let saved = save_weekly_review_impl(&conn, input).unwrap();

        let snapshot: Vec<serde_json::Value> =
            serde_json::from_str(saved.score_snapshot.as_ref().unwrap()).unwrap();
        assert_eq!(snapshot.len(), 7);
    }

    #[test]
    fn test_score_snapshot_nulls_for_missing_days() {
        let conn = setup_test_db();
        // Only insert Mon and Wed
        insert_daily_log(&conn, "2026-02-16", 75.0, 1); // Monday
        insert_daily_log(&conn, "2026-02-18", 85.0, 2); // Wednesday

        let input = make_review_input("2026-02-16");
        let saved = save_weekly_review_impl(&conn, input).unwrap();

        let snapshot: Vec<serde_json::Value> =
            serde_json::from_str(saved.score_snapshot.as_ref().unwrap()).unwrap();
        assert_eq!(snapshot.len(), 7);
        // Monday has score
        assert!(snapshot[0].is_number());
        assert!((snapshot[0].as_f64().unwrap() - 75.0).abs() < 0.01);
        // Tuesday is null
        assert!(snapshot[1].is_null());
        // Wednesday has score
        assert!(snapshot[2].is_number());
        assert!((snapshot[2].as_f64().unwrap() - 85.0).abs() < 0.01);
        // Thu-Sun are null
        for i in 3..7 {
            assert!(snapshot[i].is_null());
        }
    }

    #[test]
    fn test_save_weekly_review_freezes_snapshot() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-02-16", 75.0, 1);

        let input = make_review_input("2026-02-16");
        let saved = save_weekly_review_impl(&conn, input).unwrap();
        let original_snapshot = saved.score_snapshot.clone();

        // Now change the daily score
        conn.execute(
            "UPDATE daily_log SET final_score = 99.0 WHERE date = '2026-02-16'",
            [],
        )
        .unwrap();

        // Re-read the review — snapshot should NOT have changed (ADR-002 SD3)
        let reloaded =
            query_weekly_review_by_week_start(&conn, "2026-02-16")
                .unwrap()
                .unwrap();
        assert_eq!(reloaded.score_snapshot, original_snapshot);
    }

    #[test]
    fn test_save_weekly_review_computes_stats() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-02-16", 80.0, 3);
        insert_daily_log(&conn, "2026-02-17", 90.0, 4);

        let input = make_review_input("2026-02-16");
        let saved = save_weekly_review_impl(&conn, input).unwrap();

        assert_eq!(saved.days_tracked, Some(2));
        assert!((saved.avg_score.unwrap() - 85.0).abs() < 0.01);
        assert!((saved.best_day_score.unwrap() - 90.0).abs() < 0.01);
        assert!((saved.worst_day_score.unwrap() - 80.0).abs() < 0.01);
        assert_eq!(saved.streak_at_end, Some(4));
    }
}
