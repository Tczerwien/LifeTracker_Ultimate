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
    vec![
        (
            1,
            "initial_schema",
            include_str!("../../migrations/001_initial_schema.sql"),
        ),
        (
            2,
            "update_status_values",
            include_str!("../../migrations/002_update_status_values.sql"),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    /// Create an in-memory DB with FK enforcement and run all migrations.
    fn setup_test_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        run_migrations(&mut conn).expect("Migration should succeed");
        conn
    }

    #[test]
    fn all_11_tables_created() {
        let conn = setup_test_db();

        let expected = [
            "app_config",
            "application",
            "daily_log",
            "habit_config",
            "journal",
            "milestone",
            "relapse_entry",
            "status_change",
            "study_session",
            "urge_entry",
            "weekly_review",
        ];

        let mut stmt = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name != 'schema_migrations' ORDER BY name",
            )
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(tables, expected, "All 11 tables should exist");
    }

    #[test]
    fn all_11_indexes_created() {
        let conn = setup_test_db();

        let expected = [
            "idx_application_company",
            "idx_application_date",
            "idx_application_status",
            "idx_daily_log_date",
            "idx_journal_date",
            "idx_relapse_date",
            "idx_status_change_app",
            "idx_study_session_date",
            "idx_study_session_subject",
            "idx_urge_date",
            "idx_weekly_review_week",
        ];

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
            .unwrap();
        let indexes: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(indexes, expected, "All 11 indexes should exist");
    }

    #[test]
    fn seed_habit_config_counts() {
        let conn = setup_test_db();

        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM habit_config", [], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 22, "Should have 22 total habits");

        let good: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM habit_config WHERE pool = 'good'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(good, 13, "Should have 13 good habits");

        let vice: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM habit_config WHERE pool = 'vice'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(vice, 9, "Should have 9 vices");
    }

    #[test]
    fn seed_milestone_count() {
        let conn = setup_test_db();

        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM milestone", [], |row| row.get(0))
            .unwrap();
        assert_eq!(total, 20, "Should have 20 milestones");

        // Verify category breakdown
        let tracking: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM milestone WHERE category = 'tracking'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let score: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM milestone WHERE category = 'score'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let clean: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM milestone WHERE category = 'clean'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let study: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM milestone WHERE category = 'study'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(tracking, 2, "2 tracking milestones");
        assert_eq!(score, 5, "5 score milestones");
        assert_eq!(clean, 8, "8 clean milestones");
        assert_eq!(study, 5, "5 study milestones");
    }

    #[test]
    fn seed_app_config_singleton() {
        let conn = setup_test_db();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM app_config", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1, "Exactly 1 app_config row");

        let (id, start_date, target_fraction, vice_cap, correlation_window): (
            String,
            String,
            f64,
            f64,
            i64,
        ) = conn
            .query_row(
                "SELECT id, start_date, target_fraction, vice_cap, correlation_window_days FROM app_config",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .unwrap();

        assert_eq!(id, "default");
        assert_eq!(start_date, "2026-01-20");
        assert!((target_fraction - 0.85).abs() < f64::EPSILON);
        assert!((vice_cap - 0.40).abs() < f64::EPSILON);
        assert_eq!(correlation_window, 90);
    }

    #[test]
    fn seed_app_config_dropdown_options_valid() {
        let conn = setup_test_db();

        let json_str: String = conn
            .query_row(
                "SELECT dropdown_options FROM app_config WHERE id = 'default'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        let parsed: serde_json::Value =
            serde_json::from_str(&json_str).expect("dropdown_options should be valid JSON");

        let obj = parsed.as_object().expect("Should be a JSON object");

        let expected_keys = [
            "study_subjects",
            "study_types",
            "study_locations",
            "app_sources",
            "relapse_time_options",
            "relapse_duration_options",
            "relapse_trigger_options",
            "relapse_location_options",
            "relapse_device_options",
            "relapse_activity_before_options",
            "relapse_emotional_state_options",
            "relapse_resistance_technique_options",
            "urge_technique_options",
            "urge_duration_options",
            "urge_pass_options",
        ];

        assert_eq!(obj.len(), 15, "Should have exactly 15 keys");
        for key in &expected_keys {
            let arr = obj.get(*key).unwrap_or_else(|| panic!("Missing key: {}", key));
            assert!(arr.is_array(), "Value for {} should be an array", key);
            assert!(
                arr.as_array().unwrap().len() >= 2,
                "Array for {} should have >= 2 items",
                key
            );
        }
    }

    #[test]
    fn foreign_keys_enforced() {
        let conn = setup_test_db();

        // Inserting status_change with non-existent application_id should fail
        let result = conn.execute(
            "INSERT INTO status_change (application_id, status, date, notes, created_at) VALUES (9999, 'applied', '2026-01-20', '', '2026-01-20T00:00:00Z')",
            [],
        );

        assert!(result.is_err(), "FK constraint should reject invalid application_id");
    }

    #[test]
    fn migration_idempotent() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();

        run_migrations(&mut conn).expect("First migration run should succeed");
        run_migrations(&mut conn).expect("Second migration run should also succeed");

        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name != 'schema_migrations'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(table_count, 11, "Should still have exactly 11 tables");
    }
}
