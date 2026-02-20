use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db;
use crate::AppState;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStats {
    pub file_size_bytes: i64,
    pub table_counts: Vec<TableCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableCount {
    pub table_name: String,
    pub count: i64,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// All data tables in the database (excludes schema_migrations).
/// Order matters for FK-safe import operations.
const ALL_TABLES: &[&str] = &[
    "app_config",
    "habit_config",
    "daily_log",
    "journal",
    "study_session",
    "application",
    "status_change",
    "urge_entry",
    "relapse_entry",
    "weekly_review",
    "milestone",
];

/// DELETE order: child tables first to respect FK constraints.
const DELETE_ORDER: &[&str] = &[
    "status_change",
    "relapse_entry",
    "urge_entry",
    "weekly_review",
    "milestone",
    "study_session",
    "journal",
    "daily_log",
    "application",
    "habit_config",
    "app_config",
];

/// INSERT order: parent tables first to respect FK constraints.
const INSERT_ORDER: &[&str] = &[
    "app_config",
    "habit_config",
    "daily_log",
    "journal",
    "study_session",
    "application",
    "status_change",
    "urge_entry",
    "relapse_entry",
    "weekly_review",
    "milestone",
];

// ---------------------------------------------------------------------------
// Generic Table Export/Import Helpers
// ---------------------------------------------------------------------------

/// Query all rows from a table and return them as a Vec of JSON objects.
/// Uses column metadata from the prepared statement for dynamic field names.
fn export_table(conn: &Connection, table: &str) -> CommandResult<Vec<Value>> {
    let sql = format!("SELECT * FROM {}", table);
    let mut stmt = conn.prepare(&sql)?;

    let column_names: Vec<String> = stmt
        .column_names()
        .iter()
        .map(|s| s.to_string())
        .collect();

    let rows = stmt.query_map([], |row| {
        let mut obj = serde_json::Map::new();
        for (i, col_name) in column_names.iter().enumerate() {
            // Try to extract as various types, falling back through the chain
            let value: Value = if let Ok(v) = row.get::<_, i64>(i) {
                Value::Number(v.into())
            } else if let Ok(v) = row.get::<_, f64>(i) {
                serde_json::Number::from_f64(v)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            } else if let Ok(v) = row.get::<_, String>(i) {
                Value::String(v)
            } else if let Ok(v) = row.get::<_, bool>(i) {
                Value::Bool(v)
            } else {
                // NULL or unsupported type
                Value::Null
            };
            obj.insert(col_name.clone(), value);
        }
        Ok(Value::Object(obj))
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

/// Import rows into a table from a JSON array.
/// Each JSON object's keys are used as column names.
fn import_table(conn: &Connection, table: &str, rows: &[Value]) -> CommandResult<()> {
    if rows.is_empty() {
        return Ok(());
    }

    // Get column names from first row
    let first = rows[0]
        .as_object()
        .ok_or_else(|| CommandError::from(format!("Invalid row data for table {}", table)))?;

    let columns: Vec<String> = first.keys().cloned().collect();
    let placeholders: Vec<String> = (1..=columns.len()).map(|i| format!("?{}", i)).collect();

    // Quote column names that are SQL reserved words
    let quoted_columns: Vec<String> = columns
        .iter()
        .map(|c| {
            if c == "read" {
                "\"read\"".to_string()
            } else {
                c.clone()
            }
        })
        .collect();

    let sql = format!(
        "INSERT INTO {} ({}) VALUES ({})",
        table,
        quoted_columns.join(", "),
        placeholders.join(", ")
    );

    let mut stmt = conn.prepare(&sql)?;

    for row in rows {
        let obj = row
            .as_object()
            .ok_or_else(|| CommandError::from(format!("Invalid row data for table {}", table)))?;

        let values: Vec<rusqlite::types::Value> = columns
            .iter()
            .map(|col| json_to_sqlite(obj.get(col).unwrap_or(&Value::Null)))
            .collect();

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            values.iter().map(|v| v as &dyn rusqlite::types::ToSql).collect();

        stmt.execute(param_refs.as_slice())?;
    }

    Ok(())
}

/// Convert a JSON value to a rusqlite value.
fn json_to_sqlite(v: &Value) -> rusqlite::types::Value {
    match v {
        Value::Null => rusqlite::types::Value::Null,
        Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                rusqlite::types::Value::Null
            }
        }
        Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        // For arrays/objects, serialize back to JSON string
        Value::Array(_) | Value::Object(_) => {
            rusqlite::types::Value::Text(v.to_string())
        }
    }
}

// ---------------------------------------------------------------------------
// Export Implementation
// ---------------------------------------------------------------------------

fn export_data_impl(conn: &Connection) -> CommandResult<String> {
    // 1. Collect row counts
    let mut row_counts = serde_json::Map::new();
    for table in ALL_TABLES {
        let count: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {}", table),
                [],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;
        row_counts.insert(table.to_string(), Value::Number(count.into()));
    }

    // 2. Build _meta block (ADR-001 SD2: self-describing for LLM analysis)
    let meta = serde_json::json!({
        "export_timestamp": chrono::Utc::now().to_rfc3339(),
        "schema_version": 1,
        "row_counts": Value::Object(row_counts),
        "description": "Life Tracker Ultimate data export. Tables: app_config (scoring parameters and settings), habit_config (habit/vice definitions with points and categories), daily_log (daily habit entries with computed scores), journal (daily mood/energy/reflection entries), study_session (academic study tracking), application (job applications), status_change (application pipeline history), urge_entry (urge resistance tracking), relapse_entry (relapse incidents), weekly_review (weekly reflection snapshots), milestone (achievement definitions and unlock state)."
    });

    // 3. Build export object with all tables
    let mut export = serde_json::Map::new();
    export.insert("_meta".to_string(), meta);

    for table in ALL_TABLES {
        let rows = export_table(conn, table)?;
        // app_config is a singleton — export as object, not array
        if *table == "app_config" {
            if let Some(first) = rows.into_iter().next() {
                export.insert(table.to_string(), first);
            } else {
                export.insert(table.to_string(), Value::Null);
            }
        } else {
            export.insert(table.to_string(), Value::Array(rows));
        }
    }

    serde_json::to_string_pretty(&Value::Object(export)).map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Import Implementation
// ---------------------------------------------------------------------------

fn import_data_impl(conn: &Connection, json: &str) -> CommandResult<()> {
    // 1. Parse JSON
    let data: Value = serde_json::from_str(json)?;
    let obj = data
        .as_object()
        .ok_or_else(|| CommandError::from("Import data must be a JSON object"))?;

    // 2. Validate _meta
    let meta = obj
        .get("_meta")
        .ok_or_else(|| CommandError::from("Missing _meta block in import data"))?;
    let schema_version = meta
        .get("schema_version")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| CommandError::from("Missing or invalid _meta.schema_version"))?;

    if schema_version != 1 {
        return Err(CommandError::from(format!(
            "Unsupported schema version: {}. Expected: 1",
            schema_version
        )));
    }

    // 3. Single transaction: DELETE ALL + INSERT
    {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        // DELETE in FK-safe order
        for table in DELETE_ORDER {
            tx.execute(&format!("DELETE FROM {}", table), [])?;
        }

        // INSERT in FK-safe order
        for table in INSERT_ORDER {
            if let Some(table_data) = obj.get(*table) {
                if *table == "app_config" {
                    // app_config is exported as an object, not an array
                    if table_data.is_object() {
                        import_table(&tx, table, &[table_data.clone()])?;
                    }
                } else if let Some(rows) = table_data.as_array() {
                    import_table(&tx, table, rows)?;
                }
            }
        }

        tx.commit()?;
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// DB Stats Implementation
// ---------------------------------------------------------------------------

fn get_db_stats_impl(conn: &Connection) -> CommandResult<DbStats> {
    // File size
    let db_path = db::get_db_path();
    let file_size_bytes = std::fs::metadata(&db_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    // Table counts
    let mut table_counts = Vec::with_capacity(ALL_TABLES.len());
    for table in ALL_TABLES {
        let count: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {}", table),
                [],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;
        table_counts.push(TableCount {
            table_name: table.to_string(),
            count,
        });
    }

    Ok(DbStats {
        file_size_bytes,
        table_counts,
    })
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn export_data(state: tauri::State<'_, AppState>) -> CommandResult<String> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    export_data_impl(&db)
}

#[tauri::command]
pub fn import_data(
    state: tauri::State<'_, AppState>,
    json: String,
) -> CommandResult<()> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    import_data_impl(&db, &json)
}

#[tauri::command]
pub fn get_db_stats(state: tauri::State<'_, AppState>) -> CommandResult<DbStats> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    get_db_stats_impl(&db)
}

#[tauri::command]
pub fn get_db_path() -> CommandResult<String> {
    Ok(db::get_db_path().to_string_lossy().to_string())
}

#[tauri::command]
pub fn backup_now(
    state: tauri::State<'_, AppState>,
    destination: String,
) -> CommandResult<String> {
    // Ensure we have the lock (prevents writes during copy)
    let _db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;

    let source = db::get_db_path();
    std::fs::copy(&source, &destination).map_err(|e| {
        CommandError::from(format!(
            "Failed to backup database to '{}': {}",
            destination, e
        ))
    })?;

    Ok(destination)
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

    // -----------------------------------------------------------------------
    // A. Export tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_export_data_has_meta_block() {
        let conn = setup_test_db();
        let json = export_data_impl(&conn).unwrap();
        let data: Value = serde_json::from_str(&json).unwrap();

        let meta = data.get("_meta").expect("_meta should exist");
        assert!(meta.get("export_timestamp").is_some());
        assert_eq!(meta.get("schema_version").unwrap().as_i64().unwrap(), 1);
        assert!(meta.get("row_counts").is_some());
        assert!(meta.get("description").is_some(), "_meta should include description (ADR-001 SD2)");
    }

    #[test]
    fn test_export_data_includes_all_tables() {
        let conn = setup_test_db();
        let json = export_data_impl(&conn).unwrap();
        let data: Value = serde_json::from_str(&json).unwrap();
        let obj = data.as_object().unwrap();

        for table in ALL_TABLES {
            assert!(
                obj.contains_key(*table),
                "Export should contain table: {}",
                table
            );
        }
    }

    #[test]
    fn test_export_data_row_counts_match() {
        let conn = setup_test_db();
        let json = export_data_impl(&conn).unwrap();
        let data: Value = serde_json::from_str(&json).unwrap();

        let row_counts = data["_meta"]["row_counts"].as_object().unwrap();

        // habit_config should have 22 seed rows
        assert_eq!(row_counts["habit_config"].as_i64().unwrap(), 22);

        // milestone should have 20 seed rows
        assert_eq!(row_counts["milestone"].as_i64().unwrap(), 20);

        // app_config should have 1 row
        assert_eq!(row_counts["app_config"].as_i64().unwrap(), 1);
    }

    #[test]
    fn test_export_app_config_is_object_not_array() {
        let conn = setup_test_db();
        let json = export_data_impl(&conn).unwrap();
        let data: Value = serde_json::from_str(&json).unwrap();

        assert!(data["app_config"].is_object());
        assert_eq!(
            data["app_config"]["id"].as_str().unwrap(),
            "default"
        );
    }

    #[test]
    fn test_export_habit_config_is_array() {
        let conn = setup_test_db();
        let json = export_data_impl(&conn).unwrap();
        let data: Value = serde_json::from_str(&json).unwrap();

        assert!(data["habit_config"].is_array());
        assert_eq!(data["habit_config"].as_array().unwrap().len(), 22);
    }

    // -----------------------------------------------------------------------
    // B. Import tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_import_data_round_trip() {
        let conn = setup_test_db();

        // Export the seed data
        let exported_json = export_data_impl(&conn).unwrap();

        // Import into same DB (replaces data)
        import_data_impl(&conn, &exported_json).unwrap();

        // Verify seed data is intact
        let habit_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM habit_config", [], |row| row.get(0))
            .unwrap();
        assert_eq!(habit_count, 22);

        let milestone_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM milestone", [], |row| row.get(0))
            .unwrap();
        assert_eq!(milestone_count, 20);

        let config_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_config", [], |row| row.get(0))
            .unwrap();
        assert_eq!(config_count, 1);
    }

    #[test]
    fn test_import_data_invalid_json() {
        let conn = setup_test_db();
        let result = import_data_impl(&conn, "not valid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_import_data_wrong_schema_version() {
        let conn = setup_test_db();
        let json = r#"{"_meta": {"schema_version": 99, "row_counts": {}}}"#;
        let result = import_data_impl(&conn, json);
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("Unsupported schema version"));
    }

    #[test]
    fn test_import_data_missing_meta() {
        let conn = setup_test_db();
        let json = r#"{"habit_config": []}"#;
        let result = import_data_impl(&conn, json);
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("_meta"));
    }

    #[test]
    fn test_import_data_rolls_back_on_error() {
        let conn = setup_test_db();

        // Count milestones before
        let before: i64 = conn
            .query_row("SELECT COUNT(*) FROM milestone", [], |row| row.get(0))
            .unwrap();

        // Attempt import with valid _meta but invalid table data
        // (app_config with wrong column names will fail)
        let json = r#"{
            "_meta": {"schema_version": 1, "row_counts": {}},
            "app_config": {"nonexistent_column": "value"}
        }"#;
        let result = import_data_impl(&conn, json);
        assert!(result.is_err());

        // Data should be unchanged (rolled back)
        let after: i64 = conn
            .query_row("SELECT COUNT(*) FROM milestone", [], |row| row.get(0))
            .unwrap();
        assert_eq!(before, after);
    }

    // -----------------------------------------------------------------------
    // C. DB Stats tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_db_stats_table_counts() {
        let conn = setup_test_db();
        // For in-memory DB, file_size won't work but table counts should
        let stats = get_db_stats_impl(&conn).unwrap();

        assert_eq!(stats.table_counts.len(), ALL_TABLES.len());

        let habit_count = stats
            .table_counts
            .iter()
            .find(|t| t.table_name == "habit_config")
            .unwrap();
        assert_eq!(habit_count.count, 22);

        let milestone_count = stats
            .table_counts
            .iter()
            .find(|t| t.table_name == "milestone")
            .unwrap();
        assert_eq!(milestone_count.count, 20);
    }

    // -----------------------------------------------------------------------
    // D. DB Path test
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_db_path_returns_string() {
        let path = db::get_db_path().to_string_lossy().to_string();
        assert!(!path.is_empty());
        assert!(path.contains("ltu.db"));
    }
}
