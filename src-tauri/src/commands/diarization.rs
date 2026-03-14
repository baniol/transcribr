use futures_util::StreamExt;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::models::{
    DiarizationModel, DownloadProgress, TranscriptionProgress, TranscriptionSegment,
    DIARIZATION_MODELS,
};

#[tauri::command]
pub fn get_diarization_models() -> Vec<DiarizationModel> {
    DIARIZATION_MODELS.iter().map(|m| m.to_model()).collect()
}

#[tauri::command]
pub fn is_diarization_model_downloaded(app: AppHandle, file_name: String) -> Result<bool, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(&file_name);
    Ok(model_path.exists())
}

#[tauri::command]
pub async fn download_diarization_model(
    app: AppHandle,
    file_name: String,
) -> Result<String, String> {
    let model = DIARIZATION_MODELS
        .iter()
        .find(|m| m.file_name == file_name)
        .ok_or_else(|| format!("Unknown diarization model: {}", file_name))?;

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
    let temp_path = model_path.with_extension("bpk.tmp");
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
            "diarization-model-download-progress",
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
pub fn delete_diarization_model(app: AppHandle, file_name: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let model_path = app_data_dir.join("models").join(&file_name);

    if model_path.exists() {
        std::fs::remove_file(&model_path).map_err(|e| format!("Failed to delete model: {}", e))?;
    }

    Ok(())
}

pub struct DiarizationSegment {
    start_ms: i64,
    end_ms: i64,
    speaker_id: usize,
}

pub fn run_diarization(
    app: &AppHandle,
    samples: &[f32],
    sample_rate: u32,
    seg_model_path: &PathBuf,
    emb_model_path: &PathBuf,
) -> Result<Vec<DiarizationSegment>, String> {
    let _ = app.emit(
        "transcription-progress",
        TranscriptionProgress {
            phase: "diarizing".to_string(),
            processed_chunks: 0,
            total_chunks: 0,
            chunk_progress: 0,
            percent: 0.0,
            current_segments: 0,
        },
    );

    let segmenter = pyannote_rs::Segmenter::new(seg_model_path)
        .map_err(|e| format!("Failed to load segmentation model: {}", e))?;

    let extractor = pyannote_rs::EmbeddingExtractor::new(emb_model_path)
        .map_err(|e| format!("Failed to load embedding model: {}", e))?;

    // Convert f32 samples to i16 for iter_segments (streaming, lower memory)
    let samples_i16: Vec<i16> = samples
        .iter()
        .map(|&s| (s * i16::MAX as f32).clamp(i16::MIN as f32, i16::MAX as f32) as i16)
        .collect();

    // Estimate total windows for progress: 10s windows
    let duration_s = samples.len() as f32 / sample_rate as f32;
    let estimated_windows = (duration_s / 10.0).ceil() as u32;

    let seg_iter = segmenter
        .iter_segments(&samples_i16, sample_rate)
        .map_err(|e| format!("Diarization segmentation failed: {}", e))?;

    let max_speakers = 10;
    let similarity_threshold = 0.5;
    let mut manager = pyannote_rs::EmbeddingManager::new(max_speakers);

    let mut result = Vec::new();
    let mut processed: u32 = 0;

    for segment in seg_iter {
        let seg = match segment {
            Ok(s) => s,
            Err(_) => {
                processed += 1;
                continue;
            }
        };

        let embedding = match extractor.extract(&seg.samples, sample_rate) {
            Ok(e) => e,
            Err(_) => {
                processed += 1;
                continue;
            }
        };

        let speaker_id = manager
            .upsert(&embedding, similarity_threshold)
            .unwrap_or(0);

        let start_ms = (seg.start * 1000.0) as i64;
        let end_ms = (seg.end * 1000.0) as i64;

        result.push(DiarizationSegment {
            start_ms,
            end_ms,
            speaker_id,
        });

        processed += 1;
        let percent = if estimated_windows > 0 {
            (processed as f32 / estimated_windows as f32 * 100.0).min(99.0)
        } else {
            0.0
        };
        let _ = app.emit(
            "transcription-progress",
            TranscriptionProgress {
                phase: "diarizing".to_string(),
                processed_chunks: processed,
                total_chunks: estimated_windows,
                chunk_progress: 0,
                percent,
                current_segments: result.len() as u32,
            },
        );
    }

    let _ = app.emit(
        "transcription-progress",
        TranscriptionProgress {
            phase: "diarizing".to_string(),
            processed_chunks: estimated_windows,
            total_chunks: estimated_windows,
            chunk_progress: 100,
            percent: 100.0,
            current_segments: result.len() as u32,
        },
    );

    Ok(result)
}

pub fn merge_speakers(
    transcription_segments: &mut [TranscriptionSegment],
    diarization_segments: &[DiarizationSegment],
) {
    for tseg in transcription_segments.iter_mut() {
        let mut overlap_map: HashMap<usize, i64> = HashMap::new();

        for dseg in diarization_segments {
            let overlap = (tseg.end_ms.min(dseg.end_ms) - tseg.start_ms.max(dseg.start_ms)).max(0);
            if overlap > 0 {
                *overlap_map.entry(dseg.speaker_id).or_insert(0) += overlap;
            }
        }

        if let Some((&speaker_id, _)) = overlap_map.iter().max_by_key(|(_, &v)| v) {
            tseg.speaker_label = Some(format!("Speaker {}", speaker_id + 1));
        }
    }
}
