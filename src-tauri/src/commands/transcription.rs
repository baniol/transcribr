use futures_util::StreamExt;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::commands::diarization;
use crate::models::{
    DownloadProgress, TranscriptionProgress, TranscriptionResult, TranscriptionSegment,
    WhisperModel, AVAILABLE_MODELS, DIARIZATION_MODELS,
};
use crate::state::AppState;
use crate::utils::audio::{calculate_duration_seconds, load_audio_file};
use crate::utils::lock::{SafeLock, SafeRwLock};

#[tauri::command]
pub fn get_available_models() -> Vec<WhisperModel> {
    AVAILABLE_MODELS
        .iter()
        .map(|m| WhisperModel {
            name: m.name.to_string(),
            file_name: m.file_name.to_string(),
            size_mb: m.size_mb,
            url: m.url.to_string(),
            description: m.description.to_string(),
        })
        .collect()
}

#[tauri::command]
pub fn get_model_status(app: AppHandle, file_name: String) -> Result<bool, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(&file_name);
    Ok(model_path.exists())
}

#[tauri::command]
pub fn is_model_downloaded(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    let (active_model, custom_path) = {
        let settings = state.settings.safe_read()?;
        (
            settings.active_whisper_model.clone(),
            settings.custom_model_path.clone(),
        )
    };

    if let Some(ref custom) = custom_path {
        let path = PathBuf::from(custom);
        return Ok(path.exists());
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(&active_model);
    Ok(model_path.exists())
}

#[tauri::command]
pub async fn download_model(app: AppHandle, file_name: String) -> Result<String, String> {
    let model = AVAILABLE_MODELS
        .iter()
        .find(|m| m.file_name == file_name)
        .ok_or_else(|| format!("Unknown model: {}", file_name))?;

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let models_dir = app_data_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| e.to_string())?;

    let model_path = models_dir.join(&file_name);

    if model_path.exists() {
        return Ok(model_path.to_string_lossy().to_string());
    }

    let client = reqwest::Client::new();
    let response = client
        .get(model.url)
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);
    let temp_path = model_path.with_extension("bin.tmp");
    let mut file = std::fs::File::create(&temp_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
        std::io::Write::write_all(&mut file, &chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        let percent = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                downloaded,
                total: total_size,
                percent,
            },
        );
    }

    std::fs::rename(&temp_path, &model_path)
        .map_err(|e| format!("Failed to finalize download: {}", e))?;

    Ok(model_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_model(app: AppHandle, file_name: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(&file_name);

    if model_path.exists() {
        std::fs::remove_file(&model_path).map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn init_whisper(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let (active_model, custom_path) = {
        let settings = state.settings.safe_read()?;
        (
            settings.active_whisper_model.clone(),
            settings.custom_model_path.clone(),
        )
    };

    let model_path = if let Some(ref custom) = custom_path {
        PathBuf::from(custom)
    } else {
        let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        app_data_dir.join("models").join(&active_model)
    };

    if !model_path.exists() {
        return Err(format!("Model not found at: {}", model_path.display()));
    }

    let ctx = WhisperContext::new_with_params(
        model_path.to_str().ok_or("Invalid model path")?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to load whisper model: {}", e))?;

    *state.whisper_context.safe_lock()? = Some(ctx);
    *state.whisper_model_path.safe_lock()? = Some(model_path);

    Ok(())
}

#[tauri::command]
pub fn is_whisper_ready(state: State<'_, AppState>) -> Result<bool, String> {
    let ctx = state.whisper_context.safe_lock()?;
    Ok(ctx.is_some())
}

#[tauri::command]
pub fn cancel_transcription(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel_transcription();
    Ok(())
}

// Chunk size: 3 minutes of audio at 16kHz
const CHUNK_SAMPLES: usize = 16000 * 60 * 3;

#[tauri::command]
pub async fn transcribe_file(
    app: AppHandle,
    file_path: String,
    language: Option<String>,
    state: State<'_, AppState>,
) -> Result<TranscriptionResult, String> {
    // Clone the Arc to move into the blocking task
    let state = Arc::clone(&state);
    let app_clone = app.clone();

    // Reset cancellation flag
    state.reset_cancellation();

    // Run the heavy work in a blocking thread
    let result = tokio::task::spawn_blocking(move || {
        transcribe_file_sync(&app_clone, &file_path, language.as_deref(), &state)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    result
}

fn transcribe_file_sync(
    app: &AppHandle,
    file_path: &str,
    language: Option<&str>,
    state: &AppState,
) -> Result<TranscriptionResult, String> {
    let path = PathBuf::from(file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Emit loading phase
    let _ = app.emit(
        "transcription-progress",
        TranscriptionProgress {
            phase: "loading".to_string(),
            processed_chunks: 0,
            total_chunks: 0,
            chunk_progress: 0,
            percent: 0.0,
            current_segments: 0,
        },
    );

    // Load and convert audio to 16kHz mono
    let samples = load_audio_file(&path)?;

    if samples.is_empty() {
        return Err("No audio samples in file".to_string());
    }

    let duration_seconds = calculate_duration_seconds(&samples);

    // Get whisper context
    let ctx_guard = state.whisper_context.safe_lock()?;
    let ctx = ctx_guard
        .as_ref()
        .ok_or("Whisper not initialized. Call init_whisper first.")?;

    // Split into chunks for cancellable processing
    let chunks: Vec<&[f32]> = samples.chunks(CHUNK_SAMPLES).collect();
    let total_chunks = chunks.len() as u32;

    let mut all_segments = Vec::new();
    let mut time_offset_ms: i64 = 0;

    for (chunk_idx, chunk) in chunks.iter().enumerate() {
        // Check for cancellation before processing each chunk
        if state.is_cancelled() {
            let full_text = all_segments
                .iter()
                .map(|s: &TranscriptionSegment| s.text.as_str())
                .collect::<Vec<_>>()
                .join(" ");

            return Ok(TranscriptionResult {
                segments: all_segments,
                full_text,
                duration_seconds,
            });
        }

        // Emit start of chunk processing
        let base_percent = (chunk_idx as f32 / total_chunks as f32) * 100.0;
        let _ = app.emit(
            "transcription-progress",
            TranscriptionProgress {
                phase: "transcribing".to_string(),
                processed_chunks: chunk_idx as u32,
                total_chunks,
                chunk_progress: 0,
                percent: base_percent,
                current_segments: all_segments.len() as u32,
            },
        );

        // Create state for this chunk
        let mut whisper_state = ctx
            .create_state()
            .map_err(|e| format!("Failed to create whisper state: {}", e))?;

        // Set up transcription parameters with progress callback
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

        let lang = language.unwrap_or("auto");
        if lang != "auto" {
            params.set_language(Some(lang));
        }

        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(true);

        // Set up progress callback
        let app_for_callback = app.clone();
        let chunk_idx_copy = chunk_idx;
        let total_chunks_copy = total_chunks;
        let segments_count = all_segments.len() as u32;

        params.set_progress_callback_safe(move |progress: i32| {
            let chunk_contribution = 100.0 / total_chunks_copy as f32;
            let overall_percent = (chunk_idx_copy as f32 * chunk_contribution)
                + (progress as f32 / 100.0 * chunk_contribution);

            let _ = app_for_callback.emit(
                "transcription-progress",
                TranscriptionProgress {
                    phase: "transcribing".to_string(),
                    processed_chunks: chunk_idx_copy as u32,
                    total_chunks: total_chunks_copy,
                    chunk_progress: progress,
                    percent: overall_percent,
                    current_segments: segments_count,
                },
            );
        });

        // Run transcription for this chunk
        whisper_state
            .full(params, chunk)
            .map_err(|e| format!("Transcription failed: {}", e))?;

        // Collect segments with timestamps
        let num_segments = whisper_state.full_n_segments();

        for i in 0..num_segments {
            let segment = whisper_state
                .get_segment(i)
                .ok_or_else(|| format!("Failed to get segment {}", i))?;

            let text = segment
                .to_str_lossy()
                .map_err(|e| format!("Failed to get segment text: {}", e))?;
            let start_ms = segment.start_timestamp() * 10 + time_offset_ms;
            let end_ms = segment.end_timestamp() * 10 + time_offset_ms;

            let trimmed = text.trim().to_string();
            if !trimmed.is_empty() {
                all_segments.push(TranscriptionSegment {
                    text: trimmed,
                    start_ms,
                    end_ms,
                    speaker_label: None,
                });
            }
        }

        // Update time offset for next chunk
        time_offset_ms += (chunk.len() as i64 * 1000) / 16000;

        // Emit chunk completion
        let percent = ((chunk_idx + 1) as f32 / total_chunks as f32) * 100.0;
        let _ = app.emit(
            "transcription-progress",
            TranscriptionProgress {
                phase: "transcribing".to_string(),
                processed_chunks: (chunk_idx + 1) as u32,
                total_chunks,
                chunk_progress: 100,
                percent,
                current_segments: all_segments.len() as u32,
            },
        );
    }

    // Run diarization if enabled and models are available
    let diarization_enabled = {
        let settings = state.settings.safe_read()?;
        settings.diarization_enabled
    };

    if diarization_enabled {
        let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let models_dir = app_data_dir.join("models");

        let seg_model_path = models_dir.join(DIARIZATION_MODELS[0].file_name);
        let emb_model_path = models_dir.join(DIARIZATION_MODELS[1].file_name);

        if seg_model_path.exists() && emb_model_path.exists() {
            // Burn framework uses deep recursion; run on a thread with a large stack
            let app_clone = app.clone();
            let samples_clone = samples.clone();
            let seg_path = seg_model_path.clone();
            let emb_path = emb_model_path.clone();

            const DIARIZATION_STACK_SIZE: usize = 64 * 1024 * 1024; // 64 MB
            let handle = std::thread::Builder::new()
                .name("diarization".to_string())
                .stack_size(DIARIZATION_STACK_SIZE)
                .spawn(move || {
                    diarization::run_diarization(
                        &app_clone,
                        &samples_clone,
                        16000,
                        &seg_path,
                        &emb_path,
                    )
                })
                .map_err(|e| format!("Failed to spawn diarization thread: {}", e))?;

            match handle.join() {
                Ok(Ok(diar_segments)) => {
                    diarization::merge_speakers(&mut all_segments, &diar_segments);
                }
                Ok(Err(e)) => {
                    eprintln!(
                        "Diarization failed (continuing without speaker labels): {}",
                        e
                    );
                }
                Err(_) => {
                    eprintln!("Diarization thread panicked (continuing without speaker labels)");
                }
            }
        }
    }

    let full_text = all_segments
        .iter()
        .map(|s| s.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    Ok(TranscriptionResult {
        segments: all_segments,
        full_text,
        duration_seconds,
    })
}
