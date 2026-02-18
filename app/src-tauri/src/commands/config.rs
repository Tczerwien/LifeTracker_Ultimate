use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};
use crate::AppState;

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub id: String,
    pub start_date: String,
    pub multiplier_productivity: f64,
    pub multiplier_health: f64,
    pub multiplier_growth: f64,
    pub target_fraction: f64,
    pub vice_cap: f64,
    pub streak_threshold: f64,
    pub streak_bonus_per_day: f64,
    pub max_streak_bonus: f64,
    pub phone_t1_min: i64,
    pub phone_t2_min: i64,
    pub phone_t3_min: i64,
    pub phone_t1_penalty: f64,
    pub phone_t2_penalty: f64,
    pub phone_t3_penalty: f64,
    pub correlation_window_days: i64,
    pub dropdown_options: String,
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfigInput {
    pub start_date: String,
    pub multiplier_productivity: f64,
    pub multiplier_health: f64,
    pub multiplier_growth: f64,
    pub target_fraction: f64,
    pub vice_cap: f64,
    pub streak_threshold: f64,
    pub streak_bonus_per_day: f64,
    pub max_streak_bonus: f64,
    pub phone_t1_min: i64,
    pub phone_t2_min: i64,
    pub phone_t3_min: i64,
    pub phone_t1_penalty: f64,
    pub phone_t2_penalty: f64,
    pub phone_t3_penalty: f64,
    pub correlation_window_days: i64,
    pub dropdown_options: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitConfig {
    pub id: i64,
    pub name: String,
    pub display_name: String,
    pub pool: String,
    pub category: Option<String>,
    pub input_type: String,
    pub points: f64,
    pub penalty: f64,
    pub penalty_mode: String,
    pub options_json: Option<String>,
    pub sort_order: i64,
    pub is_active: bool,
    pub column_name: String,
    pub created_at: String,
    pub retired_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HabitConfigInput {
    pub id: Option<i64>,
    pub name: String,
    pub display_name: String,
    pub pool: String,
    pub category: Option<String>,
    pub input_type: String,
    pub points: f64,
    pub penalty: f64,
    pub penalty_mode: String,
    pub options_json: Option<String>,
    pub sort_order: i64,
    pub is_active: bool,
    pub column_name: String,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_CONFIG_COLUMNS: &str = "\
    id, start_date, \
    multiplier_productivity, multiplier_health, multiplier_growth, \
    target_fraction, vice_cap, streak_threshold, streak_bonus_per_day, max_streak_bonus, \
    phone_t1_min, phone_t2_min, phone_t3_min, \
    phone_t1_penalty, phone_t2_penalty, phone_t3_penalty, \
    correlation_window_days, \
    dropdown_options, \
    last_modified";

const HABIT_CONFIG_COLUMNS: &str = "\
    id, name, display_name, pool, category, \
    input_type, points, penalty, penalty_mode, options_json, \
    sort_order, is_active, column_name, \
    created_at, retired_at";

const VALID_CORRELATION_WINDOWS: [i64; 6] = [0, 30, 60, 90, 180, 365];

// ---------------------------------------------------------------------------
// Row Mappers
// ---------------------------------------------------------------------------

fn row_to_app_config(row: &rusqlite::Row) -> rusqlite::Result<AppConfig> {
    Ok(AppConfig {
        id: row.get(0)?,
        start_date: row.get(1)?,
        multiplier_productivity: row.get(2)?,
        multiplier_health: row.get(3)?,
        multiplier_growth: row.get(4)?,
        target_fraction: row.get(5)?,
        vice_cap: row.get(6)?,
        streak_threshold: row.get(7)?,
        streak_bonus_per_day: row.get(8)?,
        max_streak_bonus: row.get(9)?,
        phone_t1_min: row.get(10)?,
        phone_t2_min: row.get(11)?,
        phone_t3_min: row.get(12)?,
        phone_t1_penalty: row.get(13)?,
        phone_t2_penalty: row.get(14)?,
        phone_t3_penalty: row.get(15)?,
        correlation_window_days: row.get(16)?,
        dropdown_options: row.get(17)?,
        last_modified: row.get(18)?,
    })
}

fn row_to_habit_config(row: &rusqlite::Row) -> rusqlite::Result<HabitConfig> {
    Ok(HabitConfig {
        id: row.get(0)?,
        name: row.get(1)?,
        display_name: row.get(2)?,
        pool: row.get(3)?,
        category: row.get(4)?,
        input_type: row.get(5)?,
        points: row.get(6)?,
        penalty: row.get(7)?,
        penalty_mode: row.get(8)?,
        options_json: row.get(9)?,
        sort_order: row.get(10)?,
        is_active: row.get(11)?,
        column_name: row.get(12)?,
        created_at: row.get(13)?,
        retired_at: row.get(14)?,
    })
}

// ---------------------------------------------------------------------------
// Query Helpers
// ---------------------------------------------------------------------------

fn query_config(conn: &Connection) -> CommandResult<AppConfig> {
    let sql = format!(
        "SELECT {} FROM app_config WHERE id = 'default'",
        APP_CONFIG_COLUMNS
    );
    conn.query_row(&sql, [], row_to_app_config)
        .map_err(CommandError::from)
}

fn query_habit_config_by_id(conn: &Connection, id: i64) -> CommandResult<Option<HabitConfig>> {
    let sql = format!(
        "SELECT {} FROM habit_config WHERE id = ?1",
        HABIT_CONFIG_COLUMNS
    );
    conn.query_row(&sql, [id], row_to_habit_config)
        .optional()
        .map_err(CommandError::from)
}

fn query_all_habit_configs(conn: &Connection) -> CommandResult<Vec<HabitConfig>> {
    let sql = format!(
        "SELECT {} FROM habit_config ORDER BY sort_order ASC",
        HABIT_CONFIG_COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_habit_config)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

fn validate_app_config_input(input: &AppConfigInput) -> CommandResult<()> {
    // All multipliers > 0
    if input.multiplier_productivity <= 0.0 {
        return Err(CommandError::from(
            "multiplier_productivity must be greater than 0",
        ));
    }
    if input.multiplier_health <= 0.0 {
        return Err(CommandError::from(
            "multiplier_health must be greater than 0",
        ));
    }
    if input.multiplier_growth <= 0.0 {
        return Err(CommandError::from(
            "multiplier_growth must be greater than 0",
        ));
    }

    // target_fraction: (0, 1.0]
    if input.target_fraction <= 0.0 || input.target_fraction > 1.0 {
        return Err(CommandError::from(
            "target_fraction must be > 0 and <= 1.0",
        ));
    }

    // vice_cap: [0, 1.0]
    if input.vice_cap < 0.0 || input.vice_cap > 1.0 {
        return Err(CommandError::from("vice_cap must be >= 0 and <= 1.0"));
    }

    // streak_threshold: [0, 1.0]
    if input.streak_threshold < 0.0 || input.streak_threshold > 1.0 {
        return Err(CommandError::from(
            "streak_threshold must be >= 0 and <= 1.0",
        ));
    }

    // streak_bonus_per_day: [0, 0.1]
    if input.streak_bonus_per_day < 0.0 || input.streak_bonus_per_day > 0.1 {
        return Err(CommandError::from(
            "streak_bonus_per_day must be >= 0 and <= 0.1",
        ));
    }

    // max_streak_bonus: [0, 0.5]
    if input.max_streak_bonus < 0.0 || input.max_streak_bonus > 0.5 {
        return Err(CommandError::from(
            "max_streak_bonus must be >= 0 and <= 0.5",
        ));
    }

    // Phone tier thresholds: [0, 1440] and ascending
    if input.phone_t1_min < 0 || input.phone_t1_min > 1440 {
        return Err(CommandError::from(
            "phone_t1_min must be >= 0 and <= 1440",
        ));
    }
    if input.phone_t2_min < 0 || input.phone_t2_min > 1440 {
        return Err(CommandError::from(
            "phone_t2_min must be >= 0 and <= 1440",
        ));
    }
    if input.phone_t3_min < 0 || input.phone_t3_min > 1440 {
        return Err(CommandError::from(
            "phone_t3_min must be >= 0 and <= 1440",
        ));
    }
    if input.phone_t1_min >= input.phone_t2_min {
        return Err(CommandError::from(
            "Phone tiers must be ascending: phone_t1_min < phone_t2_min",
        ));
    }
    if input.phone_t2_min >= input.phone_t3_min {
        return Err(CommandError::from(
            "Phone tiers must be ascending: phone_t2_min < phone_t3_min",
        ));
    }

    // Phone penalties: [0, 1.0] and ascending
    if input.phone_t1_penalty < 0.0 || input.phone_t1_penalty > 1.0 {
        return Err(CommandError::from(
            "phone_t1_penalty must be >= 0 and <= 1.0",
        ));
    }
    if input.phone_t2_penalty < 0.0 || input.phone_t2_penalty > 1.0 {
        return Err(CommandError::from(
            "phone_t2_penalty must be >= 0 and <= 1.0",
        ));
    }
    if input.phone_t3_penalty < 0.0 || input.phone_t3_penalty > 1.0 {
        return Err(CommandError::from(
            "phone_t3_penalty must be >= 0 and <= 1.0",
        ));
    }
    if input.phone_t1_penalty >= input.phone_t2_penalty {
        return Err(CommandError::from(
            "Phone penalties must be ascending: phone_t1_penalty < phone_t2_penalty",
        ));
    }
    if input.phone_t2_penalty >= input.phone_t3_penalty {
        return Err(CommandError::from(
            "Phone penalties must be ascending: phone_t2_penalty < phone_t3_penalty",
        ));
    }

    // correlation_window_days: must be in {0, 30, 60, 90, 180, 365}
    if !VALID_CORRELATION_WINDOWS.contains(&input.correlation_window_days) {
        return Err(CommandError::from(
            "correlation_window_days must be one of: 0, 30, 60, 90, 180, 365",
        ));
    }

    Ok(())
}

fn validate_habit_config_input(
    conn: &Connection,
    input: &HabitConfigInput,
) -> CommandResult<()> {
    // Name uniqueness (case-insensitive), excluding own id if updating
    let name_lower = input.name.to_lowercase();
    let duplicate_exists: bool = match input.id {
        Some(id) => conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM habit_config WHERE LOWER(name) = ?1 AND id != ?2",
                params![name_lower, id],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?,
        None => conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM habit_config WHERE LOWER(name) = ?1",
                params![name_lower],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?,
    };

    if duplicate_exists {
        return Err(CommandError::from(format!(
            "A habit with name '{}' already exists (case-insensitive)",
            input.name
        )));
    }

    // points >= 0
    if input.points < 0.0 {
        return Err(CommandError::from("points must be >= 0"));
    }

    // Pool-specific constraints
    if input.pool == "good" && input.penalty != 0.0 {
        return Err(CommandError::from(
            "Good habits must have penalty = 0",
        ));
    }
    if input.pool == "vice" && input.points != 0.0 {
        return Err(CommandError::from(
            "Vice habits must have points = 0",
        ));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_config(state: tauri::State<'_, AppState>) -> CommandResult<AppConfig> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_config(&db)
}

#[tauri::command]
pub fn save_config(
    state: tauri::State<'_, AppState>,
    config: AppConfigInput,
) -> CommandResult<AppConfig> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;

    validate_app_config_input(&config)?;

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "UPDATE app_config SET \
         start_date = ?1, \
         multiplier_productivity = ?2, multiplier_health = ?3, multiplier_growth = ?4, \
         target_fraction = ?5, vice_cap = ?6, streak_threshold = ?7, \
         streak_bonus_per_day = ?8, max_streak_bonus = ?9, \
         phone_t1_min = ?10, phone_t2_min = ?11, phone_t3_min = ?12, \
         phone_t1_penalty = ?13, phone_t2_penalty = ?14, phone_t3_penalty = ?15, \
         correlation_window_days = ?16, \
         dropdown_options = ?17, \
         last_modified = ?18 \
         WHERE id = 'default'",
        params![
            config.start_date,
            config.multiplier_productivity,
            config.multiplier_health,
            config.multiplier_growth,
            config.target_fraction,
            config.vice_cap,
            config.streak_threshold,
            config.streak_bonus_per_day,
            config.max_streak_bonus,
            config.phone_t1_min,
            config.phone_t2_min,
            config.phone_t3_min,
            config.phone_t1_penalty,
            config.phone_t2_penalty,
            config.phone_t3_penalty,
            config.correlation_window_days,
            config.dropdown_options,
            now,
        ],
    )?;

    // ADR-002 SD1: Prospective only — do NOT recompute past scores

    query_config(&db)
}

#[tauri::command]
pub fn get_habit_configs(
    state: tauri::State<'_, AppState>,
) -> CommandResult<Vec<HabitConfig>> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;
    query_all_habit_configs(&db)
}

#[tauri::command]
pub fn save_habit_config(
    state: tauri::State<'_, AppState>,
    habit: HabitConfigInput,
) -> CommandResult<HabitConfig> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;

    validate_habit_config_input(&db, &habit)?;

    let now = chrono::Utc::now().to_rfc3339();

    let saved_id: i64 = match habit.id {
        Some(id) => {
            // Verify the habit exists
            let exists: bool = db
                .query_row(
                    "SELECT COUNT(*) > 0 FROM habit_config WHERE id = ?1",
                    [id],
                    |row| row.get(0),
                )
                .map_err(CommandError::from)?;

            if !exists {
                return Err(CommandError::from(format!(
                    "Habit config with id {} not found",
                    id
                )));
            }

            db.execute(
                "UPDATE habit_config SET \
                 name = ?2, display_name = ?3, pool = ?4, category = ?5, \
                 input_type = ?6, points = ?7, penalty = ?8, penalty_mode = ?9, \
                 options_json = ?10, sort_order = ?11, is_active = ?12, column_name = ?13 \
                 WHERE id = ?1",
                params![
                    id,
                    habit.name,
                    habit.display_name,
                    habit.pool,
                    habit.category,
                    habit.input_type,
                    habit.points,
                    habit.penalty,
                    habit.penalty_mode,
                    habit.options_json,
                    habit.sort_order,
                    habit.is_active,
                    habit.column_name,
                ],
            )?;
            id
        }
        None => {
            db.execute(
                "INSERT INTO habit_config (\
                 name, display_name, pool, category, \
                 input_type, points, penalty, penalty_mode, \
                 options_json, sort_order, is_active, column_name, \
                 created_at, retired_at\
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)",
                params![
                    habit.name,
                    habit.display_name,
                    habit.pool,
                    habit.category,
                    habit.input_type,
                    habit.points,
                    habit.penalty,
                    habit.penalty_mode,
                    habit.options_json,
                    habit.sort_order,
                    habit.is_active,
                    habit.column_name,
                    now,
                ],
            )?;
            db.last_insert_rowid()
        }
    };

    query_habit_config_by_id(&db, saved_id)?
        .ok_or_else(|| CommandError::from("Failed to read back saved habit config"))
}

#[tauri::command]
pub fn retire_habit(
    state: tauri::State<'_, AppState>,
    id: i64,
) -> CommandResult<()> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;

    // Fetch existing habit
    let habit = query_habit_config_by_id(&db, id)?
        .ok_or_else(|| CommandError::from(format!("Habit config with id {} not found", id)))?;

    if !habit.is_active {
        return Err(CommandError::from(format!(
            "Habit '{}' is already retired",
            habit.name
        )));
    }

    // H19: Cannot retire the last active good habit
    if habit.pool == "good" {
        let active_good_count: i64 = db
            .query_row(
                "SELECT COUNT(*) FROM habit_config WHERE pool = 'good' AND is_active = 1",
                [],
                |row| row.get(0),
            )
            .map_err(CommandError::from)?;

        if active_good_count <= 1 {
            return Err(CommandError::from(
                "Cannot retire the last active good habit",
            ));
        }
    }

    let now = chrono::Utc::now().to_rfc3339();

    db.execute(
        "UPDATE habit_config SET is_active = 0, retired_at = ?2 WHERE id = ?1",
        params![id, now],
    )?;

    Ok(())
}

#[tauri::command]
pub fn reorder_habits(
    state: tauri::State<'_, AppState>,
    ids: Vec<i64>,
) -> CommandResult<()> {
    let db = state
        .db
        .lock()
        .map_err(|_| CommandError::from("DB lock poisoned"))?;

    {
        let tx = db
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        for (index, id) in ids.iter().enumerate() {
            tx.execute(
                "UPDATE habit_config SET sort_order = ?1 WHERE id = ?2",
                params![index as i64, id],
            )?;
        }

        tx.commit()?;
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
        run_migrations(&mut conn).expect("Migrations should succeed");
        conn
    }

    // -- get_config tests --

    #[test]
    fn test_get_config_returns_seed_data() {
        let conn = setup_test_db();
        let config = query_config(&conn).unwrap();

        assert_eq!(config.id, "default");
        assert_eq!(config.start_date, "2026-01-20");
        assert_eq!(config.multiplier_productivity, 1.5);
        assert_eq!(config.multiplier_health, 1.3);
        assert_eq!(config.multiplier_growth, 1.0);
        assert_eq!(config.target_fraction, 0.85);
        assert_eq!(config.vice_cap, 0.40);
        assert_eq!(config.streak_threshold, 0.65);
        assert_eq!(config.streak_bonus_per_day, 0.01);
        assert_eq!(config.max_streak_bonus, 0.10);
        assert_eq!(config.phone_t1_min, 61);
        assert_eq!(config.phone_t2_min, 181);
        assert_eq!(config.phone_t3_min, 301);
        assert_eq!(config.phone_t1_penalty, 0.03);
        assert_eq!(config.phone_t2_penalty, 0.07);
        assert_eq!(config.phone_t3_penalty, 0.12);
        assert_eq!(config.correlation_window_days, 90);
    }

    // -- save_config tests --

    fn make_default_config_input() -> AppConfigInput {
        AppConfigInput {
            start_date: "2026-01-20".to_string(),
            multiplier_productivity: 1.5,
            multiplier_health: 1.3,
            multiplier_growth: 1.0,
            target_fraction: 0.85,
            vice_cap: 0.40,
            streak_threshold: 0.65,
            streak_bonus_per_day: 0.01,
            max_streak_bonus: 0.10,
            phone_t1_min: 61,
            phone_t2_min: 181,
            phone_t3_min: 301,
            phone_t1_penalty: 0.03,
            phone_t2_penalty: 0.07,
            phone_t3_penalty: 0.12,
            correlation_window_days: 90,
            dropdown_options: "{}".to_string(),
        }
    }

    fn save_config_direct(conn: &Connection, config: AppConfigInput) -> CommandResult<AppConfig> {
        validate_app_config_input(&config)?;

        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE app_config SET \
             start_date = ?1, \
             multiplier_productivity = ?2, multiplier_health = ?3, multiplier_growth = ?4, \
             target_fraction = ?5, vice_cap = ?6, streak_threshold = ?7, \
             streak_bonus_per_day = ?8, max_streak_bonus = ?9, \
             phone_t1_min = ?10, phone_t2_min = ?11, phone_t3_min = ?12, \
             phone_t1_penalty = ?13, phone_t2_penalty = ?14, phone_t3_penalty = ?15, \
             correlation_window_days = ?16, \
             dropdown_options = ?17, \
             last_modified = ?18 \
             WHERE id = 'default'",
            params![
                config.start_date,
                config.multiplier_productivity,
                config.multiplier_health,
                config.multiplier_growth,
                config.target_fraction,
                config.vice_cap,
                config.streak_threshold,
                config.streak_bonus_per_day,
                config.max_streak_bonus,
                config.phone_t1_min,
                config.phone_t2_min,
                config.phone_t3_min,
                config.phone_t1_penalty,
                config.phone_t2_penalty,
                config.phone_t3_penalty,
                config.correlation_window_days,
                config.dropdown_options,
                now,
            ],
        )?;

        query_config(conn)
    }

    #[test]
    fn test_save_config_updates_fields() {
        let conn = setup_test_db();
        let mut input = make_default_config_input();
        input.multiplier_productivity = 2.0;
        input.multiplier_health = 1.5;
        input.vice_cap = 0.50;

        let result = save_config_direct(&conn, input).unwrap();
        assert_eq!(result.multiplier_productivity, 2.0);
        assert_eq!(result.multiplier_health, 1.5);
        assert_eq!(result.vice_cap, 0.50);
    }

    #[test]
    fn test_save_config_updates_last_modified() {
        let conn = setup_test_db();
        let original = query_config(&conn).unwrap();
        let input = make_default_config_input();

        let result = save_config_direct(&conn, input).unwrap();
        assert_ne!(result.last_modified, original.last_modified);
    }

    #[test]
    fn test_save_config_rejects_negative_multiplier() {
        let conn = setup_test_db();
        let mut input = make_default_config_input();
        input.multiplier_productivity = -1.0;

        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("multiplier_productivity"));
    }

    #[test]
    fn test_save_config_rejects_zero_multiplier() {
        let conn = setup_test_db();
        let mut input = make_default_config_input();
        input.multiplier_growth = 0.0;

        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_config_rejects_target_fraction_over_one() {
        let conn = setup_test_db();
        let mut input = make_default_config_input();
        input.target_fraction = 1.5;

        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("target_fraction"));
    }

    #[test]
    fn test_save_config_rejects_unordered_phone_tiers() {
        let conn = setup_test_db();

        // t1 >= t2
        let mut input = make_default_config_input();
        input.phone_t1_min = 200;
        input.phone_t2_min = 181;
        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("ascending"));

        // t2 >= t3
        let mut input = make_default_config_input();
        input.phone_t2_min = 400;
        input.phone_t3_min = 301;
        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
    }

    #[test]
    fn test_save_config_rejects_unordered_phone_penalties() {
        let conn = setup_test_db();

        let mut input = make_default_config_input();
        input.phone_t1_penalty = 0.10;
        input.phone_t2_penalty = 0.07;
        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("ascending"));
    }

    #[test]
    fn test_save_config_rejects_invalid_correlation_window() {
        let conn = setup_test_db();
        let mut input = make_default_config_input();
        input.correlation_window_days = 45;

        let result = save_config_direct(&conn, input);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("correlation_window_days"));
    }

    // -- get_habit_configs tests --

    #[test]
    fn test_get_habit_configs_returns_seed_data() {
        let conn = setup_test_db();
        let habits = query_all_habit_configs(&conn).unwrap();

        // 13 good + 9 vice = 22 seed habits
        assert_eq!(habits.len(), 22);

        // Verify first good habit
        let schoolwork = habits.iter().find(|h| h.name == "schoolwork").unwrap();
        assert_eq!(schoolwork.pool, "good");
        assert_eq!(schoolwork.category, Some("Productivity".to_string()));
        assert_eq!(schoolwork.points, 3.0);
        assert!(schoolwork.is_active);

        // Verify a vice
        let porn = habits.iter().find(|h| h.name == "porn").unwrap();
        assert_eq!(porn.pool, "vice");
        assert_eq!(porn.category, None);
        assert_eq!(porn.points, 0.0);
        assert_eq!(porn.penalty, 0.25);
        assert_eq!(porn.penalty_mode, "per_instance");
    }

    // -- save_habit_config tests --

    fn make_new_habit_input(name: &str, pool: &str) -> HabitConfigInput {
        HabitConfigInput {
            id: None,
            name: name.to_string(),
            display_name: name.to_string(),
            pool: pool.to_string(),
            category: if pool == "good" {
                Some("Health".to_string())
            } else {
                None
            },
            input_type: "checkbox".to_string(),
            points: if pool == "good" { 2.0 } else { 0.0 },
            penalty: if pool == "vice" { 0.05 } else { 0.0 },
            penalty_mode: "flat".to_string(),
            options_json: None,
            sort_order: 100,
            is_active: true,
            column_name: name.to_string(),
        }
    }

    fn save_habit_direct(
        conn: &Connection,
        habit: HabitConfigInput,
    ) -> CommandResult<HabitConfig> {
        validate_habit_config_input(conn, &habit)?;

        let now = chrono::Utc::now().to_rfc3339();

        let saved_id: i64 = match habit.id {
            Some(id) => {
                let exists: bool = conn
                    .query_row(
                        "SELECT COUNT(*) > 0 FROM habit_config WHERE id = ?1",
                        [id],
                        |row| row.get(0),
                    )
                    .map_err(CommandError::from)?;

                if !exists {
                    return Err(CommandError::from(format!(
                        "Habit config with id {} not found",
                        id
                    )));
                }

                conn.execute(
                    "UPDATE habit_config SET \
                     name = ?2, display_name = ?3, pool = ?4, category = ?5, \
                     input_type = ?6, points = ?7, penalty = ?8, penalty_mode = ?9, \
                     options_json = ?10, sort_order = ?11, is_active = ?12, column_name = ?13 \
                     WHERE id = ?1",
                    params![
                        id,
                        habit.name,
                        habit.display_name,
                        habit.pool,
                        habit.category,
                        habit.input_type,
                        habit.points,
                        habit.penalty,
                        habit.penalty_mode,
                        habit.options_json,
                        habit.sort_order,
                        habit.is_active,
                        habit.column_name,
                    ],
                )?;
                id
            }
            None => {
                conn.execute(
                    "INSERT INTO habit_config (\
                     name, display_name, pool, category, \
                     input_type, points, penalty, penalty_mode, \
                     options_json, sort_order, is_active, column_name, \
                     created_at, retired_at\
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)",
                    params![
                        habit.name,
                        habit.display_name,
                        habit.pool,
                        habit.category,
                        habit.input_type,
                        habit.points,
                        habit.penalty,
                        habit.penalty_mode,
                        habit.options_json,
                        habit.sort_order,
                        habit.is_active,
                        habit.column_name,
                        now,
                    ],
                )?;
                conn.last_insert_rowid()
            }
        };

        query_habit_config_by_id(conn, saved_id)?
            .ok_or_else(|| CommandError::from("Failed to read back saved habit config"))
    }

    #[test]
    fn test_save_habit_config_insert_new() {
        let conn = setup_test_db();
        let input = make_new_habit_input("yoga", "good");

        let result = save_habit_direct(&conn, input).unwrap();
        assert_eq!(result.name, "yoga");
        assert_eq!(result.pool, "good");
        assert_eq!(result.points, 2.0);
        assert!(result.is_active);
        assert!(result.retired_at.is_none());

        // Should now have 23 habits
        let all = query_all_habit_configs(&conn).unwrap();
        assert_eq!(all.len(), 23);
    }

    #[test]
    fn test_save_habit_config_update_existing() {
        let conn = setup_test_db();

        // Find an existing habit
        let habits = query_all_habit_configs(&conn).unwrap();
        let gym = habits.iter().find(|h| h.name == "gym").unwrap();

        let input = HabitConfigInput {
            id: Some(gym.id),
            name: gym.name.clone(),
            display_name: "Gym Workout".to_string(),
            pool: gym.pool.clone(),
            category: gym.category.clone(),
            input_type: gym.input_type.clone(),
            points: 4.0,
            penalty: 0.0,
            penalty_mode: gym.penalty_mode.clone(),
            options_json: gym.options_json.clone(),
            sort_order: gym.sort_order,
            is_active: gym.is_active,
            column_name: gym.column_name.clone(),
        };

        let result = save_habit_direct(&conn, input).unwrap();
        assert_eq!(result.display_name, "Gym Workout");
        assert_eq!(result.points, 4.0);

        // Count should remain 22
        let all = query_all_habit_configs(&conn).unwrap();
        assert_eq!(all.len(), 22);
    }

    #[test]
    fn test_save_habit_config_rejects_duplicate_name() {
        let conn = setup_test_db();

        // Try to insert a habit with a name that already exists (case-insensitive)
        let input = make_new_habit_input("Schoolwork", "good");
        let result = save_habit_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("already exists"));
    }

    #[test]
    fn test_save_habit_config_rejects_duplicate_name_case_insensitive() {
        let conn = setup_test_db();

        let input = make_new_habit_input("SCHOOLWORK", "good");
        let result = save_habit_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("already exists"));
    }

    #[test]
    fn test_save_habit_config_rejects_good_with_penalty() {
        let conn = setup_test_db();
        let mut input = make_new_habit_input("pilates", "good");
        input.penalty = 0.05;

        let result = save_habit_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("penalty = 0"));
    }

    #[test]
    fn test_save_habit_config_rejects_vice_with_points() {
        let conn = setup_test_db();
        let mut input = make_new_habit_input("junk_food", "vice");
        input.points = 2.0;

        let result = save_habit_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("points = 0"));
    }

    #[test]
    fn test_save_habit_config_update_nonexistent_id() {
        let conn = setup_test_db();
        let mut input = make_new_habit_input("ghost", "good");
        input.id = Some(99999);

        let result = save_habit_direct(&conn, input);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    // -- retire_habit tests --

    fn retire_habit_direct(conn: &Connection, id: i64) -> CommandResult<()> {
        let habit = query_habit_config_by_id(conn, id)?
            .ok_or_else(|| {
                CommandError::from(format!("Habit config with id {} not found", id))
            })?;

        if !habit.is_active {
            return Err(CommandError::from(format!(
                "Habit '{}' is already retired",
                habit.name
            )));
        }

        if habit.pool == "good" {
            let active_good_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM habit_config WHERE pool = 'good' AND is_active = 1",
                    [],
                    |row| row.get(0),
                )
                .map_err(CommandError::from)?;

            if active_good_count <= 1 {
                return Err(CommandError::from(
                    "Cannot retire the last active good habit",
                ));
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE habit_config SET is_active = 0, retired_at = ?2 WHERE id = ?1",
            params![id, now],
        )?;

        Ok(())
    }

    #[test]
    fn test_retire_habit_success() {
        let conn = setup_test_db();
        let habits = query_all_habit_configs(&conn).unwrap();
        let gym = habits.iter().find(|h| h.name == "gym").unwrap();

        retire_habit_direct(&conn, gym.id).unwrap();

        let updated = query_habit_config_by_id(&conn, gym.id).unwrap().unwrap();
        assert!(!updated.is_active);
        assert!(updated.retired_at.is_some());
    }

    #[test]
    fn test_retire_habit_already_retired() {
        let conn = setup_test_db();
        let habits = query_all_habit_configs(&conn).unwrap();
        let gym = habits.iter().find(|h| h.name == "gym").unwrap();

        retire_habit_direct(&conn, gym.id).unwrap();

        // Try again
        let result = retire_habit_direct(&conn, gym.id);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("already retired"));
    }

    #[test]
    fn test_retire_habit_nonexistent() {
        let conn = setup_test_db();
        let result = retire_habit_direct(&conn, 99999);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not found"));
    }

    #[test]
    fn test_retire_last_good_habit_blocked() {
        let conn = setup_test_db();
        let habits = query_all_habit_configs(&conn).unwrap();
        let good_habits: Vec<&HabitConfig> =
            habits.iter().filter(|h| h.pool == "good").collect();

        // Retire all but the last good habit
        for habit in good_habits.iter().skip(1) {
            retire_habit_direct(&conn, habit.id).unwrap();
        }

        // The last one should be blocked
        let result = retire_habit_direct(&conn, good_habits[0].id);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Cannot retire the last active good habit"));
    }

    // -- reorder_habits tests --

    fn reorder_habits_direct(conn: &Connection, ids: Vec<i64>) -> CommandResult<()> {
        let tx = conn
            .unchecked_transaction()
            .map_err(|e| CommandError::from(format!("Transaction error: {}", e)))?;

        for (index, id) in ids.iter().enumerate() {
            tx.execute(
                "UPDATE habit_config SET sort_order = ?1 WHERE id = ?2",
                params![index as i64, id],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    #[test]
    fn test_reorder_habits() {
        let conn = setup_test_db();
        let habits = query_all_habit_configs(&conn).unwrap();

        // Take first 3 habits and reverse their order
        let ids: Vec<i64> = habits.iter().take(3).map(|h| h.id).rev().collect();
        let original_first_id = habits[0].id;
        let original_third_id = habits[2].id;

        reorder_habits_direct(&conn, ids).unwrap();

        // Verify the reordering
        let first = query_habit_config_by_id(&conn, original_third_id)
            .unwrap()
            .unwrap();
        let last = query_habit_config_by_id(&conn, original_first_id)
            .unwrap()
            .unwrap();

        assert_eq!(first.sort_order, 0);
        assert_eq!(last.sort_order, 2);
    }
}
