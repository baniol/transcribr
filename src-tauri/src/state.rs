use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use whisper_rs::WhisperContext;

use crate::models::AppSettings;

pub struct AppStateInner {
    pub settings: RwLock<AppSettings>,
    pub whisper_context: Mutex<Option<WhisperContext>>,
    pub whisper_model_path: Mutex<Option<PathBuf>>,
    pub transcription_cancelled: AtomicBool,
}

pub type AppState = Arc<AppStateInner>;

pub fn new_app_state(settings: AppSettings) -> AppState {
    Arc::new(AppStateInner {
        settings: RwLock::new(settings),
        whisper_context: Mutex::new(None),
        whisper_model_path: Mutex::new(None),
        transcription_cancelled: AtomicBool::new(false),
    })
}

impl AppStateInner {
    pub fn cancel_transcription(&self) {
        self.transcription_cancelled.store(true, Ordering::SeqCst);
    }

    pub fn reset_cancellation(&self) {
        self.transcription_cancelled.store(false, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.transcription_cancelled.load(Ordering::SeqCst)
    }
}
