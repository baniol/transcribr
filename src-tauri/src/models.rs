use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub original_filename: Option<String>,
    pub audio_path: Option<String>,
    pub language: Option<String>,
    pub duration_seconds: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: i64,
    pub note_id: i64,
    pub text: String,
    pub start_ms: i64,
    pub end_ms: i64,
    pub speaker_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWithSegments {
    #[serde(flatten)]
    pub note: Note,
    pub segments: Vec<Segment>,
    pub full_text: String,
    pub full_text_stored: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentUpdate {
    pub id: i64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    pub text: String,
    pub start_ms: i64,
    pub end_ms: i64,
    pub speaker_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptionSegment>,
    pub full_text: String,
    pub duration_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WhisperModel {
    pub name: String,
    pub file_name: String,
    pub size_mb: u32,
    pub url: String,
    pub description: String,
}

// Static model definition for const array
pub struct WhisperModelDef {
    pub name: &'static str,
    pub file_name: &'static str,
    pub size_mb: u32,
    pub url: &'static str,
    pub description: &'static str,
}

impl WhisperModelDef {
    #[allow(dead_code)]
    pub fn to_model(&self) -> WhisperModel {
        WhisperModel {
            name: self.name.to_string(),
            file_name: self.file_name.to_string(),
            size_mb: self.size_mb,
            url: self.url.to_string(),
            description: self.description.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percent: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionProgress {
    pub phase: String, // "loading", "transcribing", "diarizing"
    pub processed_chunks: u32,
    pub total_chunks: u32,
    pub chunk_progress: i32, // 0-100 progress within current chunk
    pub percent: f32,        // overall progress
    pub current_segments: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub transcription_language: String,
    pub active_whisper_model: String,
    pub custom_model_path: Option<String>,
    pub diarization_enabled: bool,
}

impl AppSettings {
    pub fn default_settings() -> Self {
        Self {
            transcription_language: "auto".to_string(),
            active_whisper_model: "ggml-base.bin".to_string(),
            custom_model_path: None,
            diarization_enabled: false,
        }
    }
}

pub const AVAILABLE_MODELS: &[WhisperModelDef] = &[
    WhisperModelDef {
        name: "Tiny",
        file_name: "ggml-tiny.bin",
        size_mb: 75,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        description: "Fastest, lower accuracy",
    },
    WhisperModelDef {
        name: "Base",
        file_name: "ggml-base.bin",
        size_mb: 142,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        description: "Fast, decent accuracy",
    },
    WhisperModelDef {
        name: "Small",
        file_name: "ggml-small.bin",
        size_mb: 466,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        description: "Balanced speed and accuracy",
    },
    WhisperModelDef {
        name: "Medium",
        file_name: "ggml-medium.bin",
        size_mb: 1500,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        description: "High accuracy, good for most use cases",
    },
    WhisperModelDef {
        name: "Large v2",
        file_name: "ggml-large-v2.bin",
        size_mb: 3094,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v2.bin",
        description: "Best accuracy, slower (recommended for noisy audio)",
    },
    WhisperModelDef {
        name: "Large v3",
        file_name: "ggml-large-v3.bin",
        size_mb: 3095,
        url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
        description: "Latest large model, may have regressions for some languages",
    },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiarizationModel {
    pub name: String,
    pub file_name: String,
    pub size_mb: u32,
    pub url: String,
    pub description: String,
}

pub struct DiarizationModelDef {
    pub name: &'static str,
    pub file_name: &'static str,
    pub size_mb: u32,
    pub url: &'static str,
    pub description: &'static str,
}

impl DiarizationModelDef {
    pub fn to_model(&self) -> DiarizationModel {
        DiarizationModel {
            name: self.name.to_string(),
            file_name: self.file_name.to_string(),
            size_mb: self.size_mb,
            url: self.url.to_string(),
            description: self.description.to_string(),
        }
    }
}

pub const DIARIZATION_MODELS: &[DiarizationModelDef] = &[
    DiarizationModelDef {
        name: "Segmentation",
        file_name: "segmentation-3.0.bpk",
        size_mb: 6,
        url: "https://github.com/RustedBytes/pyannote-rs/raw/main/src/nn/segmentation/model.bpk",
        description: "Pyannote segmentation model for speaker detection",
    },
    DiarizationModelDef {
        name: "Speaker Embedding",
        file_name: "wespeaker-voxceleb-resnet34.bpk",
        size_mb: 28,
        url: "https://github.com/RustedBytes/pyannote-rs/raw/main/src/nn/speaker_identification/model.bpk",
        description: "Voice embedding model for speaker identification",
    },
];
