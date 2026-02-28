mod commands;
mod db;
mod models;
mod state;
mod utils;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

use commands::{notes, settings, transcription};
use db::{get_db_path, init_db, load_settings};
use state::new_app_state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let db_path = get_db_path(&app_data_dir);
            let conn = Connection::open(&db_path).expect("Failed to open database");
            init_db(&conn).expect("Failed to initialize database");

            let settings = load_settings(&conn);
            let app_state = new_app_state(settings);

            app.manage(Mutex::new(conn));
            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings::get_settings,
            settings::update_setting,
            // Transcription
            transcription::get_available_models,
            transcription::get_model_status,
            transcription::is_model_downloaded,
            transcription::download_model,
            transcription::delete_model,
            transcription::init_whisper,
            transcription::is_whisper_ready,
            transcription::transcribe_file,
            transcription::cancel_transcription,
            // Notes
            notes::get_notes,
            notes::get_note,
            notes::create_note,
            notes::update_note_title,
            notes::update_segment_text,
            notes::delete_note,
            notes::search_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
