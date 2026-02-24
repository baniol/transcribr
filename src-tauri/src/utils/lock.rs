use std::sync::{Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard};

pub trait SafeLock<T> {
    fn safe_lock(&self) -> Result<MutexGuard<'_, T>, String>;
}

impl<T> SafeLock<T> for Mutex<T> {
    fn safe_lock(&self) -> Result<MutexGuard<'_, T>, String> {
        self.lock().map_err(|e| format!("Mutex poisoned: {}", e))
    }
}

pub trait SafeRwLock<T> {
    fn safe_read(&self) -> Result<RwLockReadGuard<'_, T>, String>;
    fn safe_write(&self) -> Result<RwLockWriteGuard<'_, T>, String>;
}

impl<T> SafeRwLock<T> for RwLock<T> {
    fn safe_read(&self) -> Result<RwLockReadGuard<'_, T>, String> {
        self.read().map_err(|e| format!("RwLock poisoned: {}", e))
    }

    fn safe_write(&self) -> Result<RwLockWriteGuard<'_, T>, String> {
        self.write().map_err(|e| format!("RwLock poisoned: {}", e))
    }
}
