use rusqlite::{params, Connection};
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
// Tauri Commands
// ---------------------------------------------------------------------------

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
}
