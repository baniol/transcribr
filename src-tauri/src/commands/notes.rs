use rusqlite::Connection;
use std::sync::Mutex;
use tauri::State;

use crate::models::{Note, NoteWithSegments, Segment, TranscriptionSegment};

#[tauri::command]
pub fn get_notes(db: State<'_, Mutex<Connection>>) -> Result<Vec<Note>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, title, original_filename, audio_path, language, duration_seconds, created_at, updated_at
             FROM notes ORDER BY created_at DESC",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let notes = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                original_filename: row.get(2)?,
                audio_path: row.get(3)?,
                language: row.get(4)?,
                duration_seconds: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(Result::ok)
        .collect();

    Ok(notes)
}

#[tauri::command]
pub fn get_note(id: i64, db: State<'_, Mutex<Connection>>) -> Result<NoteWithSegments, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let note: Note = conn
        .query_row(
            "SELECT id, title, original_filename, audio_path, language, duration_seconds, created_at, updated_at
             FROM notes WHERE id = ?1",
            [id],
            |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    original_filename: row.get(2)?,
                    audio_path: row.get(3)?,
                    language: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| format!("Note not found: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT id, note_id, text, start_ms, end_ms FROM segments WHERE note_id = ?1 ORDER BY start_ms")
        .map_err(|e| format!("Query error: {}", e))?;

    let segments: Vec<Segment> = stmt
        .query_map([id], |row| {
            Ok(Segment {
                id: row.get(0)?,
                note_id: row.get(1)?,
                text: row.get(2)?,
                start_ms: row.get(3)?,
                end_ms: row.get(4)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(Result::ok)
        .collect();

    let full_text = segments
        .iter()
        .map(|s| s.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    Ok(NoteWithSegments {
        note,
        segments,
        full_text,
    })
}

#[tauri::command]
pub fn create_note(
    title: String,
    original_filename: Option<String>,
    audio_path: Option<String>,
    language: Option<String>,
    duration_seconds: Option<i64>,
    segments: Vec<TranscriptionSegment>,
    db: State<'_, Mutex<Connection>>,
) -> Result<i64, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    conn.execute(
        "INSERT INTO notes (title, original_filename, audio_path, language, duration_seconds) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![title, original_filename, audio_path, language, duration_seconds],
    )
    .map_err(|e| format!("Insert error: {}", e))?;

    let note_id = conn.last_insert_rowid();

    for segment in segments {
        conn.execute(
            "INSERT INTO segments (note_id, text, start_ms, end_ms) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![note_id, segment.text, segment.start_ms, segment.end_ms],
        )
        .map_err(|e| format!("Insert segment error: {}", e))?;
    }

    Ok(note_id)
}

#[tauri::command]
pub fn update_note_title(
    id: i64,
    title: String,
    db: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    conn.execute(
        "UPDATE notes SET title = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![title, id],
    )
    .map_err(|e| format!("Update error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn update_segment_text(
    id: i64,
    text: String,
    db: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    conn.execute(
        "UPDATE segments SET text = ?1 WHERE id = ?2",
        rusqlite::params![text, id],
    )
    .map_err(|e| format!("Update segment error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn update_note_full_text(
    id: i64,
    full_text: String,
    db: State<'_, Mutex<Connection>>,
) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    // Delete existing segments for this note
    conn.execute("DELETE FROM segments WHERE note_id = ?1", [id])
        .map_err(|e| format!("Delete segments error: {}", e))?;

    // Insert a single segment with the full text
    conn.execute(
        "INSERT INTO segments (note_id, text, start_ms, end_ms) VALUES (?1, ?2, 0, 0)",
        rusqlite::params![id, full_text],
    )
    .map_err(|e| format!("Insert segment error: {}", e))?;

    // Update the note's updated_at timestamp
    conn.execute(
        "UPDATE notes SET updated_at = datetime('now') WHERE id = ?1",
        [id],
    )
    .map_err(|e| format!("Update error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn delete_note(id: i64, db: State<'_, Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    conn.execute("DELETE FROM notes WHERE id = ?1", [id])
        .map_err(|e| format!("Delete error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn search_notes(query: String, db: State<'_, Mutex<Connection>>) -> Result<Vec<Note>, String> {
    let conn = db.lock().map_err(|e| format!("DB lock error: {}", e))?;

    let search_pattern = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT n.id, n.title, n.original_filename, n.audio_path, n.language, n.duration_seconds, n.created_at, n.updated_at
             FROM notes n
             LEFT JOIN segments s ON s.note_id = n.id
             WHERE n.title LIKE ?1 OR s.text LIKE ?1
             ORDER BY n.created_at DESC",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let notes = stmt
        .query_map([&search_pattern], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                original_filename: row.get(2)?,
                audio_path: row.get(3)?,
                language: row.get(4)?,
                duration_seconds: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(Result::ok)
        .collect();

    Ok(notes)
}
