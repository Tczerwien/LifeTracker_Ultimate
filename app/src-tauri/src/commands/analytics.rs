use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::daily_log::{row_to_daily_log, DailyLog, DAILY_LOG_COLUMNS};
use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreTrendPoint {
    pub date: String,
    pub final_score: f64,
    pub moving_avg_7d: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitCompletionRate {
    pub habit_name: String,
    pub display_name: String,
    pub category: String,
    pub rate: f64,
    pub days_completed: i64,
    pub total_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViceFrequency {
    pub vice_name: String,
    pub display_name: String,
    pub frequency: i64,
    pub total_days: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayOfWeekAvg {
    pub day: i32,
    pub avg_score: f64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudySummary {
    pub total_hours: f64,
    pub session_count: i64,
    pub avg_focus: f64,
    pub hours_by_subject: Vec<SubjectHours>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubjectHours {
    pub subject: String,
    pub hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineSummary {
    pub stages: Vec<PipelineStage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStage {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryFrequency {
    pub relapse_count: i64,
    pub urge_count: i64,
    pub urges_resisted: i64,
    pub weekly_data: Vec<WeeklyRecovery>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeeklyRecovery {
    pub week_start: String,
    pub relapses: i64,
    pub urges: i64,
    pub urges_resisted: i64,
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
// Query Implementations
// ---------------------------------------------------------------------------

fn get_score_trend_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<ScoreTrendPoint>> {
    let mut stmt = conn.prepare(
        "SELECT date, final_score FROM daily_log \
         WHERE date >= ?1 AND date <= ?2 AND final_score IS NOT NULL \
         ORDER BY date ASC",
    )?;
    let raw: Vec<(String, f64)> = stmt
        .query_map(params![start, end], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    let mut result = Vec::with_capacity(raw.len());
    for (i, (date, score)) in raw.iter().enumerate() {
        let moving_avg = if i >= 6 {
            let sum: f64 = raw[i - 6..=i].iter().map(|(_, s)| s).sum();
            Some(sum / 7.0)
        } else {
            None
        };
        result.push(ScoreTrendPoint {
            date: date.clone(),
            final_score: *score,
            moving_avg_7d: moving_avg,
        });
    }

    Ok(result)
}

fn get_habit_completion_rates_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<HabitCompletionRate>> {
    // 1. Get total days tracked in range
    let total_days: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM daily_log WHERE date >= ?1 AND date <= ?2",
            params![start, end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    if total_days == 0 {
        return Ok(Vec::new());
    }

    // 2. Query active good habits
    let mut stmt = conn.prepare(
        "SELECT name, display_name, category, column_name, input_type \
         FROM habit_config WHERE pool = 'good' AND is_active = 1 \
         ORDER BY sort_order ASC",
    )?;
    let habits: Vec<(String, String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    // 3. For each habit, count completions
    let mut result = Vec::with_capacity(habits.len());
    for (name, display_name, category, column_name, input_type) in &habits {
        if !is_valid_daily_log_column(column_name) {
            continue;
        }

        let quoted_col = quote_column_name(column_name);
        let days_completed: i64 = if input_type == "dropdown" {
            conn.query_row(
                &format!(
                    "SELECT COUNT(*) FROM daily_log \
                     WHERE date >= ?1 AND date <= ?2 AND {} != 'None' AND {} != ''",
                    quoted_col, quoted_col
                ),
                params![start, end],
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
                params![start, end],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?
        };

        result.push(HabitCompletionRate {
            habit_name: name.clone(),
            display_name: display_name.clone(),
            category: category.clone(),
            rate: days_completed as f64 / total_days as f64,
            days_completed,
            total_days,
        });
    }

    Ok(result)
}

fn get_vice_frequency_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<ViceFrequency>> {
    // Total days in range
    let total_days: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM daily_log WHERE date >= ?1 AND date <= ?2",
            params![start, end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    if total_days == 0 {
        return Ok(Vec::new());
    }

    // Query active vices
    let mut stmt = conn.prepare(
        "SELECT name, display_name, column_name \
         FROM habit_config WHERE pool = 'vice' AND is_active = 1 \
         ORDER BY sort_order ASC",
    )?;
    let vices: Vec<(String, String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    let mut result = Vec::with_capacity(vices.len());
    for (name, display_name, column_name) in &vices {
        if !is_valid_daily_log_column(column_name) {
            continue;
        }

        let quoted_col = quote_column_name(column_name);
        let frequency: i64 = conn
            .query_row(
                &format!(
                    "SELECT COUNT(*) FROM daily_log \
                     WHERE date >= ?1 AND date <= ?2 AND {} > 0",
                    quoted_col
                ),
                params![start, end],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        result.push(ViceFrequency {
            vice_name: name.clone(),
            display_name: display_name.clone(),
            frequency,
            total_days,
        });
    }

    Ok(result)
}

fn get_day_of_week_averages_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<DayOfWeekAvg>> {
    let mut stmt = conn.prepare(
        "SELECT \
           CASE CAST(strftime('%w', date) AS INTEGER) \
             WHEN 0 THEN 6 \
             WHEN 1 THEN 0 \
             WHEN 2 THEN 1 \
             WHEN 3 THEN 2 \
             WHEN 4 THEN 3 \
             WHEN 5 THEN 4 \
             WHEN 6 THEN 5 \
           END AS day_idx, \
           AVG(final_score) AS avg_score, \
           COUNT(*) AS count \
         FROM daily_log \
         WHERE date >= ?1 AND date <= ?2 AND final_score IS NOT NULL \
         GROUP BY day_idx \
         ORDER BY day_idx ASC",
    )?;

    let rows = stmt
        .query_map(params![start, end], |row| {
            Ok(DayOfWeekAvg {
                day: row.get(0)?,
                avg_score: row.get(1)?,
                count: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    Ok(rows)
}

fn get_correlation_data_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<DailyLog>> {
    let sql = format!(
        "SELECT {} FROM daily_log WHERE date >= ?1 AND date <= ?2 ORDER BY date ASC",
        DAILY_LOG_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![start, end], row_to_daily_log)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    Ok(rows)
}

fn get_study_summary_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<StudySummary> {
    // Aggregate stats
    let (session_count, total_hours, avg_focus): (i64, f64, f64) = conn
        .query_row(
            "SELECT COUNT(*), \
                    COALESCE(SUM(duration_minutes), 0) / 60.0, \
                    COALESCE(AVG(focus_score), 0.0) \
             FROM study_session WHERE date >= ?1 AND date <= ?2",
            params![start, end],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(CommandError::from)?;

    // Hours by subject
    let mut stmt = conn.prepare(
        "SELECT subject, SUM(duration_minutes) / 60.0 AS hours \
         FROM study_session WHERE date >= ?1 AND date <= ?2 \
         GROUP BY subject ORDER BY hours DESC",
    )?;
    let hours_by_subject: Vec<SubjectHours> = stmt
        .query_map(params![start, end], |row| {
            Ok(SubjectHours {
                subject: row.get(0)?,
                hours: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    Ok(StudySummary {
        total_hours,
        session_count,
        avg_focus,
        hours_by_subject,
    })
}

fn get_application_pipeline_impl(conn: &Connection) -> CommandResult<PipelineSummary> {
    let mut stmt = conn.prepare(
        "SELECT current_status, COUNT(*) FROM application \
         WHERE archived = 0 \
         GROUP BY current_status \
         ORDER BY CASE current_status \
           WHEN 'Applied' THEN 1 \
           WHEN 'Phone Screen' THEN 2 \
           WHEN 'Interview' THEN 3 \
           WHEN 'Offer' THEN 4 \
           WHEN 'Rejected' THEN 5 \
           WHEN 'Withdrawn' THEN 6 \
           WHEN 'No Response' THEN 7 \
           ELSE 8 END",
    )?;

    let stages: Vec<PipelineStage> = stmt
        .query_map([], |row| {
            Ok(PipelineStage {
                status: row.get(0)?,
                count: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    Ok(PipelineSummary { stages })
}

fn get_recovery_frequency_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<RecoveryFrequency> {
    // Totals
    let relapse_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM relapse_entry WHERE date >= ?1 AND date <= ?2",
            params![start, end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    let urge_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM urge_entry WHERE date >= ?1 AND date <= ?2",
            params![start, end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    let urges_resisted: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM urge_entry \
             WHERE date >= ?1 AND date <= ?2 AND did_pass LIKE 'Yes%'",
            params![start, end],
            |row| row.get(0),
        )
        .map_err(CommandError::from)?;

    // Weekly breakdown — relapses
    let mut relapse_stmt = conn.prepare(
        "SELECT date(date, 'weekday 0', '-6 days') AS week_start, COUNT(*) \
         FROM relapse_entry WHERE date >= ?1 AND date <= ?2 \
         GROUP BY week_start ORDER BY week_start",
    )?;
    let relapse_weeks: Vec<(String, i64)> = relapse_stmt
        .query_map(params![start, end], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    // Weekly breakdown — urges (total + resisted)
    let mut urge_stmt = conn.prepare(
        "SELECT date(date, 'weekday 0', '-6 days') AS week_start, \
                COUNT(*) AS urges, \
                SUM(CASE WHEN did_pass LIKE 'Yes%' THEN 1 ELSE 0 END) AS resisted \
         FROM urge_entry WHERE date >= ?1 AND date <= ?2 \
         GROUP BY week_start ORDER BY week_start",
    )?;
    let urge_weeks: Vec<(String, i64, i64)> = urge_stmt
        .query_map(params![start, end], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    // Merge relapse and urge weekly data
    let mut week_map: std::collections::BTreeMap<String, WeeklyRecovery> =
        std::collections::BTreeMap::new();

    for (week_start, count) in &relapse_weeks {
        week_map
            .entry(week_start.clone())
            .or_insert_with(|| WeeklyRecovery {
                week_start: week_start.clone(),
                relapses: 0,
                urges: 0,
                urges_resisted: 0,
            })
            .relapses = *count;
    }

    for (week_start, urges, resisted) in &urge_weeks {
        let entry = week_map
            .entry(week_start.clone())
            .or_insert_with(|| WeeklyRecovery {
                week_start: week_start.clone(),
                relapses: 0,
                urges: 0,
                urges_resisted: 0,
            });
        entry.urges = *urges;
        entry.urges_resisted = *resisted;
    }

    let weekly_data: Vec<WeeklyRecovery> = week_map.into_values().collect();

    Ok(RecoveryFrequency {
        relapse_count,
        urge_count,
        urges_resisted,
        weekly_data,
    })
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_score_trend(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<ScoreTrendPoint>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_score_trend_impl(&db, &start, &end)
}

#[tauri::command]
pub fn get_habit_completion_rates(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<HabitCompletionRate>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_habit_completion_rates_impl(&db, &start, &end)
}

#[tauri::command]
pub fn get_vice_frequency(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<ViceFrequency>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_vice_frequency_impl(&db, &start, &end)
}

#[tauri::command]
pub fn get_day_of_week_averages(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<DayOfWeekAvg>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_day_of_week_averages_impl(&db, &start, &end)
}

#[tauri::command]
pub fn get_correlation_data(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<DailyLog>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_correlation_data_impl(&db, &start, &end)
}

#[tauri::command]
pub fn get_study_summary(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<StudySummary> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_study_summary_impl(&db, &start, &end)
}

#[tauri::command]
pub fn get_application_pipeline(
    state: tauri::State<'_, AppState>,
) -> CommandResult<PipelineSummary> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_application_pipeline_impl(&db)
}

#[tauri::command]
pub fn get_recovery_frequency(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<RecoveryFrequency> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_recovery_frequency_impl(&db, &start, &end)
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

    /// Insert a minimal daily_log row for testing.
    fn insert_daily_log(conn: &Connection, date: &str, final_score: f64) {
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
             ?1, 1, 1, 0, 0, 1, 1, 0, 0, 'Good', 0, 1, 0, 'None', \
             0, 0, 0, 0, 0, 0, 0, 0, 0, \
             50.0, 0.0, 50.0, 1, ?2, ?3, ?4)",
            params![date, final_score, &now, &now],
        )
        .unwrap();
    }

    /// Insert a daily_log with custom habit values.
    fn insert_daily_log_with_habits(
        conn: &Connection,
        date: &str,
        final_score: f64,
        gym: i64,
        porn: i64,
    ) {
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
             ?1, 1, 0, 0, 0, ?3, 0, 0, 0, 'None', 0, 0, 0, 'None', \
             ?4, 0, 0, 0, 0, 0, 0, 0, 0, \
             50.0, 0.0, 50.0, 1, ?2, ?5, ?6)",
            params![date, final_score, gym, porn, &now, &now],
        )
        .unwrap();
    }

    fn insert_study_session(
        conn: &Connection,
        date: &str,
        subject: &str,
        duration_min: i64,
        focus: i64,
    ) {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, resources, notes, \
             logged_at, last_modified\
             ) VALUES (?1, ?2, 'Self-Study', '09:00', '11:00', \
             ?3, ?4, 'Library', '', '', '', ?5, ?6)",
            params![date, subject, duration_min, focus, &now, &now],
        )
        .unwrap();
    }

    fn insert_application(conn: &Connection, date: &str, status: &str) {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, current_status, \
             url, notes, salary, contact_name, contact_email, \
             login_username, login_password, archived, logged_at, last_modified\
             ) VALUES (?1, 'TestCo', 'Dev', 'LinkedIn', ?2, \
             '', '', '', '', '', '', '', 0, ?3, ?4)",
            params![date, status, &now, &now],
        )
        .unwrap();
    }

    // -----------------------------------------------------------------------
    // A. Score Trend
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_score_trend_empty() {
        let conn = setup_test_db();
        let result = get_score_trend_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_get_score_trend_moving_avg() {
        let conn = setup_test_db();

        // Insert 10 days of data
        for i in 1..=10 {
            let date = format!("2026-02-{:02}", i);
            insert_daily_log(&conn, &date, 50.0 + i as f64 * 5.0);
        }

        let result =
            get_score_trend_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(result.len(), 10);

        // First 6 days have no moving average
        for i in 0..6 {
            assert!(result[i].moving_avg_7d.is_none());
        }

        // Day 7 (index 6) should have moving average
        assert!(result[6].moving_avg_7d.is_some());
        // Average of days 1-7: (55+60+65+70+75+80+85) / 7 = 70.0
        assert!((result[6].moving_avg_7d.unwrap() - 70.0).abs() < 0.01);
    }

    // -----------------------------------------------------------------------
    // B. Habit Completion Rates
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_habit_completion_rates_empty() {
        let conn = setup_test_db();
        let result =
            get_habit_completion_rates_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_get_habit_completion_rates_with_data() {
        let conn = setup_test_db();

        // Day 1: gym=1, Day 2: gym=0
        insert_daily_log_with_habits(&conn, "2026-02-01", 70.0, 1, 0);
        insert_daily_log_with_habits(&conn, "2026-02-02", 60.0, 0, 0);

        let result =
            get_habit_completion_rates_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert!(!result.is_empty());

        let gym = result.iter().find(|h| h.habit_name == "gym").unwrap();
        assert_eq!(gym.days_completed, 1);
        assert_eq!(gym.total_days, 2);
        assert!((gym.rate - 0.5).abs() < 0.01);
    }

    // -----------------------------------------------------------------------
    // C. Vice Frequency
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_vice_frequency_counts_days_not_instances() {
        let conn = setup_test_db();

        // Day 1: porn=3 (3 instances), Day 2: porn=0
        insert_daily_log_with_habits(&conn, "2026-02-01", 70.0, 0, 3);
        insert_daily_log_with_habits(&conn, "2026-02-02", 80.0, 0, 0);

        let result =
            get_vice_frequency_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        let porn = result.iter().find(|v| v.vice_name == "porn").unwrap();

        // Counts days where porn > 0, not total instances
        assert_eq!(porn.frequency, 1);
        assert_eq!(porn.total_days, 2);
    }

    // -----------------------------------------------------------------------
    // D. Day of Week Averages
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_day_of_week_averages_monday_is_zero() {
        let conn = setup_test_db();

        // 2026-02-16 is a Monday
        insert_daily_log(&conn, "2026-02-16", 80.0);

        let result =
            get_day_of_week_averages_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].day, 0); // Monday = 0
        assert!((result[0].avg_score - 80.0).abs() < 0.01);
    }

    // -----------------------------------------------------------------------
    // E. Correlation Data
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_correlation_data_returns_raw_rows() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-02-01", 70.0);
        insert_daily_log(&conn, "2026-02-02", 80.0);

        let result =
            get_correlation_data_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].date, "2026-02-01");
        assert_eq!(result[1].date, "2026-02-02");
    }

    // -----------------------------------------------------------------------
    // F. Study Summary
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_study_summary_aggregation() {
        let conn = setup_test_db();

        insert_study_session(&conn, "2026-02-01", "Math", 120, 4);
        insert_study_session(&conn, "2026-02-02", "Physics", 60, 3);

        let result =
            get_study_summary_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(result.session_count, 2);
        assert!((result.total_hours - 3.0).abs() < 0.01); // 180 min
        assert!((result.avg_focus - 3.5).abs() < 0.01);
    }

    #[test]
    fn test_get_study_summary_hours_by_subject() {
        let conn = setup_test_db();

        insert_study_session(&conn, "2026-02-01", "Math", 120, 4);
        insert_study_session(&conn, "2026-02-02", "Math", 60, 3);
        insert_study_session(&conn, "2026-02-03", "Physics", 90, 5);

        let result =
            get_study_summary_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(result.hours_by_subject.len(), 2);
        // Math has more hours, should be first (DESC)
        assert_eq!(result.hours_by_subject[0].subject, "Math");
        assert!((result.hours_by_subject[0].hours - 3.0).abs() < 0.01);
        assert_eq!(result.hours_by_subject[1].subject, "Physics");
        assert!((result.hours_by_subject[1].hours - 1.5).abs() < 0.01);
    }

    // -----------------------------------------------------------------------
    // G. Application Pipeline
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_application_pipeline_groups_by_status() {
        let conn = setup_test_db();

        insert_application(&conn, "2026-02-01", "Applied");
        insert_application(&conn, "2026-02-02", "Applied");
        insert_application(&conn, "2026-02-03", "Interview");

        let result = get_application_pipeline_impl(&conn).unwrap();
        assert_eq!(result.stages.len(), 2);
        assert_eq!(result.stages[0].status, "Applied");
        assert_eq!(result.stages[0].count, 2);
        assert_eq!(result.stages[1].status, "Interview");
        assert_eq!(result.stages[1].count, 1);
    }

    // -----------------------------------------------------------------------
    // H. Recovery Frequency
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_recovery_frequency_totals() {
        let conn = setup_test_db();
        let now = chrono::Utc::now().to_rfc3339();

        // Insert relapses
        conn.execute(
            "INSERT INTO relapse_entry (\
             date, time, duration, trigger, location, device, \
             activity_before, emotional_state, resistance_technique, \
             urge_intensity, notes, created_at, last_modified\
             ) VALUES ('2026-02-16', '23:00', '< 5 min', 'Boredom', 'Bedroom', \
             'Phone', 'Scrolling', 'Stressed', 'None', 5, '', ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        // Insert urges (1 resisted, 1 not)
        conn.execute(
            "INSERT INTO urge_entry (\
             date, time, intensity, technique, effectiveness, \
             duration, did_pass, trigger, notes, created_at, last_modified\
             ) VALUES ('2026-02-16', '22:00', 6, 'Cold Shower', 4, \
             '5-15 min', 'Yes - completely', '', '', ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO urge_entry (\
             date, time, intensity, technique, effectiveness, \
             duration, did_pass, trigger, notes, created_at, last_modified\
             ) VALUES ('2026-02-17', '10:00', 4, 'Meditation', 3, \
             '1-5 min', 'No (but I resisted anyway)', '', '', ?1, ?2)",
            params![&now, &now],
        )
        .unwrap();

        let result =
            get_recovery_frequency_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(result.relapse_count, 1);
        assert_eq!(result.urge_count, 2);
        assert_eq!(result.urges_resisted, 1);
        assert!(!result.weekly_data.is_empty());
    }
}
