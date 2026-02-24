use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

use crate::db::save_setting;
use crate::models::AppSettings;
use crate::state::AppState;
use crate::utils::lock::SafeRwLock;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.safe_read()?;
    Ok(settings.clone())
}

#[tauri::command]
pub fn update_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
    db: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;
    save_setting(&conn, &key, &value)?;

    let mut settings = state.settings.safe_write()?;
    match key.as_str() {
        "transcription_language" => settings.transcription_language = value,
        "active_whisper_model" => settings.active_whisper_model = value,
        "custom_model_path" => {
            settings.custom_model_path = if value.is_empty() {
                None
            } else {
                Some(value)
            };
        }
        _ => return Err(format!("Unknown setting key: {}", key)),
    }

    Ok(())
}
