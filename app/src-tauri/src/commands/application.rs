use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

/// Full application row returned to the frontend.
/// Field names and types must match the TypeScript `Application` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub id: i64,
    pub date_applied: String,
    pub company: String,
    pub role: String,
    pub source: String,
    pub current_status: String,
    pub url: String,
    pub notes: String,
    pub follow_up_date: Option<String>,
    pub salary: String,
    pub contact_name: String,
    pub contact_email: String,
    pub login_username: String,
    pub login_password: String,
    pub archived: bool,
    pub logged_at: String,
    pub last_modified: String,
}

/// Input received from the frontend when saving/updating an application.
/// Contains only user-editable fields — no id, archived, status, or timestamps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationInput {
    pub date_applied: String,
    pub company: String,
    pub role: String,
    pub source: String,
    pub url: String,
    pub notes: String,
    pub follow_up_date: Option<String>,
    pub salary: String,
    pub contact_name: String,
    pub contact_email: String,
    pub login_username: String,
    pub login_password: String,
}

/// Filter parameters for the get_applications query.
/// All fields are optional — `#[serde(default)]` allows passing `{}` from the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppFilters {
    pub status: Option<Vec<String>>,
    pub search: Option<String>,
    pub include_archived: Option<bool>,
}

impl Default for AppFilters {
    fn default() -> Self {
        Self {
            status: None,
            search: None,
            include_archived: None,
        }
    }
}

/// Full status_change row returned to the frontend.
/// Field names and types must match the TypeScript `StatusChange` interface exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusChange {
    pub id: i64,
    pub application_id: i64,
    pub status: String,
    pub date: String,
    pub notes: String,
    pub created_at: String,
}

/// Input for adding a status change.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusChangeInput {
    pub status: String,
    pub changed_date: String,
    #[serde(default)]
    pub notes: Option<String>,
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const APPLICATION_COLUMNS: &str = "\
    id, date_applied, company, role, source, current_status, \
    url, notes, follow_up_date, salary, contact_name, contact_email, \
    login_username, login_password, archived, logged_at, last_modified";

const STATUS_CHANGE_COLUMNS: &str = "\
    id, application_id, status, date, notes, created_at";

fn row_to_application(row: &rusqlite::Row) -> rusqlite::Result<Application> {
    Ok(Application {
        id: row.get(0)?,
        date_applied: row.get(1)?,
        company: row.get(2)?,
        role: row.get(3)?,
        source: row.get(4)?,
        current_status: row.get(5)?,
        url: row.get(6)?,
        notes: row.get(7)?,
        follow_up_date: row.get(8)?,
        salary: row.get(9)?,
        contact_name: row.get(10)?,
        contact_email: row.get(11)?,
        login_username: row.get(12)?,
        login_password: row.get(13)?,
        archived: row.get(14)?,
        logged_at: row.get(15)?,
        last_modified: row.get(16)?,
    })
}

fn row_to_status_change(row: &rusqlite::Row) -> rusqlite::Result<StatusChange> {
    Ok(StatusChange {
        id: row.get(0)?,
        application_id: row.get(1)?,
        status: row.get(2)?,
        date: row.get(3)?,
        notes: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn query_application_by_id(
    conn: &Connection,
    id: i64,
) -> CommandResult<Option<Application>> {
    let sql = format!(
        "SELECT {} FROM application WHERE id = ?1",
        APPLICATION_COLUMNS
    );
    conn.query_row(&sql, [id], row_to_application)
        .optional()
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_applications(
    state: tauri::State<'_, AppState>,
    filters: AppFilters,
) -> CommandResult<Vec<Application>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_applications_impl(&db, filters)
}

fn get_applications_impl(
    conn: &Connection,
    filters: AppFilters,
) -> CommandResult<Vec<Application>> {
    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    // Archived filter (default: exclude archived)
    let include_archived = filters.include_archived.unwrap_or(false);
    if !include_archived {
        conditions.push("archived = 0".to_string());
    }

    // Status filter
    if let Some(ref statuses) = filters.status {
        if !statuses.is_empty() {
            let placeholders: Vec<String> = statuses
                .iter()
                .map(|_| "?".to_string())
                .collect();
            conditions.push(format!("current_status IN ({})", placeholders.join(", ")));
            for s in statuses {
                param_values.push(Box::new(s.clone()));
            }
        }
    }

    // Search filter (company or role LIKE)
    if let Some(ref search) = filters.search {
        if !search.is_empty() {
            conditions.push("(company LIKE ? OR role LIKE ?)".to_string());
            let pattern = format!("%{}%", search);
            param_values.push(Box::new(pattern.clone()));
            param_values.push(Box::new(pattern));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT {} FROM application{} ORDER BY date_applied DESC",
        APPLICATION_COLUMNS, where_clause
    );

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), row_to_application)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_application(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> CommandResult<Option<Application>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_application_by_id(&db, id)
}

#[tauri::command]
pub fn save_application(
    state: tauri::State<'_, AppState>,
    app: ApplicationInput,
) -> CommandResult<Application> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    save_application_impl(&db, app)
}

fn save_application_impl(
    conn: &Connection,
    app: ApplicationInput,
) -> CommandResult<Application> {
    let id: i64;
    {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        let now = chrono::Utc::now().to_rfc3339();

        tx.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, current_status, \
             url, notes, follow_up_date, salary, \
             contact_name, contact_email, login_username, login_password, \
             archived, logged_at, last_modified\
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0, ?14, ?15)",
            params![
                app.date_applied,
                app.company,
                app.role,
                app.source,
                "applied",
                app.url,
                app.notes,
                app.follow_up_date,
                app.salary,
                app.contact_name,
                app.contact_email,
                app.login_username,
                app.login_password,
                &now,
                &now,
            ],
        )?;

        id = tx.last_insert_rowid();

        // D5 initialization: insert initial status_change row
        tx.execute(
            "INSERT INTO status_change (\
             application_id, status, date, notes, created_at\
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, "applied", app.date_applied, "", &now],
        )?;

        tx.commit()?;
    }

    query_application_by_id(conn, id)?
        .ok_or_else(|| CommandError::from("Failed to read back saved application"))
}

#[tauri::command]
pub fn update_application(
    state: tauri::State<'_, AppState>,
    id: i64,
    app: ApplicationInput,
) -> CommandResult<Application> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    update_application_impl(&db, id, app)
}

fn update_application_impl(
    conn: &Connection,
    id: i64,
    app: ApplicationInput,
) -> CommandResult<Application> {
    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE application SET \
         date_applied = ?2, company = ?3, role = ?4, source = ?5, \
         url = ?6, notes = ?7, follow_up_date = ?8, salary = ?9, \
         contact_name = ?10, contact_email = ?11, \
         login_username = ?12, login_password = ?13, \
         last_modified = ?14 \
         WHERE id = ?1",
        params![
            id,
            app.date_applied,
            app.company,
            app.role,
            app.source,
            app.url,
            app.notes,
            app.follow_up_date,
            app.salary,
            app.contact_name,
            app.contact_email,
            app.login_username,
            app.login_password,
            &now,
        ],
    )?;

    if rows_affected == 0 {
        return Err(CommandError::from(format!(
            "Application with id {} not found",
            id
        )));
    }

    query_application_by_id(conn, id)?
        .ok_or_else(|| CommandError::from("Failed to read back updated application"))
}

#[tauri::command]
pub fn archive_application(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> CommandResult<()> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    archive_application_impl(&db, id)
}

fn archive_application_impl(conn: &Connection, id: i64) -> CommandResult<()> {
    let now = chrono::Utc::now().to_rfc3339();

    let rows_affected = conn.execute(
        "UPDATE application SET archived = 1, last_modified = ?2 WHERE id = ?1",
        params![id, &now],
    )?;

    if rows_affected == 0 {
        return Err(CommandError::from(format!(
            "Application with id {} not found",
            id
        )));
    }

    Ok(())
}

#[tauri::command]
pub fn add_status_change(
    state: tauri::State<'_, AppState>,
    app_id: i64,
    change: StatusChangeInput,
) -> CommandResult<StatusChange> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    add_status_change_impl(&db, app_id, change)
}

fn add_status_change_impl(
    conn: &Connection,
    app_id: i64,
    change: StatusChangeInput,
) -> CommandResult<StatusChange> {
    let sc_id: i64;
    {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        let now = chrono::Utc::now().to_rfc3339();
        let notes = change.notes.unwrap_or_default();

        // Verify the application exists
        let app_exists: bool = tx
            .query_row(
                "SELECT COUNT(*) FROM application WHERE id = ?1",
                [app_id],
                |row| row.get::<_, i64>(0),
            )
            .map(|c| c > 0)?;

        if !app_exists {
            return Err(CommandError::from(format!(
                "Application with id {} not found",
                app_id
            )));
        }

        // Insert status_change row
        tx.execute(
            "INSERT INTO status_change (\
             application_id, status, date, notes, created_at\
             ) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![app_id, change.status, change.changed_date, notes, &now],
        )?;

        sc_id = tx.last_insert_rowid();

        // D5 sync invariant: update application.current_status
        tx.execute(
            "UPDATE application SET current_status = ?2, last_modified = ?3 WHERE id = ?1",
            params![app_id, change.status, &now],
        )?;

        tx.commit()?;
    }

    let sql = format!(
        "SELECT {} FROM status_change WHERE id = ?1",
        STATUS_CHANGE_COLUMNS
    );
    conn.query_row(&sql, [sc_id], row_to_status_change)
        .optional()
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::from("Failed to read back saved status change"))
}

#[tauri::command]
pub fn get_status_history(
    state: tauri::State<'_, AppState>,
    app_id: i64,
) -> CommandResult<Vec<StatusChange>> {
    let db = state.db.lock().map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_status_history_impl(&db, app_id)
}

fn get_status_history_impl(
    conn: &Connection,
    app_id: i64,
) -> CommandResult<Vec<StatusChange>> {
    let sql = format!(
        "SELECT {} FROM status_change WHERE application_id = ?1 \
         ORDER BY created_at ASC, id ASC",
        STATUS_CHANGE_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![app_id], row_to_status_change)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
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

    fn make_default_app_input() -> ApplicationInput {
        ApplicationInput {
            date_applied: "2026-02-18".to_string(),
            company: "Acme Corp".to_string(),
            role: "Software Engineer".to_string(),
            source: "LinkedIn".to_string(),
            url: "https://example.com/job/123".to_string(),
            notes: String::new(),
            follow_up_date: None,
            salary: String::new(),
            contact_name: String::new(),
            contact_email: String::new(),
            login_username: String::new(),
            login_password: String::new(),
        }
    }

    // -------------------------------------------------------------------
    // Row Mapper Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_row_mapper_round_trip() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, current_status, \
             url, notes, follow_up_date, salary, \
             contact_name, contact_email, login_username, login_password, \
             archived, logged_at, last_modified\
             ) VALUES (\
             '2026-02-18', 'TestCo', 'Dev', 'Indeed', 'applied', \
             'https://test.com', 'Some notes', '2026-03-01', '$100k', \
             'Jane Doe', 'jane@test.com', 'jdoe', 'pass123', \
             0, '2026-02-18T10:00:00+00:00', '2026-02-18T10:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let id = conn.last_insert_rowid();
        let a = query_application_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(a.date_applied, "2026-02-18");
        assert_eq!(a.company, "TestCo");
        assert_eq!(a.role, "Dev");
        assert_eq!(a.source, "Indeed");
        assert_eq!(a.current_status, "applied");
        assert_eq!(a.url, "https://test.com");
        assert_eq!(a.notes, "Some notes");
        assert_eq!(a.follow_up_date, Some("2026-03-01".to_string()));
        assert_eq!(a.salary, "$100k");
        assert_eq!(a.contact_name, "Jane Doe");
        assert_eq!(a.contact_email, "jane@test.com");
        assert_eq!(a.login_username, "jdoe");
        assert_eq!(a.login_password, "pass123");
        assert!(!a.archived);
        assert_eq!(a.logged_at, "2026-02-18T10:00:00+00:00");
        assert_eq!(a.last_modified, "2026-02-18T10:00:00+00:00");
    }

    #[test]
    fn test_row_mapper_null_follow_up_date() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, \
             logged_at, last_modified\
             ) VALUES (\
             '2026-02-18', 'TestCo', 'Dev', 'Indeed', \
             '2026-02-18T10:00:00+00:00', '2026-02-18T10:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let id = conn.last_insert_rowid();
        let a = query_application_by_id(&conn, id).unwrap().unwrap();
        assert_eq!(a.follow_up_date, None);
    }

    #[test]
    fn test_row_mapper_archived_bool() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO application (\
             date_applied, company, role, source, archived, \
             logged_at, last_modified\
             ) VALUES (\
             '2026-02-18', 'TestCo', 'Dev', 'Indeed', 1, \
             '2026-02-18T10:00:00+00:00', '2026-02-18T10:00:00+00:00'\
             )",
            [],
        )
        .unwrap();

        let id = conn.last_insert_rowid();
        let a = query_application_by_id(&conn, id).unwrap().unwrap();
        assert!(a.archived);
    }

    // -------------------------------------------------------------------
    // save_application Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_save_and_retrieve_application() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        assert!(a.id > 0);
        assert_eq!(a.date_applied, "2026-02-18");
        assert_eq!(a.company, "Acme Corp");
        assert_eq!(a.role, "Software Engineer");
        assert_eq!(a.source, "LinkedIn");
        assert_eq!(a.current_status, "applied");
        assert_eq!(a.url, "https://example.com/job/123");
        assert!(!a.archived);
        assert_eq!(a.follow_up_date, None);
        assert_eq!(a.logged_at, a.last_modified);
    }

    #[test]
    fn test_save_creates_initial_status_change() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        let history = get_status_history_impl(&conn, a.id).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].status, "applied");
        assert_eq!(history[0].date, "2026-02-18");
        assert_eq!(history[0].application_id, a.id);
        assert_eq!(history[0].notes, "");
    }

    #[test]
    fn test_save_return_matches_db() {
        let conn = setup_test_db();
        let returned = save_application_impl(&conn, make_default_app_input()).unwrap();

        let from_db = query_application_by_id(&conn, returned.id).unwrap().unwrap();
        assert_eq!(returned.id, from_db.id);
        assert_eq!(returned.company, from_db.company);
        assert_eq!(returned.current_status, from_db.current_status);
        assert_eq!(returned.logged_at, from_db.logged_at);
        assert_eq!(returned.last_modified, from_db.last_modified);
    }

    #[test]
    fn test_save_with_follow_up_date() {
        let conn = setup_test_db();
        let mut input = make_default_app_input();
        input.follow_up_date = Some("2026-03-01".to_string());

        let a = save_application_impl(&conn, input).unwrap();
        assert_eq!(a.follow_up_date, Some("2026-03-01".to_string()));
    }

    // -------------------------------------------------------------------
    // update_application Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_update_application_fields() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();
        let original_logged_at = a.logged_at.clone();

        std::thread::sleep(std::time::Duration::from_millis(10));

        let mut updated_input = make_default_app_input();
        updated_input.company = "Better Corp".to_string();
        updated_input.role = "Senior Engineer".to_string();
        updated_input.url = "https://better.com/job/456".to_string();
        updated_input.follow_up_date = Some("2026-04-01".to_string());

        let updated = update_application_impl(&conn, a.id, updated_input).unwrap();
        assert_eq!(updated.id, a.id);
        assert_eq!(updated.company, "Better Corp");
        assert_eq!(updated.role, "Senior Engineer");
        assert_eq!(updated.url, "https://better.com/job/456");
        assert_eq!(updated.follow_up_date, Some("2026-04-01".to_string()));
        assert_eq!(updated.logged_at, original_logged_at, "logged_at must not change");
        assert_ne!(
            updated.last_modified, original_logged_at,
            "last_modified must change"
        );
    }

    #[test]
    fn test_update_does_not_change_status() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        // Change status via add_status_change
        add_status_change_impl(
            &conn,
            a.id,
            StatusChangeInput {
                status: "interview".to_string(),
                changed_date: "2026-02-25".to_string(),
                notes: None,
            },
        )
        .unwrap();

        // Now update application fields
        let updated = update_application_impl(&conn, a.id, make_default_app_input()).unwrap();
        assert_eq!(
            updated.current_status, "interview",
            "update_application must not change current_status"
        );
    }

    #[test]
    fn test_update_nonexistent_id() {
        let conn = setup_test_db();
        let result = update_application_impl(&conn, 99999, make_default_app_input());
        assert!(result.is_err());
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("99999"), "error should mention the id");
    }

    // -------------------------------------------------------------------
    // archive_application Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_archive_application() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();
        assert!(!a.archived);

        archive_application_impl(&conn, a.id).unwrap();

        let archived = query_application_by_id(&conn, a.id).unwrap().unwrap();
        assert!(archived.archived);
    }

    #[test]
    fn test_archive_nonexistent_id() {
        let conn = setup_test_db();
        let result = archive_application_impl(&conn, 99999);
        assert!(result.is_err());
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("99999"), "error should mention the id");
    }

    // -------------------------------------------------------------------
    // add_status_change Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_add_status_change_updates_current_status() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();
        assert_eq!(a.current_status, "applied");

        let sc = add_status_change_impl(
            &conn,
            a.id,
            StatusChangeInput {
                status: "phone_screen".to_string(),
                changed_date: "2026-02-20".to_string(),
                notes: Some("Scheduled for next week".to_string()),
            },
        )
        .unwrap();

        assert_eq!(sc.status, "phone_screen");
        assert_eq!(sc.date, "2026-02-20");
        assert_eq!(sc.notes, "Scheduled for next week");
        assert_eq!(sc.application_id, a.id);

        let updated_app = query_application_by_id(&conn, a.id).unwrap().unwrap();
        assert_eq!(updated_app.current_status, "phone_screen");
    }

    #[test]
    fn test_add_status_change_with_no_notes() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        let sc = add_status_change_impl(
            &conn,
            a.id,
            StatusChangeInput {
                status: "interview".to_string(),
                changed_date: "2026-02-25".to_string(),
                notes: None,
            },
        )
        .unwrap();

        assert_eq!(sc.notes, "");
    }

    #[test]
    fn test_add_status_change_invalid_app_id() {
        let conn = setup_test_db();
        let result = add_status_change_impl(
            &conn,
            99999,
            StatusChangeInput {
                status: "interview".to_string(),
                changed_date: "2026-02-25".to_string(),
                notes: None,
            },
        );
        assert!(result.is_err());
        let err = format!("{}", result.unwrap_err());
        assert!(err.contains("99999"), "error should mention the id");
    }

    #[test]
    fn test_add_status_change_invalid_status() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        let result = add_status_change_impl(
            &conn,
            a.id,
            StatusChangeInput {
                status: "invalid_status".to_string(),
                changed_date: "2026-02-25".to_string(),
                notes: None,
            },
        );
        assert!(
            result.is_err(),
            "invalid status should be rejected by CHECK constraint"
        );
    }

    // -------------------------------------------------------------------
    // get_status_history Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_get_status_history_ordering() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));
        add_status_change_impl(
            &conn,
            a.id,
            StatusChangeInput {
                status: "phone_screen".to_string(),
                changed_date: "2026-02-20".to_string(),
                notes: None,
            },
        )
        .unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));
        add_status_change_impl(
            &conn,
            a.id,
            StatusChangeInput {
                status: "interview".to_string(),
                changed_date: "2026-02-25".to_string(),
                notes: None,
            },
        )
        .unwrap();

        let history = get_status_history_impl(&conn, a.id).unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].status, "applied");
        assert_eq!(history[1].status, "phone_screen");
        assert_eq!(history[2].status, "interview");
    }

    #[test]
    fn test_get_status_history_empty_for_nonexistent_app() {
        let conn = setup_test_db();
        let history = get_status_history_impl(&conn, 99999).unwrap();
        assert!(history.is_empty());
    }

    // -------------------------------------------------------------------
    // get_applications (filtered) Tests
    // -------------------------------------------------------------------

    #[test]
    fn test_get_applications_excludes_archived_by_default() {
        let conn = setup_test_db();
        let a1 = save_application_impl(&conn, make_default_app_input()).unwrap();

        let mut input2 = make_default_app_input();
        input2.company = "Other Corp".to_string();
        let a2 = save_application_impl(&conn, input2).unwrap();

        archive_application_impl(&conn, a1.id).unwrap();

        let results = get_applications_impl(
            &conn,
            AppFilters {
                status: None,
                search: None,
                include_archived: None,
            },
        )
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, a2.id);
    }

    #[test]
    fn test_get_applications_include_archived() {
        let conn = setup_test_db();
        save_application_impl(&conn, make_default_app_input()).unwrap();

        let mut input2 = make_default_app_input();
        input2.company = "Other Corp".to_string();
        let a2 = save_application_impl(&conn, input2).unwrap();

        archive_application_impl(&conn, a2.id).unwrap();

        let results = get_applications_impl(
            &conn,
            AppFilters {
                status: None,
                search: None,
                include_archived: Some(true),
            },
        )
        .unwrap();

        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_get_applications_filter_by_status() {
        let conn = setup_test_db();
        let a1 = save_application_impl(&conn, make_default_app_input()).unwrap();

        let mut input2 = make_default_app_input();
        input2.company = "Other Corp".to_string();
        let a2 = save_application_impl(&conn, input2).unwrap();

        // Advance a2 to interview
        add_status_change_impl(
            &conn,
            a2.id,
            StatusChangeInput {
                status: "interview".to_string(),
                changed_date: "2026-02-25".to_string(),
                notes: None,
            },
        )
        .unwrap();

        let results = get_applications_impl(
            &conn,
            AppFilters {
                status: Some(vec!["applied".to_string()]),
                search: None,
                include_archived: None,
            },
        )
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, a1.id);
    }

    #[test]
    fn test_get_applications_search_by_company() {
        let conn = setup_test_db();
        save_application_impl(&conn, make_default_app_input()).unwrap();

        let mut input2 = make_default_app_input();
        input2.company = "Globex Inc".to_string();
        save_application_impl(&conn, input2).unwrap();

        let results = get_applications_impl(
            &conn,
            AppFilters {
                status: None,
                search: Some("Globex".to_string()),
                include_archived: None,
            },
        )
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].company, "Globex Inc");
    }

    #[test]
    fn test_get_applications_search_by_role() {
        let conn = setup_test_db();
        save_application_impl(&conn, make_default_app_input()).unwrap();

        let mut input2 = make_default_app_input();
        input2.role = "Data Scientist".to_string();
        save_application_impl(&conn, input2).unwrap();

        let results = get_applications_impl(
            &conn,
            AppFilters {
                status: None,
                search: Some("Data".to_string()),
                include_archived: None,
            },
        )
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].role, "Data Scientist");
    }

    #[test]
    fn test_get_applications_ordered_by_date_desc() {
        let conn = setup_test_db();

        let mut input1 = make_default_app_input();
        input1.date_applied = "2026-02-10".to_string();
        save_application_impl(&conn, input1).unwrap();

        let mut input2 = make_default_app_input();
        input2.date_applied = "2026-02-20".to_string();
        save_application_impl(&conn, input2).unwrap();

        let mut input3 = make_default_app_input();
        input3.date_applied = "2026-02-15".to_string();
        save_application_impl(&conn, input3).unwrap();

        let results = get_applications_impl(
            &conn,
            AppFilters {
                status: None,
                search: None,
                include_archived: None,
            },
        )
        .unwrap();

        assert_eq!(results.len(), 3);
        assert_eq!(results[0].date_applied, "2026-02-20");
        assert_eq!(results[1].date_applied, "2026-02-15");
        assert_eq!(results[2].date_applied, "2026-02-10");
    }

    // -------------------------------------------------------------------
    // FK Constraint Test
    // -------------------------------------------------------------------

    #[test]
    fn test_fk_on_delete_restrict() {
        let conn = setup_test_db();
        let a = save_application_impl(&conn, make_default_app_input()).unwrap();

        // status_change rows exist (from save), so DELETE should be rejected
        let result = conn.execute("DELETE FROM application WHERE id = ?1", [a.id]);
        assert!(
            result.is_err(),
            "ON DELETE RESTRICT should prevent deleting application with status history"
        );
    }
}
