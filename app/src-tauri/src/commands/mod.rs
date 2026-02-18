pub mod application;
pub mod daily_log;
pub mod journal;
pub mod study;

// ---------------------------------------------------------------------------
// Shared Error Type for Tauri Commands
// ---------------------------------------------------------------------------

/// A serializable error type for Tauri IPC commands.
///
/// Tauri requires command return errors to implement `serde::Serialize`.
/// This newtype wraps a human-readable error string and provides `From`
/// impls for common error sources so that `?` works throughout command code.
#[derive(Debug, serde::Serialize)]
pub struct CommandError(String);

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<rusqlite::Error> for CommandError {
    fn from(e: rusqlite::Error) -> Self {
        CommandError(format!("Database error: {}", e))
    }
}

impl From<String> for CommandError {
    fn from(s: String) -> Self {
        CommandError(s)
    }
}

impl From<&str> for CommandError {
    fn from(s: &str) -> Self {
        CommandError(s.to_string())
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(e: serde_json::Error) -> Self {
        CommandError(format!("JSON error: {}", e))
    }
}

/// Convenience alias used by all Tauri commands in this crate.
pub type CommandResult<T> = Result<T, CommandError>;
