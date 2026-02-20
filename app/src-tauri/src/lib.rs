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
        .plugin(tauri_plugin_dialog::init())
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
            // Phase 6.6: Config & settings commands
            commands::config::get_config,
            commands::config::save_config,
            commands::config::get_habit_configs,
            commands::config::save_habit_config,
            commands::config::retire_habit,
            commands::config::reorder_habits,
            // Phase 6.7: Weekly review commands
            commands::review::get_weekly_review,
            commands::review::compute_weekly_stats,
            commands::review::save_weekly_review,
            // Phase 6.8: Analytics commands
            commands::analytics::get_score_trend,
            commands::analytics::get_habit_completion_rates,
            commands::analytics::get_vice_frequency,
            commands::analytics::get_day_of_week_averages,
            commands::analytics::get_correlation_data,
            commands::analytics::get_study_summary,
            commands::analytics::get_application_pipeline,
            commands::analytics::get_recovery_frequency,
            // Phase 6.9: Milestone commands
            commands::milestone::get_milestones,
            commands::milestone::check_milestones,
            commands::milestone::get_milestone_context,
            // Phase 6.10: Data management commands
            commands::data::export_data,
            commands::data::import_data,
            commands::data::get_db_stats,
            commands::data::get_db_path,
            commands::data::backup_now,
            // Phase 14: File I/O commands (Settings data tab)
            commands::file_io::read_text_file,
            commands::file_io::write_text_file,
            // Phase 17.4: Test data generation
            commands::testdata::generate_test_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
