use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::models::AppSettings;

pub fn get_db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("transcribr.db")
}

pub fn init_db(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            original_filename TEXT,
            audio_path TEXT,
            language TEXT,
            duration_seconds INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            start_ms INTEGER NOT NULL,
            end_ms INTEGER NOT NULL,
            FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_segments_note_id ON segments(note_id);
        ",
    )
    .map_err(|e| format!("Failed to initialize database: {}", e))?;

    // Migration: add full_text column to notes (idempotent)
    let has_full_text: bool = conn
        .prepare("PRAGMA table_info(notes)")
        .map(|mut stmt| {
            let cols: Vec<String> = stmt
                .query_map([], |row| row.get::<_, String>(1))
                .unwrap()
                .filter_map(Result::ok)
                .collect();
            cols.contains(&"full_text".to_string())
        })
        .unwrap_or(false);

    if !has_full_text {
        conn.execute("ALTER TABLE notes ADD COLUMN full_text TEXT", [])
            .map_err(|e| format!("Failed to add full_text column: {}", e))?;
    }

    Ok(())
}

pub fn load_settings(conn: &Connection) -> AppSettings {
    let mut settings = AppSettings::default_settings();

    if let Ok(value) = conn.query_row(
        "SELECT value FROM settings WHERE key = 'transcription_language'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        settings.transcription_language = value;
    }

    if let Ok(value) = conn.query_row(
        "SELECT value FROM settings WHERE key = 'active_whisper_model'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        settings.active_whisper_model = value;
    }

    if let Ok(value) = conn.query_row(
        "SELECT value FROM settings WHERE key = 'custom_model_path'",
        [],
        |row| row.get::<_, String>(0),
    ) {
        if !value.is_empty() {
            settings.custom_model_path = Some(value);
        }
    }

    settings
}

pub fn save_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [key, value],
    )
    .map_err(|e| format!("Failed to save setting: {}", e))?;
    Ok(())
}
