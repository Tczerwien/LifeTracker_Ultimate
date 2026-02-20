use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full milestone row returned to the frontend.
/// Field names and types must match the TypeScript `Milestone` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub category: String,
    pub threshold: String,
    pub achieved: bool,
    pub achieved_date: Option<String>,
    pub created_at: String,
}

/// Context passed from frontend with current stats for checking milestones.
/// The frontend is responsible for computing these values before calling check_milestones.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MilestoneContext {
    pub current_streak: i64,
    pub total_days_tracked: i64,
    pub total_study_hours: f64,
    pub total_applications: i64,
    pub consecutive_clean_days: i64,
    pub highest_score: f64,
    pub avg_score_7d: f64,
    pub high_focus_sessions: i64,
}

// ---------------------------------------------------------------------------
// Column Constants & Row Mapper
// ---------------------------------------------------------------------------

const MILESTONE_COLUMNS: &str = "\
    id, name, emoji, category, threshold, achieved, achieved_date, created_at";

fn row_to_milestone(row: &rusqlite::Row) -> rusqlite::Result<Milestone> {
    Ok(Milestone {
        id: row.get(0)?,
        name: row.get(1)?,
        emoji: row.get(2)?,
        category: row.get(3)?,
        threshold: row.get(4)?,
        achieved: row.get(5)?,
        achieved_date: row.get(6)?,
        created_at: row.get(7)?,
    })
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

fn query_all_milestones(conn: &Connection) -> CommandResult<Vec<Milestone>> {
    let sql = format!(
        "SELECT {} FROM milestone ORDER BY category, id",
        MILESTONE_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], row_to_milestone)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;
    Ok(rows)
}

/// Determine whether a milestone's threshold is met given the current context.
/// Returns true if the milestone should be marked as achieved.
///
/// Matching is based on milestone ID:
/// - tracking: first_steps, one_week_in → total_days_tracked
/// - score: streak_N → current_streak, avg_80 → avg_score_7d
/// - clean: clean_N → consecutive_clean_days
/// - study: first_session → total_study_hours > 0, study_Nh → total_study_hours, focus_master → high_focus_sessions
fn is_threshold_met(milestone_id: &str, ctx: &MilestoneContext) -> bool {
    match milestone_id {
        // Tracking milestones
        "first_steps" => ctx.total_days_tracked >= 1,
        "one_week_in" => ctx.total_days_tracked >= 7,

        // Score milestones
        "streak_5" => ctx.current_streak >= 5,
        "streak_7" => ctx.current_streak >= 7,
        "streak_30" => ctx.current_streak >= 30,
        "avg_80" => ctx.avg_score_7d >= 80.0,
        "trending_up" => {
            // Requires multi-month trend analysis beyond MilestoneContext scope.
            // Deferred to future implementation.
            false
        }

        // Clean streak milestones — parse number from id
        id if id.starts_with("clean_") => {
            if let Ok(days) = id.trim_start_matches("clean_").parse::<i64>() {
                ctx.consecutive_clean_days >= days
            } else {
                false
            }
        }

        // Study milestones
        "first_session" => ctx.total_study_hours > 0.0,
        "study_50h" => ctx.total_study_hours >= 50.0,
        "study_100h" => ctx.total_study_hours >= 100.0,
        "study_500h" => ctx.total_study_hours >= 500.0,
        "focus_master" => ctx.high_focus_sessions >= 10,

        // Unknown milestone ID — don't achieve
        _ => false,
    }
}

fn check_milestones_impl(
    conn: &Connection,
    context: &MilestoneContext,
) -> CommandResult<Vec<Milestone>> {
    // 1. Query all unachieved milestones
    let sql = format!(
        "SELECT {} FROM milestone WHERE achieved = 0",
        MILESTONE_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let unachieved: Vec<Milestone> = stmt
        .query_map([], row_to_milestone)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    let mut newly_achieved: Vec<Milestone> = Vec::new();

    // 2. Check each milestone
    for milestone in &unachieved {
        if is_threshold_met(&milestone.id, context) {
            // 3. One-way flip: achieved 0 → 1
            conn.execute(
                "UPDATE milestone SET achieved = 1, achieved_date = date('now') \
                 WHERE id = ?1",
                params![milestone.id],
            )?;

            // Read back the updated milestone
            let updated: Milestone = conn
                .query_row(
                    &format!(
                        "SELECT {} FROM milestone WHERE id = ?1",
                        MILESTONE_COLUMNS
                    ),
                    params![milestone.id],
                    row_to_milestone,
                )
                .map_err(CommandError::from)?;

            newly_achieved.push(updated);
        }
    }

    Ok(newly_achieved)
}

// ---------------------------------------------------------------------------
// Milestone Context Builder
// ---------------------------------------------------------------------------

/// Count consecutive clean days walking backwards from the most recent daily_log.
/// A clean day: porn = 0 AND masturbate = 0.
/// Streak breaks on: a day with porn > 0 OR masturbate > 0, OR a gap in dates.
fn compute_consecutive_clean_days(conn: &Connection) -> CommandResult<i64> {
    let mut stmt = conn.prepare(
        "SELECT date, porn, masturbate FROM daily_log ORDER BY date DESC",
    )?;
    let rows: Vec<(String, i64, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)?;

    if rows.is_empty() {
        return Ok(0);
    }

    let mut count: i64 = 0;
    let mut expected_date: Option<String> = None;

    for (date, porn, masturbate) in &rows {
        // Check date continuity
        if let Some(ref exp) = expected_date {
            if date != exp {
                break; // Gap in dates breaks the streak
            }
        }
        // Check if clean
        if *porn > 0 || *masturbate > 0 {
            break;
        }
        count += 1;
        // Compute previous day using SQLite date arithmetic
        let prev: String = conn
            .query_row("SELECT date(?1, '-1 day')", params![date], |row| row.get(0))
            .map_err(CommandError::from)?;
        expected_date = Some(prev);
    }

    Ok(count)
}

/// Compute all 8 MilestoneContext fields from the database in one call.
fn get_milestone_context_impl(conn: &Connection) -> CommandResult<MilestoneContext> {
    // 1. current_streak: from most recent scored daily_log
    let current_streak: i64 = conn
        .query_row(
            "SELECT COALESCE(streak, 0) FROM daily_log \
             WHERE final_score IS NOT NULL \
             ORDER BY date DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(0);

    // 2. total_days_tracked
    let total_days_tracked: i64 =
        conn.query_row("SELECT COUNT(*) FROM daily_log", [], |row| row.get(0))?;

    // 3. total_study_hours (stored as duration_minutes in study_session)
    let total_study_hours: f64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 FROM study_session",
        [],
        |row| row.get(0),
    )?;

    // 4. total_applications
    let total_applications: i64 =
        conn.query_row("SELECT COUNT(*) FROM application", [], |row| row.get(0))?;

    // 5. consecutive_clean_days
    let consecutive_clean_days = compute_consecutive_clean_days(conn)?;

    // 6. highest_score
    let highest_score: f64 = conn.query_row(
        "SELECT COALESCE(MAX(final_score), 0.0) FROM daily_log",
        [],
        |row| row.get(0),
    )?;

    // 7. avg_score_7d: average of last 7 scored days
    let avg_score_7d: f64 = conn.query_row(
        "SELECT COALESCE(AVG(final_score), 0.0) FROM ( \
             SELECT final_score FROM daily_log \
             WHERE final_score IS NOT NULL \
             ORDER BY date DESC LIMIT 7 \
         )",
        [],
        |row| row.get(0),
    )?;

    // 8. high_focus_sessions: study sessions with focus_score >= 4
    let high_focus_sessions: i64 = conn.query_row(
        "SELECT COUNT(*) FROM study_session WHERE focus_score >= 4",
        [],
        |row| row.get(0),
    )?;

    Ok(MilestoneContext {
        current_streak,
        total_days_tracked,
        total_study_hours,
        total_applications,
        consecutive_clean_days,
        highest_score,
        avg_score_7d,
        high_focus_sessions,
    })
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_milestone_context(
    state: tauri::State<'_, AppState>,
) -> CommandResult<MilestoneContext> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_milestone_context_impl(&db)
}

#[tauri::command]
pub fn get_milestones(
    state: tauri::State<'_, AppState>,
) -> CommandResult<Vec<Milestone>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_all_milestones(&db)
}

#[tauri::command]
pub fn check_milestones(
    state: tauri::State<'_, AppState>,
    context: MilestoneContext,
) -> CommandResult<Vec<Milestone>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    check_milestones_impl(&db, &context)
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

    fn make_empty_context() -> MilestoneContext {
        MilestoneContext {
            current_streak: 0,
            total_days_tracked: 0,
            total_study_hours: 0.0,
            total_applications: 0,
            consecutive_clean_days: 0,
            highest_score: 0.0,
            avg_score_7d: 0.0,
            high_focus_sessions: 0,
        }
    }

    // -----------------------------------------------------------------------
    // A. get_milestones tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_milestones_returns_seed_data() {
        let conn = setup_test_db();
        let milestones = query_all_milestones(&conn).unwrap();
        assert_eq!(milestones.len(), 20);

        // All should be unachieved initially
        for m in &milestones {
            assert!(!m.achieved);
            assert!(m.achieved_date.is_none());
        }
    }

    #[test]
    fn test_get_milestones_ordered_by_category_and_id() {
        let conn = setup_test_db();
        let milestones = query_all_milestones(&conn).unwrap();

        // Categories should be alphabetically ordered: clean, score, study, tracking
        let categories: Vec<&str> =
            milestones.iter().map(|m| m.category.as_str()).collect();
        let mut sorted = categories.clone();
        sorted.sort();
        assert_eq!(categories, sorted);
    }

    // -----------------------------------------------------------------------
    // B. check_milestones tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_check_milestones_no_context_no_achievements() {
        let conn = setup_test_db();
        let context = make_empty_context();
        let result = check_milestones_impl(&conn, &context).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_check_milestones_first_steps() {
        let conn = setup_test_db();
        let mut context = make_empty_context();
        context.total_days_tracked = 1;

        let result = check_milestones_impl(&conn, &context).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "first_steps");
        assert!(result[0].achieved);
        assert!(result[0].achieved_date.is_some());
    }

    #[test]
    fn test_check_milestones_one_way_flip() {
        let conn = setup_test_db();

        // First check: achieve first_steps
        let mut context = make_empty_context();
        context.total_days_tracked = 1;
        let result = check_milestones_impl(&conn, &context).unwrap();
        assert_eq!(result.len(), 1);

        // Second check with lower context: should return empty (already achieved)
        let context2 = make_empty_context();
        let result2 = check_milestones_impl(&conn, &context2).unwrap();
        assert!(result2.is_empty());

        // Verify it's still achieved in the DB
        let milestones = query_all_milestones(&conn).unwrap();
        let first_steps = milestones.iter().find(|m| m.id == "first_steps").unwrap();
        assert!(first_steps.achieved);
    }

    #[test]
    fn test_check_milestones_returns_only_new() {
        let conn = setup_test_db();

        // Achieve first_steps
        let mut context1 = make_empty_context();
        context1.total_days_tracked = 1;
        check_milestones_impl(&conn, &context1).unwrap();

        // Now check with 7 days — should only return one_week_in, not first_steps again
        let mut context2 = make_empty_context();
        context2.total_days_tracked = 7;
        let result = check_milestones_impl(&conn, &context2).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "one_week_in");
    }

    #[test]
    fn test_check_milestones_clean_streak() {
        let conn = setup_test_db();
        let mut context = make_empty_context();
        context.consecutive_clean_days = 7;

        let result = check_milestones_impl(&conn, &context).unwrap();
        let ids: Vec<&str> = result.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"clean_1"));
        assert!(ids.contains(&"clean_7"));
        assert!(!ids.contains(&"clean_14"));
    }

    #[test]
    fn test_check_milestones_study_hours() {
        let conn = setup_test_db();
        let mut context = make_empty_context();
        context.total_study_hours = 55.0;

        let result = check_milestones_impl(&conn, &context).unwrap();
        let ids: Vec<&str> = result.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"first_session"));
        assert!(ids.contains(&"study_50h"));
        assert!(!ids.contains(&"study_100h"));
    }

    #[test]
    fn test_check_milestones_streak() {
        let conn = setup_test_db();
        let mut context = make_empty_context();
        context.current_streak = 7;

        let result = check_milestones_impl(&conn, &context).unwrap();
        let ids: Vec<&str> = result.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"streak_5"));
        assert!(ids.contains(&"streak_7"));
        assert!(!ids.contains(&"streak_30"));
    }

    #[test]
    fn test_check_milestones_focus_master() {
        let conn = setup_test_db();
        let mut context = make_empty_context();
        context.high_focus_sessions = 10;

        let result = check_milestones_impl(&conn, &context).unwrap();
        let ids: Vec<&str> = result.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"focus_master"));
    }

    #[test]
    fn test_check_milestones_multiple_categories() {
        let conn = setup_test_db();
        let mut context = make_empty_context();
        context.total_days_tracked = 1;
        context.consecutive_clean_days = 1;
        context.total_study_hours = 1.0;

        let result = check_milestones_impl(&conn, &context).unwrap();
        let ids: Vec<&str> = result.iter().map(|m| m.id.as_str()).collect();
        assert!(ids.contains(&"first_steps")); // tracking
        assert!(ids.contains(&"clean_1")); // clean
        assert!(ids.contains(&"first_session")); // study
    }

    // -----------------------------------------------------------------------
    // C. get_milestone_context tests
    // -----------------------------------------------------------------------

    /// Insert a minimal daily_log row for milestone context tests.
    fn insert_daily_log(
        conn: &Connection,
        date: &str,
        streak: i64,
        final_score: f64,
        porn: i64,
        masturbate: i64,
    ) {
        let now = "2026-01-20T00:00:00Z";
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
             ?4, ?5, 0, 0, 0, 0, 0, 0, 0, \
             50.0, 0.0, 50.0, ?2, ?3, ?6, ?7)",
            params![date, streak, final_score, porn, masturbate, now, now],
        )
        .unwrap();
    }

    fn insert_study_session(
        conn: &Connection,
        date: &str,
        duration_min: i64,
        focus: i64,
    ) {
        let now = "2026-01-20T00:00:00Z";
        conn.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, resources, notes, \
             logged_at, last_modified\
             ) VALUES (?1, 'Math', 'Self-Study', '09:00', '11:00', \
             ?2, ?3, 'Library', '', '', '', ?4, ?5)",
            params![date, duration_min, focus, now, now],
        )
        .unwrap();
    }

    fn insert_application(conn: &Connection, date: &str) {
        let now = "2026-01-20T00:00:00Z";
        conn.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, current_status, \
             url, notes, salary, contact_name, contact_email, \
             login_username, login_password, archived, logged_at, last_modified\
             ) VALUES (?1, 'TestCo', 'Dev', 'LinkedIn', 'applied', \
             '', '', '', '', '', '', '', 0, ?2, ?3)",
            params![date, now, now],
        )
        .unwrap();
    }

    #[test]
    fn test_get_milestone_context_empty_db() {
        let conn = setup_test_db();
        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert_eq!(ctx.current_streak, 0);
        assert_eq!(ctx.total_days_tracked, 0);
        assert!((ctx.total_study_hours - 0.0).abs() < f64::EPSILON);
        assert_eq!(ctx.total_applications, 0);
        assert_eq!(ctx.consecutive_clean_days, 0);
        assert!((ctx.highest_score - 0.0).abs() < f64::EPSILON);
        assert!((ctx.avg_score_7d - 0.0).abs() < f64::EPSILON);
        assert_eq!(ctx.high_focus_sessions, 0);
    }

    #[test]
    fn test_get_milestone_context_total_days_tracked() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-01-01", 1, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-02", 2, 85.0, 0, 0);
        insert_daily_log(&conn, "2026-01-03", 3, 90.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert_eq!(ctx.total_days_tracked, 3);
    }

    #[test]
    fn test_get_milestone_context_current_streak() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-01-01", 1, 70.0, 0, 0);
        insert_daily_log(&conn, "2026-01-02", 2, 75.0, 0, 0);
        insert_daily_log(&conn, "2026-01-03", 3, 80.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        // Most recent by date DESC is 2026-01-03 with streak = 3
        assert_eq!(ctx.current_streak, 3);
    }

    #[test]
    fn test_get_milestone_context_study_hours() {
        let conn = setup_test_db();
        // 120 + 60 = 180 minutes = 3.0 hours
        insert_study_session(&conn, "2026-01-01", 120, 3);
        insert_study_session(&conn, "2026-01-02", 60, 5);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert!((ctx.total_study_hours - 3.0).abs() < 0.001);
    }

    #[test]
    fn test_get_milestone_context_applications() {
        let conn = setup_test_db();
        insert_application(&conn, "2026-01-01");
        insert_application(&conn, "2026-01-02");

        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert_eq!(ctx.total_applications, 2);
    }

    #[test]
    fn test_get_milestone_context_consecutive_clean_days() {
        let conn = setup_test_db();
        // 5 consecutive clean days
        insert_daily_log(&conn, "2026-01-01", 1, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-02", 2, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-03", 3, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-04", 4, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-05", 5, 80.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert_eq!(ctx.consecutive_clean_days, 5);
    }

    #[test]
    fn test_get_milestone_context_clean_days_breaks_on_vice() {
        let conn = setup_test_db();
        // 3 clean, then 1 with porn, then 2 more clean
        insert_daily_log(&conn, "2026-01-01", 1, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-02", 2, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-03", 3, 80.0, 1, 0); // vice!
        insert_daily_log(&conn, "2026-01-04", 1, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-05", 2, 80.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        // Walking from most recent (01-05): clean, clean, then 01-03 has porn=1 → breaks
        assert_eq!(ctx.consecutive_clean_days, 2);
    }

    #[test]
    fn test_get_milestone_context_clean_days_breaks_on_gap() {
        let conn = setup_test_db();
        // 3 consecutive clean days, then a gap, then another clean day
        insert_daily_log(&conn, "2026-01-01", 1, 80.0, 0, 0);
        // gap: 2026-01-02 missing
        insert_daily_log(&conn, "2026-01-03", 1, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-04", 2, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-05", 3, 80.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        // Walking from 01-05: clean. 01-04: clean. 01-03: clean. Expected prev = 01-02 but missing → gap
        assert_eq!(ctx.consecutive_clean_days, 3);
    }

    #[test]
    fn test_get_milestone_context_clean_days_breaks_on_masturbate() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-01-01", 1, 80.0, 0, 0);
        insert_daily_log(&conn, "2026-01-02", 2, 80.0, 0, 1); // masturbate!
        insert_daily_log(&conn, "2026-01-03", 1, 80.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        // Walking from 01-03: clean. 01-02: masturbate=1 → breaks
        assert_eq!(ctx.consecutive_clean_days, 1);
    }

    #[test]
    fn test_get_milestone_context_highest_score() {
        let conn = setup_test_db();
        insert_daily_log(&conn, "2026-01-01", 1, 60.0, 0, 0);
        insert_daily_log(&conn, "2026-01-02", 2, 95.0, 0, 0);
        insert_daily_log(&conn, "2026-01-03", 3, 70.0, 0, 0);

        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert!((ctx.highest_score - 95.0).abs() < 0.001);
    }

    #[test]
    fn test_get_milestone_context_avg_score_7d() {
        let conn = setup_test_db();
        // Insert 10 days — avg should be over the last 7 (days 4–10)
        for i in 1..=10 {
            let date = format!("2026-01-{:02}", i);
            insert_daily_log(&conn, &date, i, (70 + i) as f64, 0, 0);
        }

        let ctx = get_milestone_context_impl(&conn).unwrap();
        // Last 7 by date DESC: 80, 79, 78, 77, 76, 75, 74 → avg = 77.0
        assert!((ctx.avg_score_7d - 77.0).abs() < 0.001);
    }

    #[test]
    fn test_get_milestone_context_high_focus_sessions() {
        let conn = setup_test_db();
        insert_study_session(&conn, "2026-01-01", 60, 3); // not high focus
        insert_study_session(&conn, "2026-01-02", 90, 4); // high focus
        insert_study_session(&conn, "2026-01-03", 45, 5); // high focus
        insert_study_session(&conn, "2026-01-04", 30, 2); // not high focus

        let ctx = get_milestone_context_impl(&conn).unwrap();
        assert_eq!(ctx.high_focus_sessions, 2);
    }
}
