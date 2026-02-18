use rusqlite::Connection;

/// Create the schema_migrations table if it doesn't exist
pub fn ensure_migrations_table(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )?;
    Ok(())
}

/// Get the highest applied migration version
pub fn get_current_version(conn: &Connection) -> Result<i64, rusqlite::Error> {
    ensure_migrations_table(conn)?;
    let version: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;
    Ok(version)
}

/// Run all pending migrations.
/// Each migration runs in its own transaction — if one fails, it rolls back
/// and returns an error without applying subsequent migrations.
pub fn run_migrations(conn: &mut Connection) -> Result<(), Box<dyn std::error::Error>> {
    ensure_migrations_table(conn)?;
    let current = get_current_version(conn)?;

    let migrations = get_migrations();

    for (version, name, sql) in migrations {
        if version > current {
            println!("Applying migration {}: {}", version, name);
            let tx = conn.transaction()?;
            tx.execute_batch(sql)?;
            tx.execute(
                "INSERT INTO schema_migrations (version) VALUES (?1)",
                [version],
            )?;
            tx.commit()?;
            println!("Migration {} applied successfully", version);
        }
    }

    Ok(())
}

/// Returns all migration definitions.
/// Migrations are embedded at compile time via include_str!() for reliability.
fn get_migrations() -> Vec<(i64, &'static str, &'static str)> {
    vec![(
        1,
        "initial_schema",
        include_str!("../../migrations/001_initial_schema.sql"),
    )]
}
