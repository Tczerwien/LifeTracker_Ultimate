//! Backup system — ADR-001 SD3.
//!
//! On every app launch, copy `ltu.db` → `backups/ltu_YYYY-MM-DD_HH-MM.db`.
//! Rolling 7-copy retention: oldest beyond 7 are deleted.
//! Backup failures never block app startup.

use std::fs;
use std::path::{Path, PathBuf};

const MAX_BACKUPS: usize = 7;

/// Run automatic backup before DB connection is opened.
///
/// Returns `Ok(Some(path))` on successful backup, `Ok(None)` if no DB exists
/// yet (first launch), or `Err` if backup fails.
pub fn run_backup(db_path: &Path) -> Result<Option<PathBuf>, String> {
    if !db_path.exists() {
        return Ok(None);
    }

    let backup_dir = db_path
        .parent()
        .ok_or_else(|| "Cannot determine DB parent directory".to_string())?
        .join("backups");

    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let now = chrono::Local::now();
    let filename = format!("ltu_{}.db", now.format("%Y-%m-%d_%H-%M"));
    let backup_path = backup_dir.join(&filename);

    fs::copy(db_path, &backup_path)
        .map_err(|e| format!("Failed to copy database for backup: {}", e))?;

    prune_old_backups(&backup_dir);

    Ok(Some(backup_path))
}

/// Keep only the `MAX_BACKUPS` most recent backup files, deleting the rest.
/// Sorts by filename descending (ISO timestamps make alphabetical = chronological).
fn prune_old_backups(backup_dir: &Path) {
    let mut backups: Vec<PathBuf> = match fs::read_dir(backup_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.extension().map_or(false, |ext| ext == "db")
                    && p.file_name()
                        .map_or(false, |n| n.to_string_lossy().starts_with("ltu_"))
            })
            .collect(),
        Err(_) => return,
    };

    // Sort descending by filename (newest first)
    backups.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    // Delete everything beyond the retention limit
    for old_backup in backups.iter().skip(MAX_BACKUPS) {
        let _ = fs::remove_file(old_backup);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;

    #[test]
    fn run_backup_returns_none_when_no_db() {
        let dir = tempfile::tempdir().unwrap();
        let fake_db = dir.path().join("ltu.db");
        let result = run_backup(&fake_db).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn run_backup_creates_backup_file() {
        let dir = tempfile::tempdir().unwrap();
        let fake_db = dir.path().join("ltu.db");
        File::create(&fake_db).unwrap();
        fs::write(&fake_db, b"test data").unwrap();

        let result = run_backup(&fake_db).unwrap();
        assert!(result.is_some());

        let backup_path = result.unwrap();
        assert!(backup_path.exists());
        assert_eq!(fs::read(&backup_path).unwrap(), b"test data");
    }

    #[test]
    fn prune_keeps_only_max_backups() {
        let dir = tempfile::tempdir().unwrap();
        let backup_dir = dir.path().join("backups");
        fs::create_dir_all(&backup_dir).unwrap();

        // Create 10 fake backup files with incrementing timestamps
        for i in 0..10 {
            let name = format!("ltu_2026-01-{:02}_12-00.db", i + 1);
            File::create(backup_dir.join(&name)).unwrap();
        }

        prune_old_backups(&backup_dir);

        let remaining: Vec<_> = fs::read_dir(&backup_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .collect();
        assert_eq!(remaining.len(), MAX_BACKUPS);
    }
}
