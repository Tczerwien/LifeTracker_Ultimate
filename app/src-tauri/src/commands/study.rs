use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full study session row returned to the frontend.
/// Field names and types must match the TypeScript `StudySession` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudySession {
    pub id: i64,
    pub date: String,
    pub subject: String,
    pub study_type: String,
    pub start_time: String,
    pub end_time: String,
    pub duration_minutes: i64,
    pub focus_score: i64,
    pub location: String,
    pub topic: String,
    pub resources: String,
    pub notes: String,
    pub logged_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving/updating a study session.
/// Contains only user-editable fields — no id or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudySessionInput {
    pub date: String,
    pub subject: String,
    pub study_type: String,
    pub start_time: String,
    pub end_time: String,
    pub duration_minutes: i64,
    pub focus_score: i64,
    pub location: String,
    pub topic: String,
    pub resources: String,
    pub notes: String,
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const STUDY_SESSION_COLUMNS: &str = "\
    id, date, subject, study_type, start_time, end_time, \
    duration_minutes, focus_score, location, topic, \
    resources, notes, logged_at, last_modified";

fn row_to_study_session(row: &rusqlite::Row) -> rusqlite::Result<StudySession> {
    Ok(StudySession {
        id: row.get(0)?,
        date: row.get(1)?,
        subject: row.get(2)?,
        study_type: row.get(3)?,
        start_time: row.get(4)?,
        end_time: row.get(5)?,
        duration_minutes: row.get(6)?,
        focus_score: row.get(7)?,
        location: row.get(8)?,
        topic: row.get(9)?,
        resources: row.get(10)?,
        notes: row.get(11)?,
        logged_at: row.get(12)?,
        last_modified: row.get(13)?,
    })
}

fn query_study_session_by_id(
    conn: &Connection,
    id: i64,
) -> CommandResult<Option<StudySession>> {
    let sql = format!(
        "SELECT {} FROM study_session WHERE id = ?1",
        STUDY_SESSION_COLUMNS
    );
    conn.query_row(&sql, [id], row_to_study_session)
        .optional()
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_study_sessions(
    state: tauri::State<'_, AppState>,
    date: String,
) -> CommandResult<Vec<StudySession>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    let sql = format!(
        "SELECT {} FROM study_session WHERE date = ?1 ORDER BY start_time ASC",
        STUDY_SESSION_COLUMNS
    );
    let mut stmt = db.prepare(&sql)?;
    let rows = stmt.query_map(params![date], row_to_study_session)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_study_sessions_range(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<StudySession>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    let sql = format!(
        "SELECT {} FROM study_session WHERE date >= ?1 AND date <= ?2 \
         ORDER BY date ASC, start_time ASC",
        STUDY_SESSION_COLUMNS
    );
    let mut stmt = db.prepare(&sql)?;
    let rows = stmt.query_map(params![start, end], row_to_study_session)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn save_study_session(
    state: tauri::State<'_, AppState>,
    session: StudySessionInput,
) -> CommandResult<StudySession> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "INSERT INTO study_session (\
         date, subject, study_type, start_time, end_time, \
         duration_minutes, focus_score, location, topic, \
         resources, notes, logged_at, last_modified\
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            session.date,
            session.subject,
            session.study_type,
            session.start_time,
            session.end_time,
            session.duration_minutes,
            session.focus_score,
            session.location,
            session.topic,
            session.resources,
            session.notes,
            &now,
            &now,
        ],
    )?;

    let id = db.last_insert_rowid();
    query_study_session_by_id(&db, id)?
        .ok_or_else(|| CommandError::from("Failed to read back saved study session"))
}

#[tauri::command]
pub fn update_study_session(
    state: tauri::State<'_, AppState>,
    id: i64,
    session: StudySessionInput,
) -> CommandResult<StudySession> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;

    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = db.execute(
        "UPDATE study_session SET \
         date = ?2, subject = ?3, study_type = ?4, \
         start_time = ?5, end_time = ?6, duration_minutes = ?7, \
         focus_score = ?8, location = ?9, topic = ?10, \
         resources = ?11, notes = ?12, last_modified = ?13 \
         WHERE id = ?1",
        params![
            id,
            session.date,
            session.subject,
            session.study_type,
            session.start_time,
            session.end_time,
            session.duration_minutes,
            session.focus_score,
            session.location,
            session.topic,
            session.resources,
            session.notes,
            &now,
        ],
    )?;

    if rows_affected == 0 {
        return Err(CommandError::from(format!(
            "Study session with id {} not found",
            id
        )));
    }

    query_study_session_by_id(&db, id)?
        .ok_or_else(|| CommandError::from("Failed to read back updated study session"))
}

#[tauri::command]
pub fn delete_study_session(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> CommandResult<()> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;

    let rows_affected = db.execute(
        "DELETE FROM study_session WHERE id = ?1",
        [id],
    )?;

    if rows_affected == 0 {
        return Err(CommandError::from(format!(
            "Study session with id {} not found",
            id
        )));
    }

    Ok(())
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
        run_migrations(&mut conn).expect("Migration should succeed");
        conn
    }

    fn make_default_session_input(date: &str) -> StudySessionInput {
        StudySessionInput {
            date: date.to_string(),
            subject: "Quantum Computing".to_string(),
            study_type: "Self-Study".to_string(),
            start_time: "09:00".to_string(),
            end_time: "10:30".to_string(),
            duration_minutes: 90,
            focus_score: 4,
            location: "Library".to_string(),
            topic: String::new(),
            resources: String::new(),
            notes: String::new(),
        }
    }

    /// Insert a raw study_session row for testing query commands.
    fn insert_raw_session(
        conn: &Connection,
        date: &str,
        subject: &str,
        start_time: &str,
        end_time: &str,
        duration_minutes: i64,
    ) {
        conn.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, \
             resources, notes, logged_at, last_modified\
             ) VALUES (?1, ?2, 'Self-Study', ?3, ?4, ?5, 4, 'Library', '', '', '', \
             '2026-01-20T00:00:00+00:00', '2026-01-20T00:00:00+00:00')",
            params![date, subject, start_time, end_time, duration_minutes],
        )
        .unwrap();
    }

    /// Duplicate of save_study_session logic using a raw Connection (no tauri::State).
    fn save_study_session_direct(
        conn: &Connection,
        session: StudySessionInput,
    ) -> CommandResult<StudySession> {
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, \
             resources, notes, logged_at, last_modified\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                session.date,
                session.subject,
                session.study_type,
                session.start_time,
                session.end_time,
                session.duration_minutes,
                session.focus_score,
                session.location,
                session.topic,
                session.resources,
                session.notes,
                &now,
                &now,
            ],
        )?;

        let id = conn.last_insert_rowid();
        query_study_session_by_id(conn, id)?
            .ok_or_else(|| CommandError::from("Failed to read back saved study session"))
    }

    /// Duplicate of update_study_session logic using a raw Connection.
    fn update_study_session_direct(
        conn: &Connection,
        id: i64,
        session: StudySessionInput,
    ) -> CommandResult<StudySession> {
        let now = chrono::Utc::now().to_rfc3339();

        let rows_affected = conn.execute(
            "UPDATE study_session SET \
             date = ?2, subject = ?3, study_type = ?4, \
             start_time = ?5, end_time = ?6, duration_minutes = ?7, \
             focus_score = ?8, location = ?9, topic = ?10, \
             resources = ?11, notes = ?12, last_modified = ?13 \
             WHERE id = ?1",
            params![
                id,
                session.date,
                session.subject,
                session.study_type,
                session.start_time,
                session.end_time,
                session.duration_minutes,
                session.focus_score,
                session.location,
                session.topic,
                session.resources,
                session.notes,
                &now,
            ],
        )?;

        if rows_affected == 0 {
            return Err(CommandError::from(format!(
                "Study session with id {} not found",
                id
            )));
        }

        query_study_session_by_id(conn, id)?
            .ok_or_else(|| CommandError::from("Failed to read back updated study session"))
    }

    /// Duplicate of delete_study_session logic using a raw Connection.
    fn delete_study_session_direct(conn: &Connection, id: i64) -> CommandResult<()> {
        let rows_affected = conn.execute(
            "DELETE FROM study_session WHERE id = ?1",
            [id],
        )?;

        if rows_affected == 0 {
            return Err(CommandError::from(format!(
                "Study session with id {} not found",
                id
            )));
        }

        Ok(())
    }

    /// Helper to query sessions by date (bypasses tauri::State).
    fn get_sessions_by_date(conn: &Connection, date: &str) -> Vec<StudySession> {
        let sql = format!(
            "SELECT {} FROM study_session WHERE date = ?1 ORDER BY start_time ASC",
            STUDY_SESSION_COLUMNS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        stmt.query_map(params![date], row_to_study_session)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    /// Helper to query sessions by date range (bypasses tauri::State).
    fn get_sessions_range(conn: &Connection, start: &str, end: &str) -> Vec<StudySession> {
        let sql = format!(
            "SELECT {} FROM study_session WHERE date >= ?1 AND date <= ?2 \
             ORDER BY date ASC, start_time ASC",
            STUDY_SESSION_COLUMNS
        );
        let mut stmt = conn.prepare(&sql).unwrap();
        stmt.query_map(params![start, end], row_to_study_session)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    // -------------------------------------------------------------------
    // Row Mapper Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_row_mapper_round_trip() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO study_session (\
             date, subject, study_type, start_time, end_time, \
             duration_minutes, focus_score, location, topic, \
             resources, notes, logged_at, last_modified\
             ) VALUES (\
             '2026-02-10', 'Physics', 'Lecture', '14:00', '15:30', \
             90, 5, 'Campus', 'Thermodynamics', 'Textbook Ch.5', 'Good session', \
             '2026-02-10T16:00:00+00:00', '2026-02-10T16:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let id = conn.last_insert_rowid();
        let s = query_study_session_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(s.date, "2026-02-10");
        assert_eq!(s.subject, "Physics");
        assert_eq!(s.study_type, "Lecture");
        assert_eq!(s.start_time, "14:00");
        assert_eq!(s.end_time, "15:30");
        assert_eq!(s.duration_minutes, 90);
        assert_eq!(s.focus_score, 5);
        assert_eq!(s.location, "Campus");
        assert_eq!(s.topic, "Thermodynamics");
        assert_eq!(s.resources, "Textbook Ch.5");
        assert_eq!(s.notes, "Good session");
        assert_eq!(s.logged_at, "2026-02-10T16:00:00+00:00");
        assert_eq!(s.last_modified, "2026-02-10T16:00:00+00:00");
    }

    #[test]
    fn test_row_mapper_empty_optional_fields() {
        let conn = setup_test_db();
        insert_raw_session(&conn, "2026-02-10", "Math", "09:00", "10:00", 60);

        let id = conn.last_insert_rowid();
        let s = query_study_session_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(s.topic, "");
        assert_eq!(s.resources, "");
        assert_eq!(s.notes, "");
    }

    // -------------------------------------------------------------------
    // get_study_sessions Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_get_sessions_empty_date() {
        let conn = setup_test_db();
        let sessions = get_sessions_by_date(&conn, "2099-01-01");
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_get_sessions_multiple() {
        let conn = setup_test_db();
        insert_raw_session(&conn, "2026-02-10", "Math", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-10", "Physics", "11:00", "12:00", 60);
        insert_raw_session(&conn, "2026-02-10", "CS", "14:00", "15:30", 90);

        let sessions = get_sessions_by_date(&conn, "2026-02-10");
        assert_eq!(sessions.len(), 3);
    }

    #[test]
    fn test_get_sessions_ordered_by_start_time() {
        let conn = setup_test_db();
        // Insert out of order
        insert_raw_session(&conn, "2026-02-10", "CS", "14:00", "15:30", 90);
        insert_raw_session(&conn, "2026-02-10", "Math", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-10", "Physics", "11:30", "12:30", 60);

        let sessions = get_sessions_by_date(&conn, "2026-02-10");
        assert_eq!(sessions.len(), 3);
        assert_eq!(sessions[0].start_time, "09:00");
        assert_eq!(sessions[1].start_time, "11:30");
        assert_eq!(sessions[2].start_time, "14:00");
    }

    #[test]
    fn test_get_sessions_filters_by_date() {
        let conn = setup_test_db();
        insert_raw_session(&conn, "2026-02-10", "Math", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-11", "Physics", "09:00", "10:00", 60);

        let sessions = get_sessions_by_date(&conn, "2026-02-10");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].subject, "Math");
    }

    // -------------------------------------------------------------------
    // get_study_sessions_range Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_get_range_empty() {
        let conn = setup_test_db();
        let sessions = get_sessions_range(&conn, "2099-01-01", "2099-12-31");
        assert!(sessions.is_empty());
    }

    #[test]
    fn test_get_range_inclusive_boundaries() {
        let conn = setup_test_db();
        insert_raw_session(&conn, "2026-02-09", "Before", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-10", "Start", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-12", "End", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-13", "After", "09:00", "10:00", 60);

        let sessions = get_sessions_range(&conn, "2026-02-10", "2026-02-12");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].subject, "Start");
        assert_eq!(sessions[1].subject, "End");
    }

    #[test]
    fn test_get_range_ordered_by_date_then_time() {
        let conn = setup_test_db();
        insert_raw_session(&conn, "2026-02-11", "Afternoon", "14:00", "15:00", 60);
        insert_raw_session(&conn, "2026-02-10", "Late", "11:00", "12:00", 60);
        insert_raw_session(&conn, "2026-02-11", "Morning", "09:00", "10:00", 60);
        insert_raw_session(&conn, "2026-02-10", "Early", "08:00", "09:00", 60);

        let sessions = get_sessions_range(&conn, "2026-02-10", "2026-02-11");
        assert_eq!(sessions.len(), 4);
        assert_eq!(sessions[0].date, "2026-02-10");
        assert_eq!(sessions[0].start_time, "08:00");
        assert_eq!(sessions[1].date, "2026-02-10");
        assert_eq!(sessions[1].start_time, "11:00");
        assert_eq!(sessions[2].date, "2026-02-11");
        assert_eq!(sessions[2].start_time, "09:00");
        assert_eq!(sessions[3].date, "2026-02-11");
        assert_eq!(sessions[3].start_time, "14:00");
    }

    // -------------------------------------------------------------------
    // save_study_session Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_save_new_session() {
        let conn = setup_test_db();
        let input = StudySessionInput {
            date: "2026-02-18".to_string(),
            subject: "Algorithms".to_string(),
            study_type: "Self-Study".to_string(),
            start_time: "10:00".to_string(),
            end_time: "11:30".to_string(),
            duration_minutes: 90,
            focus_score: 5,
            location: "Home".to_string(),
            topic: "Dynamic Programming".to_string(),
            resources: "CLRS Ch.15".to_string(),
            notes: "Covered memoization".to_string(),
        };

        let s = save_study_session_direct(&conn, input).unwrap();
        assert!(s.id > 0);
        assert_eq!(s.date, "2026-02-18");
        assert_eq!(s.subject, "Algorithms");
        assert_eq!(s.study_type, "Self-Study");
        assert_eq!(s.start_time, "10:00");
        assert_eq!(s.end_time, "11:30");
        assert_eq!(s.duration_minutes, 90);
        assert_eq!(s.focus_score, 5);
        assert_eq!(s.location, "Home");
        assert_eq!(s.topic, "Dynamic Programming");
        assert_eq!(s.resources, "CLRS Ch.15");
        assert_eq!(s.notes, "Covered memoization");
        assert_eq!(s.logged_at, s.last_modified);
    }

    #[test]
    fn test_save_multiple_same_date() {
        let conn = setup_test_db();

        let s1 = save_study_session_direct(&conn, make_default_session_input("2026-02-18")).unwrap();
        let s2 = save_study_session_direct(&conn, make_default_session_input("2026-02-18")).unwrap();

        assert_ne!(s1.id, s2.id, "each session must get a unique id");

        let sessions = get_sessions_by_date(&conn, "2026-02-18");
        assert_eq!(sessions.len(), 2);
    }

    #[test]
    fn test_save_session_return_matches_db() {
        let conn = setup_test_db();
        let returned = save_study_session_direct(&conn, make_default_session_input("2026-02-18")).unwrap();

        let from_db = query_study_session_by_id(&conn, returned.id).unwrap().unwrap();
        assert_eq!(returned.id, from_db.id);
        assert_eq!(returned.subject, from_db.subject);
        assert_eq!(returned.duration_minutes, from_db.duration_minutes);
        assert_eq!(returned.logged_at, from_db.logged_at);
        assert_eq!(returned.last_modified, from_db.last_modified);
    }

    // -------------------------------------------------------------------
    // update_study_session Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_update_existing_session() {
        let conn = setup_test_db();
        let s = save_study_session_direct(&conn, make_default_session_input("2026-02-18")).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let updated_input = StudySessionInput {
            date: "2026-02-18".to_string(),
            subject: "Linear Algebra".to_string(),
            study_type: "Lab Work".to_string(),
            start_time: "13:00".to_string(),
            end_time: "14:00".to_string(),
            duration_minutes: 60,
            focus_score: 3,
            location: "Campus".to_string(),
            topic: "Eigenvalues".to_string(),
            resources: "Notes".to_string(),
            notes: "Tricky".to_string(),
        };

        let updated = update_study_session_direct(&conn, s.id, updated_input).unwrap();
        assert_eq!(updated.id, s.id);
        assert_eq!(updated.subject, "Linear Algebra");
        assert_eq!(updated.study_type, "Lab Work");
        assert_eq!(updated.start_time, "13:00");
        assert_eq!(updated.duration_minutes, 60);
        assert_eq!(updated.focus_score, 3);
        assert_eq!(updated.topic, "Eigenvalues");
    }

    #[test]
    fn test_update_preserves_logged_at() {
        let conn = setup_test_db();
        let s = save_study_session_direct(&conn, make_default_session_input("2026-02-18")).unwrap();
        let original_logged_at = s.logged_at.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let updated = update_study_session_direct(&conn, s.id, make_default_session_input("2026-02-18")).unwrap();
        assert_eq!(updated.logged_at, original_logged_at, "logged_at must not change on update");
        assert_ne!(updated.last_modified, original_logged_at, "last_modified must change on update");
    }

    #[test]
    fn test_update_nonexistent_id() {
        let conn = setup_test_db();
        let result = update_study_session_direct(&conn, 99999, make_default_session_input("2026-02-18"));
        assert!(result.is_err());
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("99999"), "error should mention the id");
    }

    // -------------------------------------------------------------------
    // delete_study_session Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_delete_existing_session() {
        let conn = setup_test_db();
        let s = save_study_session_direct(&conn, make_default_session_input("2026-02-18")).unwrap();

        let result = delete_study_session_direct(&conn, s.id);
        assert!(result.is_ok());

        let sessions = get_sessions_by_date(&conn, "2026-02-18");
        assert!(sessions.is_empty(), "session should be gone after delete");
    }

    #[test]
    fn test_delete_nonexistent_id() {
        let conn = setup_test_db();
        let result = delete_study_session_direct(&conn, 99999);
        assert!(result.is_err());
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("99999"), "error should mention the id");
    }

    #[test]
    fn test_save_validates_focus_score_range() {
        let conn = setup_test_db();

        let mut input = make_default_session_input("2026-02-18");
        input.focus_score = 0;
        let result = save_study_session_direct(&conn, input);
        assert!(result.is_err(), "focus_score=0 should be rejected by CHECK constraint");

        let mut input = make_default_session_input("2026-02-19");
        input.focus_score = 6;
        let result = save_study_session_direct(&conn, input);
        assert!(result.is_err(), "focus_score=6 should be rejected by CHECK constraint");
    }
}
