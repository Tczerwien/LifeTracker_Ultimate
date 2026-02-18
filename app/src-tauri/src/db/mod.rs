pub mod backup;
pub mod migrations;

use rusqlite::Connection;
use std::path::PathBuf;

/// Get the platform-specific database directory.
/// Per ADR-001 SD1: app_data_dir()/ltu.db
pub fn get_db_dir() -> PathBuf {
    let base = dirs::data_dir().expect("Could not determine app data directory");
    base.join("life-tracker-ultimate")
}

pub fn get_db_path() -> PathBuf {
    get_db_dir().join("ltu.db")
}

/// Initialize the database connection.
/// Creates the directory and file if they don't exist.
pub fn init_db() -> Result<Connection, Box<dyn std::error::Error>> {
    let db_dir = get_db_dir();
    std::fs::create_dir_all(&db_dir)?;

    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    Ok(conn)
}
