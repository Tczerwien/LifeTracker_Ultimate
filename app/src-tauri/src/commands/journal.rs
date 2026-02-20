use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full journal row returned to the frontend.
/// Field names and types must match the TypeScript `Journal` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Journal {
    pub id: i64,
    pub date: String,
    pub mood: i64,
    pub energy: i64,
    pub highlight: String,
    pub gratitude: String,
    pub reflection: String,
    pub tomorrow_goal: String,
    pub logged_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving a journal entry.
/// Contains only user-editable fields — no id or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalInput {
    pub date: String,
    pub mood: i64,
    pub energy: i64,
    pub highlight: String,
    pub gratitude: String,
    pub reflection: String,
    pub tomorrow_goal: String,
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const JOURNAL_COLUMNS: &str = "\
    id, date, mood, energy, highlight, gratitude, \
    reflection, tomorrow_goal, logged_at, last_modified";

fn row_to_journal(row: &rusqlite::Row) -> rusqlite::Result<Journal> {
    Ok(Journal {
        id: row.get(0)?,
        date: row.get(1)?,
        mood: row.get(2)?,
        energy: row.get(3)?,
        highlight: row.get(4)?,
        gratitude: row.get(5)?,
        reflection: row.get(6)?,
        tomorrow_goal: row.get(7)?,
        logged_at: row.get(8)?,
        last_modified: row.get(9)?,
    })
}

fn query_journal_by_date(conn: &Connection, date: &str) -> CommandResult<Option<Journal>> {
    let sql = format!(
        "SELECT {} FROM journal WHERE date = ?1",
        JOURNAL_COLUMNS
    );
    conn.query_row(&sql, [date], row_to_journal)
        .optional()
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_journal(
    state: tauri::State<'_, AppState>,
    date: String,
) -> CommandResult<Option<Journal>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_journal_by_date(&db, &date)
}

#[tauri::command]
pub fn save_journal(
    state: tauri::State<'_, AppState>,
    entry: JournalInput,
) -> CommandResult<Journal> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;

    {
        let tx = db
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        let existing: Option<(i64, String)> = tx
            .query_row(
                "SELECT id, logged_at FROM journal WHERE date = ?1",
                [&entry.date],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        let now = chrono::Utc::now().to_rfc3339();
        let logged_at = match &existing {
            Some((_, original_logged_at)) => original_logged_at.clone(),
            None => now.clone(),
        };

        if existing.is_some() {
            tx.execute(
                "UPDATE journal SET \
                 mood = ?2, energy = ?3, highlight = ?4, \
                 gratitude = ?5, reflection = ?6, tomorrow_goal = ?7, \
                 last_modified = ?8 \
                 WHERE date = ?1",
                params![
                    entry.date,
                    entry.mood,
                    entry.energy,
                    entry.highlight,
                    entry.gratitude,
                    entry.reflection,
                    entry.tomorrow_goal,
                    &now,
                ],
            )?;
        } else {
            tx.execute(
                "INSERT INTO journal (\
                 date, mood, energy, highlight, gratitude, \
                 reflection, tomorrow_goal, logged_at, last_modified\
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    entry.date,
                    entry.mood,
                    entry.energy,
                    entry.highlight,
                    entry.gratitude,
                    entry.reflection,
                    entry.tomorrow_goal,
                    logged_at,
                    &now,
                ],
            )?;
        }

        tx.commit()?;
    }

    query_journal_by_date(&db, &entry.date)?
        .ok_or_else(|| CommandError::from("Failed to read back saved journal entry"))
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

    fn make_default_journal_input(date: &str) -> JournalInput {
        JournalInput {
            date: date.to_string(),
            mood: 3,
            energy: 3,
            highlight: String::new(),
            gratitude: String::new(),
            reflection: String::new(),
            tomorrow_goal: String::new(),
        }
    }

    /// Duplicate of save_journal logic using a raw Connection (no tauri::State).
    fn save_journal_direct(conn: &Connection, entry: JournalInput) -> CommandResult<Journal> {
        {
            let tx = conn
                .unchecked_transaction()
                .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

            let existing: Option<(i64, String)> = tx
                .query_row(
                    "SELECT id, logged_at FROM journal WHERE date = ?1",
                    [&entry.date],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .optional()?;

            let now = chrono::Utc::now().to_rfc3339();
            let logged_at = match &existing {
                Some((_, original_logged_at)) => original_logged_at.clone(),
                None => now.clone(),
            };

            if existing.is_some() {
                tx.execute(
                    "UPDATE journal SET \
                     mood = ?2, energy = ?3, highlight = ?4, \
                     gratitude = ?5, reflection = ?6, tomorrow_goal = ?7, \
                     last_modified = ?8 \
                     WHERE date = ?1",
                    params![
                        entry.date,
                        entry.mood,
                        entry.energy,
                        entry.highlight,
                        entry.gratitude,
                        entry.reflection,
                        entry.tomorrow_goal,
                        &now,
                    ],
                )?;
            } else {
                tx.execute(
                    "INSERT INTO journal (\
                     date, mood, energy, highlight, gratitude, \
                     reflection, tomorrow_goal, logged_at, last_modified\
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        entry.date,
                        entry.mood,
                        entry.energy,
                        entry.highlight,
                        entry.gratitude,
                        entry.reflection,
                        entry.tomorrow_goal,
                        logged_at,
                        &now,
                    ],
                )?;
            }

            tx.commit()?;
        }

        query_journal_by_date(conn, &entry.date)?
            .ok_or_else(|| CommandError::from("Failed to read back saved journal entry"))
    }

    // -------------------------------------------------------------------
    // Row Mapper Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_row_mapper_round_trip() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO journal (\
             date, mood, energy, highlight, gratitude, \
             reflection, tomorrow_goal, logged_at, last_modified\
             ) VALUES (\
             '2026-02-10', 4, 5, 'Got promoted', 'Family', \
             'Great day overall', 'Exercise early', \
             '2026-02-10T08:00:00+00:00', '2026-02-10T08:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let result = query_journal_by_date(&conn, "2026-02-10").unwrap();
        assert!(result.is_some());
        let j = result.unwrap();
        assert_eq!(j.date, "2026-02-10");
        assert_eq!(j.mood, 4);
        assert_eq!(j.energy, 5);
        assert_eq!(j.highlight, "Got promoted");
        assert_eq!(j.gratitude, "Family");
        assert_eq!(j.reflection, "Great day overall");
        assert_eq!(j.tomorrow_goal, "Exercise early");
        assert_eq!(j.logged_at, "2026-02-10T08:00:00+00:00");
        assert_eq!(j.last_modified, "2026-02-10T08:00:00+00:00");
    }

    #[test]
    fn test_row_mapper_empty_text_fields() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO journal (\
             date, mood, energy, highlight, gratitude, \
             reflection, tomorrow_goal, logged_at, last_modified\
             ) VALUES (\
             '2026-02-11', 3, 3, '', '', '', '', \
             '2026-02-11T08:00:00+00:00', '2026-02-11T08:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let j = query_journal_by_date(&conn, "2026-02-11").unwrap().unwrap();
        assert_eq!(j.highlight, "");
        assert_eq!(j.gratitude, "");
        assert_eq!(j.reflection, "");
        assert_eq!(j.tomorrow_goal, "");
    }

    // -------------------------------------------------------------------
    // get_journal Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_get_journal_not_found() {
        let conn = setup_test_db();
        let result = query_journal_by_date(&conn, "2099-01-01").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_get_journal_found() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO journal (\
             date, mood, energy, highlight, gratitude, \
             reflection, tomorrow_goal, logged_at, last_modified\
             ) VALUES (\
             '2026-02-15', 5, 2, 'Shipped feature', 'Health', \
             'Tired but productive', 'Sleep earlier', \
             '2026-02-15T20:00:00+00:00', '2026-02-15T20:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let j = query_journal_by_date(&conn, "2026-02-15").unwrap().unwrap();
        assert_eq!(j.mood, 5);
        assert_eq!(j.energy, 2);
        assert_eq!(j.highlight, "Shipped feature");
    }

    // -------------------------------------------------------------------
    // save_journal Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_save_new_journal() {
        let conn = setup_test_db();
        let input = JournalInput {
            date: "2026-02-18".to_string(),
            mood: 4,
            energy: 3,
            highlight: "First entry".to_string(),
            gratitude: "Sunshine".to_string(),
            reflection: "Went well".to_string(),
            tomorrow_goal: "Read more".to_string(),
        };

        let j = save_journal_direct(&conn, input).unwrap();
        assert_eq!(j.date, "2026-02-18");
        assert_eq!(j.mood, 4);
        assert_eq!(j.energy, 3);
        assert_eq!(j.highlight, "First entry");
        assert_eq!(j.gratitude, "Sunshine");
        assert_eq!(j.reflection, "Went well");
        assert_eq!(j.tomorrow_goal, "Read more");
        assert_eq!(j.logged_at, j.last_modified);
    }

    #[test]
    fn test_save_journal_update_preserves_logged_at() {
        let conn = setup_test_db();

        let input1 = make_default_journal_input("2026-02-18");
        let j1 = save_journal_direct(&conn, input1).unwrap();
        let original_logged_at = j1.logged_at.clone();

        // Small delay to ensure different timestamp
        std::thread::sleep(std::time::Duration::from_millis(10));

        let input2 = JournalInput {
            date: "2026-02-18".to_string(),
            mood: 5,
            energy: 5,
            highlight: "Updated".to_string(),
            gratitude: String::new(),
            reflection: String::new(),
            tomorrow_goal: String::new(),
        };
        let j2 = save_journal_direct(&conn, input2).unwrap();

        assert_eq!(j2.logged_at, original_logged_at, "logged_at must not change on update");
        assert_ne!(j2.last_modified, original_logged_at, "last_modified must change on update");
    }

    #[test]
    fn test_save_journal_update_changes_data() {
        let conn = setup_test_db();

        let input1 = make_default_journal_input("2026-02-18");
        save_journal_direct(&conn, input1).unwrap();

        let input2 = JournalInput {
            date: "2026-02-18".to_string(),
            mood: 1,
            energy: 5,
            highlight: "New highlight".to_string(),
            gratitude: "New gratitude".to_string(),
            reflection: "New reflection".to_string(),
            tomorrow_goal: "New goal".to_string(),
        };
        let j = save_journal_direct(&conn, input2).unwrap();

        assert_eq!(j.mood, 1);
        assert_eq!(j.energy, 5);
        assert_eq!(j.highlight, "New highlight");
        assert_eq!(j.gratitude, "New gratitude");
        assert_eq!(j.reflection, "New reflection");
        assert_eq!(j.tomorrow_goal, "New goal");
    }

    #[test]
    fn test_save_journal_preserves_id_on_update() {
        let conn = setup_test_db();

        let j1 = save_journal_direct(&conn, make_default_journal_input("2026-02-18")).unwrap();
        let original_id = j1.id;

        let j2 = save_journal_direct(&conn, make_default_journal_input("2026-02-18")).unwrap();
        assert_eq!(j2.id, original_id, "id must not change on update");
    }

    #[test]
    fn test_save_journal_validates_mood_range() {
        let conn = setup_test_db();

        let mut input = make_default_journal_input("2026-02-18");
        input.mood = 0;
        let result = save_journal_direct(&conn, input);
        assert!(result.is_err(), "mood=0 should be rejected by CHECK constraint");

        let mut input = make_default_journal_input("2026-02-19");
        input.mood = 6;
        let result = save_journal_direct(&conn, input);
        assert!(result.is_err(), "mood=6 should be rejected by CHECK constraint");
    }

    #[test]
    fn test_save_journal_validates_energy_range() {
        let conn = setup_test_db();

        let mut input = make_default_journal_input("2026-02-18");
        input.energy = 0;
        let result = save_journal_direct(&conn, input);
        assert!(result.is_err(), "energy=0 should be rejected by CHECK constraint");

        let mut input = make_default_journal_input("2026-02-19");
        input.energy = 6;
        let result = save_journal_direct(&conn, input);
        assert!(result.is_err(), "energy=6 should be rejected by CHECK constraint");
    }

    #[test]
    fn test_save_journal_return_matches_db() {
        let conn = setup_test_db();

        let input = JournalInput {
            date: "2026-02-18".to_string(),
            mood: 4,
            energy: 2,
            highlight: "Test".to_string(),
            gratitude: "Everything".to_string(),
            reflection: "Solid day".to_string(),
            tomorrow_goal: "Keep going".to_string(),
        };
        let returned = save_journal_direct(&conn, input).unwrap();

        let from_db = query_journal_by_date(&conn, "2026-02-18").unwrap().unwrap();
        assert_eq!(returned.id, from_db.id);
        assert_eq!(returned.mood, from_db.mood);
        assert_eq!(returned.energy, from_db.energy);
        assert_eq!(returned.highlight, from_db.highlight);
        assert_eq!(returned.logged_at, from_db.logged_at);
        assert_eq!(returned.last_modified, from_db.last_modified);
    }
}
