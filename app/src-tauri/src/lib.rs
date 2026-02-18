use std::sync::Mutex;

use rusqlite::Connection;

mod commands;
mod db;
pub mod engine;

pub struct AppState {
    pub db: Mutex<Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Step 1: Backup existing DB before opening connection (ADR-001 SD3)
    let db_path = db::get_db_path();
    match db::backup::run_backup(&db_path) {
        Ok(Some(path)) => println!("Backup created: {}", path.display()),
        Ok(None) => println!("No existing database to backup (first launch)"),
        Err(msg) => eprintln!("Backup warning (non-fatal): {}", msg),
    }

    // Step 2: Initialize DB connection (creates file if needed, enables WAL + FK)
    let mut conn = db::init_db().expect("Failed to initialize database");

    // Step 3: Run pending migrations
    db::migrations::run_migrations(&mut conn).expect("Failed to run migrations");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            db: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            commands::daily_log::get_daily_log,
            commands::daily_log::get_daily_logs,
            commands::daily_log::save_daily_log,
            commands::daily_log::get_streak_at_date,
            // Phase 6.2: Journal commands
            commands::journal::get_journal,
            commands::journal::save_journal,
            // Phase 6.3: Study session commands
            commands::study::get_study_sessions,
            commands::study::get_study_sessions_range,
            commands::study::save_study_session,
            commands::study::update_study_session,
            commands::study::delete_study_session,
            // Phase 6.4: Application commands
            commands::application::get_applications,
            commands::application::get_application,
            commands::application::save_application,
            commands::application::update_application,
            commands::application::archive_application,
            commands::application::add_status_change,
            commands::application::get_status_history,
            // Phase 6.5: Recovery commands (relapse + urge)
            commands::recovery::get_relapse_entries,
            commands::recovery::save_relapse_entry,
            commands::recovery::update_relapse_entry,
            commands::recovery::get_urge_entries,
            commands::recovery::save_urge_entry,
            commands::recovery::update_urge_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
