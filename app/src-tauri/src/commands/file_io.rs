use std::fs;

use super::CommandResult;

/// Reads a text file at the given path and returns its contents.
#[tauri::command]
pub fn read_text_file(path: String) -> CommandResult<String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e).into())
}

/// Writes text content to a file at the given path, creating or overwriting it.
#[tauri::command]
pub fn write_text_file(path: String, content: String) -> CommandResult<()> {
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e).into())
}
