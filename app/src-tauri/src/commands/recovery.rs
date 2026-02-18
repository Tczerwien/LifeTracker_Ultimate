use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full relapse_entry row returned to the frontend.
/// Field names and types must match the TypeScript `RelapseEntry` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelapseEntry {
    pub id: i64,
    pub date: String,
    pub time: String,
    pub duration: String,
    pub trigger: String,
    pub location: String,
    pub device: String,
    pub activity_before: String,
    pub emotional_state: String,
    pub resistance_technique: String,
    pub urge_intensity: i64,
    pub notes: String,
    pub urge_entry_id: Option<i64>,
    pub created_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving/updating a relapse entry.
/// Contains only user-editable fields — no id or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelapseEntryInput {
    pub date: String,
    pub time: String,
    pub duration: String,
    pub trigger: String,
    pub location: String,
    pub device: String,
    pub activity_before: String,
    pub emotional_state: String,
    pub resistance_technique: String,
    pub urge_intensity: i64,
    pub notes: String,
    pub urge_entry_id: Option<i64>,
}

/// Full urge_entry row returned to the frontend.
/// Field names and types must match the TypeScript `UrgeEntry` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrgeEntry {
    pub id: i64,
    pub date: String,
    pub time: String,
    pub intensity: i64,
    pub technique: String,
    pub effectiveness: i64,
    pub duration: String,
    pub did_pass: String,
    pub trigger: String,
    pub notes: String,
    pub created_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving/updating an urge entry.
/// Contains only user-editable fields — no id or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UrgeEntryInput {
    pub date: String,
    pub time: String,
    pub intensity: i64,
    pub technique: String,
    pub effectiveness: i64,
    pub duration: String,
    pub did_pass: String,
    pub trigger: String,
    pub notes: String,
}

// ---------------------------------------------------------------------------
// Column Constants & Row Mappers
// ---------------------------------------------------------------------------

const RELAPSE_ENTRY_COLUMNS: &str = "\
    id, date, time, duration, trigger, location, device, \
    activity_before, emotional_state, resistance_technique, \
    urge_intensity, notes, urge_entry_id, created_at, last_modified";

const URGE_ENTRY_COLUMNS: &str = "\
    id, date, time, intensity, technique, effectiveness, \
    duration, did_pass, trigger, notes, created_at, last_modified";

fn row_to_relapse_entry(row: &rusqlite::Row) -> rusqlite::Result<RelapseEntry> {
    Ok(RelapseEntry {
        id: row.get(0)?,
        date: row.get(1)?,
        time: row.get(2)?,
        duration: row.get(3)?,
        trigger: row.get(4)?,
        location: row.get(5)?,
        device: row.get(6)?,
        activity_before: row.get(7)?,
        emotional_state: row.get(8)?,
        resistance_technique: row.get(9)?,
        urge_intensity: row.get(10)?,
        notes: row.get(11)?,
        urge_entry_id: row.get(12)?,
        created_at: row.get(13)?,
        last_modified: row.get(14)?,
    })
}

fn row_to_urge_entry(row: &rusqlite::Row) -> rusqlite::Result<UrgeEntry> {
    Ok(UrgeEntry {
        id: row.get(0)?,
        date: row.get(1)?,
        time: row.get(2)?,
        intensity: row.get(3)?,
        technique: row.get(4)?,
        effectiveness: row.get(5)?,
        duration: row.get(6)?,
        did_pass: row.get(7)?,
        trigger: row.get(8)?,
        notes: row.get(9)?,
        created_at: row.get(10)?,
        last_modified: row.get(11)?,
    })
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

fn query_relapse_entry_by_id(
    conn: &Connection,
    id: i64,
) -> CommandResult<Option<RelapseEntry>> {
    let sql = format!(
        "SELECT {} FROM relapse_entry WHERE id = ?1",
        RELAPSE_ENTRY_COLUMNS
    );
    conn.query_row(&sql, [id], row_to_relapse_entry)
        .optional()
        .map_err(CommandError::from)
}

fn query_urge_entry_by_id(
    conn: &Connection,
    id: i64,
) -> CommandResult<Option<UrgeEntry>> {
    let sql = format!(
        "SELECT {} FROM urge_entry WHERE id = ?1",
        URGE_ENTRY_COLUMNS
    );
    conn.query_row(&sql, [id], row_to_urge_entry)
        .optional()
        .map_err(CommandError::from)
}

/// Check whether an entry is within the 24-hour correction window.
///
/// Per ADR-006 SD5, the window is measured from `created_at` (ISO 8601 / RFC 3339),
/// not from the `date` field. Returns `Ok(())` if editable, or `Err` if locked.
fn check_correction_window(created_at: &str, entity_name: &str) -> CommandResult<()> {
    let created = chrono::DateTime::parse_from_rfc3339(created_at).map_err(|e| {
        CommandError::from(format!(
            "Failed to parse created_at timestamp '{}': {}",
            created_at, e
        ))
    })?;

    let now = chrono::Utc::now();
    let elapsed = now.signed_duration_since(created);

    if elapsed > chrono::Duration::hours(24) {
        return Err(CommandError::from(format!(
            "{} locked: the 24-hour correction window has expired",
            entity_name
        )));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Relapse Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_relapse_entries(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<RelapseEntry>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_relapse_entries_impl(&db, &start, &end)
}

fn get_relapse_entries_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<RelapseEntry>> {
    let sql = format!(
        "SELECT {} FROM relapse_entry WHERE date >= ?1 AND date <= ?2 \
         ORDER BY date DESC, time DESC",
        RELAPSE_ENTRY_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![start, end], row_to_relapse_entry)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn save_relapse_entry(
    state: tauri::State<'_, AppState>,
    entry: RelapseEntryInput,
) -> CommandResult<RelapseEntry> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    save_relapse_entry_impl(&db, entry)
}

fn save_relapse_entry_impl(
    conn: &Connection,
    entry: RelapseEntryInput,
) -> CommandResult<RelapseEntry> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO relapse_entry (\
         date, time, duration, trigger, location, device, \
         activity_before, emotional_state, resistance_technique, \
         urge_intensity, notes, urge_entry_id, created_at, last_modified\
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            entry.date,
            entry.time,
            entry.duration,
            entry.trigger,
            entry.location,
            entry.device,
            entry.activity_before,
            entry.emotional_state,
            entry.resistance_technique,
            entry.urge_intensity,
            entry.notes,
            entry.urge_entry_id,
            &now,
            &now,
        ],
    )?;

    let id = conn.last_insert_rowid();
    query_relapse_entry_by_id(conn, id)?
        .ok_or_else(|| CommandError::from("Failed to read back saved relapse entry"))
}

#[tauri::command]
pub fn update_relapse_entry(
    state: tauri::State<'_, AppState>,
    id: i64,
    entry: RelapseEntryInput,
) -> CommandResult<RelapseEntry> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    update_relapse_entry_impl(&db, id, entry)
}

fn update_relapse_entry_impl(
    conn: &Connection,
    id: i64,
    entry: RelapseEntryInput,
) -> CommandResult<RelapseEntry> {
    // Step 1: Fetch existing entry to get created_at for lock check
    let existing = query_relapse_entry_by_id(conn, id)?
        .ok_or_else(|| CommandError::from(format!("Relapse entry with id {} not found", id)))?;

    // Step 2: ADR-006 SD2 — check 24-hour correction window
    check_correction_window(&existing.created_at, "Relapse entry")?;

    // Step 3: UPDATE (created_at is never changed per ADR-006 SD5)
    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE relapse_entry SET \
         date = ?2, time = ?3, duration = ?4, trigger = ?5, \
         location = ?6, device = ?7, activity_before = ?8, \
         emotional_state = ?9, resistance_technique = ?10, \
         urge_intensity = ?11, notes = ?12, urge_entry_id = ?13, \
         last_modified = ?14 \
         WHERE id = ?1",
        params![
            id,
            entry.date,
            entry.time,
            entry.duration,
            entry.trigger,
            entry.location,
            entry.device,
            entry.activity_before,
            entry.emotional_state,
            entry.resistance_technique,
            entry.urge_intensity,
            entry.notes,
            entry.urge_entry_id,
            &now,
        ],
    )?;

    if rows_affected == 0 {
        return Err(CommandError::from(format!(
            "Relapse entry with id {} not found",
            id
        )));
    }

    // Step 4: Read back and return (ADR-006 SD4 — no score recompute)
    query_relapse_entry_by_id(conn, id)?
        .ok_or_else(|| CommandError::from("Failed to read back updated relapse entry"))
}

// ---------------------------------------------------------------------------
// Urge Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_urge_entries(
    state: tauri::State<'_, AppState>,
    start: String,
    end: String,
) -> CommandResult<Vec<UrgeEntry>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_urge_entries_impl(&db, &start, &end)
}

fn get_urge_entries_impl(
    conn: &Connection,
    start: &str,
    end: &str,
) -> CommandResult<Vec<UrgeEntry>> {
    let sql = format!(
        "SELECT {} FROM urge_entry WHERE date >= ?1 AND date <= ?2 \
         ORDER BY date DESC, time DESC",
        URGE_ENTRY_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![start, end], row_to_urge_entry)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn save_urge_entry(
    state: tauri::State<'_, AppState>,
    entry: UrgeEntryInput,
) -> CommandResult<UrgeEntry> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    save_urge_entry_impl(&db, entry)
}

fn save_urge_entry_impl(
    conn: &Connection,
    entry: UrgeEntryInput,
) -> CommandResult<UrgeEntry> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO urge_entry (\
         date, time, intensity, technique, effectiveness, \
         duration, did_pass, trigger, notes, created_at, last_modified\
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            entry.date,
            entry.time,
            entry.intensity,
            entry.technique,
            entry.effectiveness,
            entry.duration,
            entry.did_pass,
            entry.trigger,
            entry.notes,
            &now,
            &now,
        ],
    )?;

    let id = conn.last_insert_rowid();
    query_urge_entry_by_id(conn, id)?
        .ok_or_else(|| CommandError::from("Failed to read back saved urge entry"))
}

#[tauri::command]
pub fn update_urge_entry(
    state: tauri::State<'_, AppState>,
    id: i64,
    entry: UrgeEntryInput,
) -> CommandResult<UrgeEntry> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    update_urge_entry_impl(&db, id, entry)
}

fn update_urge_entry_impl(
    conn: &Connection,
    id: i64,
    entry: UrgeEntryInput,
) -> CommandResult<UrgeEntry> {
    // Step 1: Fetch existing entry to get created_at for lock check
    let existing = query_urge_entry_by_id(conn, id)?
        .ok_or_else(|| CommandError::from(format!("Urge entry with id {} not found", id)))?;

    // Step 2: ADR-006 SD2 — check 24-hour correction window
    check_correction_window(&existing.created_at, "Urge entry")?;

    // Step 3: UPDATE (created_at is never changed per ADR-006 SD5)
    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE urge_entry SET \
         date = ?2, time = ?3, intensity = ?4, technique = ?5, \
         effectiveness = ?6, duration = ?7, did_pass = ?8, \
         trigger = ?9, notes = ?10, last_modified = ?11 \
         WHERE id = ?1",
        params![
            id,
            entry.date,
            entry.time,
            entry.intensity,
            entry.technique,
            entry.effectiveness,
            entry.duration,
            entry.did_pass,
            entry.trigger,
            entry.notes,
            &now,
        ],
    )?;

    if rows_affected == 0 {
        return Err(CommandError::from(format!(
            "Urge entry with id {} not found",
            id
        )));
    }

    // ADR-006 SD4 — no score recompute
    query_urge_entry_by_id(conn, id)?
        .ok_or_else(|| CommandError::from("Failed to read back updated urge entry"))
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

    fn make_relapse_input() -> RelapseEntryInput {
        RelapseEntryInput {
            date: "2026-02-18".to_string(),
            time: "23:30".to_string(),
            duration: "< 5 minutes".to_string(),
            trigger: "Boredom".to_string(),
            location: "Bedroom".to_string(),
            device: "Phone".to_string(),
            activity_before: "Scrolling".to_string(),
            emotional_state: "Stressed".to_string(),
            resistance_technique: "None".to_string(),
            urge_intensity: 7,
            notes: String::new(),
            urge_entry_id: None,
        }
    }

    fn make_urge_input() -> UrgeEntryInput {
        UrgeEntryInput {
            date: "2026-02-18".to_string(),
            time: "22:00".to_string(),
            intensity: 6,
            technique: "Cold Shower".to_string(),
            effectiveness: 4,
            duration: "5-15 minutes".to_string(),
            did_pass: "Yes".to_string(),
            trigger: "Late night alone".to_string(),
            notes: String::new(),
        }
    }

    /// Insert a relapse entry with a specific created_at for lock testing.
    fn insert_relapse_with_created_at(conn: &Connection, created_at: &str) -> i64 {
        conn.execute(
            "INSERT INTO relapse_entry (\
             date, time, duration, trigger, location, device, \
             activity_before, emotional_state, resistance_technique, \
             urge_intensity, notes, urge_entry_id, created_at, last_modified\
             ) VALUES (\
             '2026-02-18', '23:30', '< 5 min', 'Boredom', 'Bedroom', 'Phone', \
             'Scrolling', 'Stressed', 'None', 7, '', NULL, ?1, ?1\
             )",
            params![created_at],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    /// Insert an urge entry with a specific created_at for lock testing.
    fn insert_urge_with_created_at(conn: &Connection, created_at: &str) -> i64 {
        conn.execute(
            "INSERT INTO urge_entry (\
             date, time, intensity, technique, effectiveness, \
             duration, did_pass, trigger, notes, created_at, last_modified\
             ) VALUES (\
             '2026-02-18', '22:00', 6, 'Cold Shower', 4, \
             '5-15 min', 'Yes', 'Late night', '', ?1, ?1\
             )",
            params![created_at],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    // -----------------------------------------------------------------------
    // A. Row Mapper Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_relapse_row_mapper_round_trip() {
        let conn = setup_test_db();
        let entry = save_relapse_entry_impl(&conn, make_relapse_input()).unwrap();

        let loaded = query_relapse_entry_by_id(&conn, entry.id)
            .unwrap()
            .expect("Entry should exist");

        assert_eq!(loaded.id, entry.id);
        assert_eq!(loaded.date, "2026-02-18");
        assert_eq!(loaded.time, "23:30");
        assert_eq!(loaded.duration, "< 5 minutes");
        assert_eq!(loaded.trigger, "Boredom");
        assert_eq!(loaded.location, "Bedroom");
        assert_eq!(loaded.device, "Phone");
        assert_eq!(loaded.activity_before, "Scrolling");
        assert_eq!(loaded.emotional_state, "Stressed");
        assert_eq!(loaded.resistance_technique, "None");
        assert_eq!(loaded.urge_intensity, 7);
        assert_eq!(loaded.notes, "");
        assert!(loaded.urge_entry_id.is_none());
        assert!(!loaded.created_at.is_empty());
        assert!(!loaded.last_modified.is_empty());
    }

    #[test]
    fn test_relapse_row_mapper_null_urge_entry_id() {
        let conn = setup_test_db();
        let entry = save_relapse_entry_impl(&conn, make_relapse_input()).unwrap();
        assert!(entry.urge_entry_id.is_none());
    }

    #[test]
    fn test_relapse_row_mapper_with_urge_entry_id() {
        let conn = setup_test_db();

        // Save an urge first
        let urge = save_urge_entry_impl(&conn, make_urge_input()).unwrap();

        // Save a relapse linked to that urge
        let mut input = make_relapse_input();
        input.urge_entry_id = Some(urge.id);
        let relapse = save_relapse_entry_impl(&conn, input).unwrap();

        assert_eq!(relapse.urge_entry_id, Some(urge.id));
    }

    #[test]
    fn test_urge_row_mapper_round_trip() {
        let conn = setup_test_db();
        let entry = save_urge_entry_impl(&conn, make_urge_input()).unwrap();

        let loaded = query_urge_entry_by_id(&conn, entry.id)
            .unwrap()
            .expect("Entry should exist");

        assert_eq!(loaded.id, entry.id);
        assert_eq!(loaded.date, "2026-02-18");
        assert_eq!(loaded.time, "22:00");
        assert_eq!(loaded.intensity, 6);
        assert_eq!(loaded.technique, "Cold Shower");
        assert_eq!(loaded.effectiveness, 4);
        assert_eq!(loaded.duration, "5-15 minutes");
        assert_eq!(loaded.did_pass, "Yes");
        assert_eq!(loaded.trigger, "Late night alone");
        assert_eq!(loaded.notes, "");
        assert!(!loaded.created_at.is_empty());
        assert!(!loaded.last_modified.is_empty());
    }

    // -----------------------------------------------------------------------
    // B. Relapse CRUD Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_save_relapse_entry() {
        let conn = setup_test_db();
        let entry = save_relapse_entry_impl(&conn, make_relapse_input()).unwrap();

        assert!(entry.id > 0);
        assert_eq!(entry.date, "2026-02-18");
        assert_eq!(entry.urge_intensity, 7);
        assert_eq!(entry.created_at, entry.last_modified);
    }

    #[test]
    fn test_save_relapse_entry_with_linked_urge() {
        let conn = setup_test_db();
        let urge = save_urge_entry_impl(&conn, make_urge_input()).unwrap();

        let mut input = make_relapse_input();
        input.urge_entry_id = Some(urge.id);
        let relapse = save_relapse_entry_impl(&conn, input).unwrap();

        assert_eq!(relapse.urge_entry_id, Some(urge.id));
    }

    #[test]
    fn test_save_relapse_return_matches_db() {
        let conn = setup_test_db();
        let saved = save_relapse_entry_impl(&conn, make_relapse_input()).unwrap();

        let from_db = query_relapse_entry_by_id(&conn, saved.id)
            .unwrap()
            .expect("Entry should exist");

        assert_eq!(saved.id, from_db.id);
        assert_eq!(saved.date, from_db.date);
        assert_eq!(saved.trigger, from_db.trigger);
        assert_eq!(saved.created_at, from_db.created_at);
    }

    #[test]
    fn test_get_relapse_entries_date_range() {
        let conn = setup_test_db();

        // Insert entries on 3 different dates
        let mut input1 = make_relapse_input();
        input1.date = "2026-02-15".to_string();
        save_relapse_entry_impl(&conn, input1).unwrap();

        let mut input2 = make_relapse_input();
        input2.date = "2026-02-18".to_string();
        save_relapse_entry_impl(&conn, input2).unwrap();

        let mut input3 = make_relapse_input();
        input3.date = "2026-02-25".to_string();
        save_relapse_entry_impl(&conn, input3).unwrap();

        // Query range that includes only Feb 15-18
        let results =
            get_relapse_entries_impl(&conn, "2026-02-15", "2026-02-20").unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_get_relapse_entries_ordered_desc() {
        let conn = setup_test_db();

        let mut input1 = make_relapse_input();
        input1.date = "2026-02-15".to_string();
        input1.time = "08:00".to_string();
        save_relapse_entry_impl(&conn, input1).unwrap();

        let mut input2 = make_relapse_input();
        input2.date = "2026-02-18".to_string();
        input2.time = "14:00".to_string();
        save_relapse_entry_impl(&conn, input2).unwrap();

        let mut input3 = make_relapse_input();
        input3.date = "2026-02-18".to_string();
        input3.time = "22:00".to_string();
        save_relapse_entry_impl(&conn, input3).unwrap();

        let results =
            get_relapse_entries_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(results.len(), 3);
        // date DESC, time DESC
        assert_eq!(results[0].date, "2026-02-18");
        assert_eq!(results[0].time, "22:00");
        assert_eq!(results[1].date, "2026-02-18");
        assert_eq!(results[1].time, "14:00");
        assert_eq!(results[2].date, "2026-02-15");
    }

    #[test]
    fn test_get_relapse_entries_empty_range() {
        let conn = setup_test_db();
        let results =
            get_relapse_entries_impl(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_save_relapse_validates_urge_intensity_range() {
        let conn = setup_test_db();

        // urge_intensity = 0 should fail (CHECK constraint: >= 1)
        let mut input = make_relapse_input();
        input.urge_intensity = 0;
        let result = save_relapse_entry_impl(&conn, input);
        assert!(result.is_err());

        // urge_intensity = 11 should fail (CHECK constraint: <= 10)
        let mut input = make_relapse_input();
        input.urge_intensity = 11;
        let result = save_relapse_entry_impl(&conn, input);
        assert!(result.is_err());
    }

    // -----------------------------------------------------------------------
    // C. Urge CRUD Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_save_urge_entry() {
        let conn = setup_test_db();
        let entry = save_urge_entry_impl(&conn, make_urge_input()).unwrap();

        assert!(entry.id > 0);
        assert_eq!(entry.date, "2026-02-18");
        assert_eq!(entry.intensity, 6);
        assert_eq!(entry.effectiveness, 4);
        assert_eq!(entry.created_at, entry.last_modified);
    }

    #[test]
    fn test_save_urge_return_matches_db() {
        let conn = setup_test_db();
        let saved = save_urge_entry_impl(&conn, make_urge_input()).unwrap();

        let from_db = query_urge_entry_by_id(&conn, saved.id)
            .unwrap()
            .expect("Entry should exist");

        assert_eq!(saved.id, from_db.id);
        assert_eq!(saved.date, from_db.date);
        assert_eq!(saved.technique, from_db.technique);
        assert_eq!(saved.created_at, from_db.created_at);
    }

    #[test]
    fn test_get_urge_entries_date_range() {
        let conn = setup_test_db();

        let mut input1 = make_urge_input();
        input1.date = "2026-02-15".to_string();
        save_urge_entry_impl(&conn, input1).unwrap();

        let mut input2 = make_urge_input();
        input2.date = "2026-02-18".to_string();
        save_urge_entry_impl(&conn, input2).unwrap();

        let mut input3 = make_urge_input();
        input3.date = "2026-02-25".to_string();
        save_urge_entry_impl(&conn, input3).unwrap();

        let results =
            get_urge_entries_impl(&conn, "2026-02-15", "2026-02-20").unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_get_urge_entries_ordered_desc() {
        let conn = setup_test_db();

        let mut input1 = make_urge_input();
        input1.date = "2026-02-15".to_string();
        input1.time = "08:00".to_string();
        save_urge_entry_impl(&conn, input1).unwrap();

        let mut input2 = make_urge_input();
        input2.date = "2026-02-18".to_string();
        input2.time = "14:00".to_string();
        save_urge_entry_impl(&conn, input2).unwrap();

        let mut input3 = make_urge_input();
        input3.date = "2026-02-18".to_string();
        input3.time = "22:00".to_string();
        save_urge_entry_impl(&conn, input3).unwrap();

        let results =
            get_urge_entries_impl(&conn, "2026-02-01", "2026-02-28").unwrap();
        assert_eq!(results.len(), 3);
        assert_eq!(results[0].date, "2026-02-18");
        assert_eq!(results[0].time, "22:00");
        assert_eq!(results[1].date, "2026-02-18");
        assert_eq!(results[1].time, "14:00");
        assert_eq!(results[2].date, "2026-02-15");
    }

    #[test]
    fn test_get_urge_entries_empty_range() {
        let conn = setup_test_db();
        let results =
            get_urge_entries_impl(&conn, "2026-03-01", "2026-03-31").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_save_urge_validates_intensity_range() {
        let conn = setup_test_db();

        let mut input = make_urge_input();
        input.intensity = 0;
        assert!(save_urge_entry_impl(&conn, input).is_err());

        let mut input = make_urge_input();
        input.intensity = 11;
        assert!(save_urge_entry_impl(&conn, input).is_err());
    }

    #[test]
    fn test_save_urge_validates_effectiveness_range() {
        let conn = setup_test_db();

        let mut input = make_urge_input();
        input.effectiveness = 0;
        assert!(save_urge_entry_impl(&conn, input).is_err());

        let mut input = make_urge_input();
        input.effectiveness = 6;
        assert!(save_urge_entry_impl(&conn, input).is_err());
    }

    // -----------------------------------------------------------------------
    // D. 24-Hour Lock Tests (ADR-006)
    // -----------------------------------------------------------------------

    #[test]
    fn test_update_relapse_within_window() {
        let conn = setup_test_db();
        let saved = save_relapse_entry_impl(&conn, make_relapse_input()).unwrap();
        let original_created_at = saved.created_at.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let mut updated_input = make_relapse_input();
        updated_input.trigger = "Loneliness".to_string();
        updated_input.urge_intensity = 9;

        let updated =
            update_relapse_entry_impl(&conn, saved.id, updated_input).unwrap();

        assert_eq!(updated.trigger, "Loneliness");
        assert_eq!(updated.urge_intensity, 9);
        assert_eq!(updated.created_at, original_created_at);
        assert_ne!(updated.last_modified, original_created_at);
    }

    #[test]
    fn test_update_relapse_after_window() {
        let conn = setup_test_db();
        let old_ts = (chrono::Utc::now() - chrono::Duration::hours(25)).to_rfc3339();
        let id = insert_relapse_with_created_at(&conn, &old_ts);

        let result = update_relapse_entry_impl(&conn, id, make_relapse_input());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("locked"));
        assert!(err_msg.contains("24-hour correction window"));
    }

    #[test]
    fn test_update_relapse_at_boundary() {
        let conn = setup_test_db();
        // Just under 24 hours ago — should still be editable.
        // Uses a 5-second buffer to account for test execution time.
        let boundary_ts = (chrono::Utc::now()
            - chrono::Duration::hours(24)
            + chrono::Duration::seconds(5))
        .to_rfc3339();
        let id = insert_relapse_with_created_at(&conn, &boundary_ts);

        let result = update_relapse_entry_impl(&conn, id, make_relapse_input());
        assert!(result.is_ok());
    }

    #[test]
    fn test_update_urge_within_window() {
        let conn = setup_test_db();
        let saved = save_urge_entry_impl(&conn, make_urge_input()).unwrap();
        let original_created_at = saved.created_at.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let mut updated_input = make_urge_input();
        updated_input.technique = "Meditation".to_string();
        updated_input.intensity = 8;

        let updated =
            update_urge_entry_impl(&conn, saved.id, updated_input).unwrap();

        assert_eq!(updated.technique, "Meditation");
        assert_eq!(updated.intensity, 8);
        assert_eq!(updated.created_at, original_created_at);
        assert_ne!(updated.last_modified, original_created_at);
    }

    #[test]
    fn test_update_urge_after_window() {
        let conn = setup_test_db();
        let old_ts = (chrono::Utc::now() - chrono::Duration::hours(25)).to_rfc3339();
        let id = insert_urge_with_created_at(&conn, &old_ts);

        let result = update_urge_entry_impl(&conn, id, make_urge_input());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("locked"));
        assert!(err_msg.contains("24-hour correction window"));
    }

    #[test]
    fn test_update_urge_at_boundary() {
        let conn = setup_test_db();
        // Just under 24 hours ago — should still be editable.
        let boundary_ts = (chrono::Utc::now()
            - chrono::Duration::hours(24)
            + chrono::Duration::seconds(5))
        .to_rfc3339();
        let id = insert_urge_with_created_at(&conn, &boundary_ts);

        let result = update_urge_entry_impl(&conn, id, make_urge_input());
        assert!(result.is_ok());
    }

    // -----------------------------------------------------------------------
    // E. Update Edge Case Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_update_relapse_nonexistent_id() {
        let conn = setup_test_db();
        let result = update_relapse_entry_impl(&conn, 99999, make_relapse_input());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("99999"));
    }

    #[test]
    fn test_update_urge_nonexistent_id() {
        let conn = setup_test_db();
        let result = update_urge_entry_impl(&conn, 99999, make_urge_input());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("99999"));
    }

    #[test]
    fn test_update_relapse_preserves_created_at() {
        let conn = setup_test_db();
        let saved = save_relapse_entry_impl(&conn, make_relapse_input()).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let mut input = make_relapse_input();
        input.notes = "Updated notes".to_string();
        let updated = update_relapse_entry_impl(&conn, saved.id, input).unwrap();

        // created_at must be identical
        assert_eq!(updated.created_at, saved.created_at);
        // last_modified must have changed
        assert_ne!(updated.last_modified, saved.last_modified);
    }

    // -----------------------------------------------------------------------
    // F. FK Constraint Tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_relapse_urge_fk_on_delete_set_null() {
        let conn = setup_test_db();

        // Save urge, then relapse linked to it
        let urge = save_urge_entry_impl(&conn, make_urge_input()).unwrap();
        let mut input = make_relapse_input();
        input.urge_entry_id = Some(urge.id);
        let relapse = save_relapse_entry_impl(&conn, input).unwrap();
        assert_eq!(relapse.urge_entry_id, Some(urge.id));

        // Delete the urge via raw SQL
        conn.execute("DELETE FROM urge_entry WHERE id = ?1", [urge.id])
            .unwrap();

        // Relapse should still exist with urge_entry_id = NULL
        let reloaded = query_relapse_entry_by_id(&conn, relapse.id)
            .unwrap()
            .expect("Relapse should survive urge deletion");
        assert!(reloaded.urge_entry_id.is_none());
    }

    #[test]
    fn test_relapse_invalid_urge_entry_id() {
        let conn = setup_test_db();
        let mut input = make_relapse_input();
        input.urge_entry_id = Some(99999);

        let result = save_relapse_entry_impl(&conn, input);
        assert!(result.is_err());
    }
}
