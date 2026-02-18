use std::sync::Mutex;

use rusqlite::Connection;

mod db;

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
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
