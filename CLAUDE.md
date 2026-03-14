# Transcribr

Voice note transcription desktop app built with Tauri 2 (React/TypeScript + Rust). Uses Whisper (via whisper-rs with Metal acceleration) for local speech-to-text.

All code, comments, and commits must be in English.

## Commands

Run `make help` for all available targets. Key commands:

```bash
make install       # Install npm + cargo dependencies
make setup-hooks   # Configure git hooks
make dev           # Start Tauri dev server
make build         # Build production app
make lint          # ESLint
make lint-fix      # ESLint with auto-fix
make format        # Format with Prettier
make format-check  # Check formatting
make type-check    # TypeScript type checking
make rust-clippy   # Rust linting
make rust-fmt      # Format Rust code
make test          # Run frontend tests
make rust-test     # Run Rust tests
make check-all     # Run all checks (format, lint, types, clippy, tests)
make clean-all     # Clean everything including node_modules
make db-reset      # Delete local SQLite database
make icon          # Generate app icon (PRESET=default|dark|light|blue)
```

Short aliases: `make l` (lint), `make lf` (lint-fix), `make f` (format), `make fc` (format-check), `make t` (test), `make tc` (test-coverage), `make ca` (check-all)

## Architecture

### Data Model
- **Notes**: Voice recordings with title, audio file path, full transcription text, language, duration
- **Segments**: Timestamped portions of a transcription (start/end time, text) linked to a Note
- **Settings**: Key-value pairs for app configuration (whisper model, language, etc.)
- **Whisper Models**: Available model sizes (tiny through large-v3) with download status

### Backend (src-tauri/src/)
- `db.rs` — SQLite database initialization and migrations
- `models.rs` — Rust structs for Notes, Segments, Settings, WhisperModels
- `state.rs` — Tauri managed state (DbState)
- `commands/` — Tauri IPC command handlers:
  - `notes.rs` — CRUD for notes and segments
  - `settings.rs` — Settings get/set
  - `transcription.rs` — Audio transcription via Whisper, model download/management
- `utils/` — Helpers:
  - `audio.rs` — Audio file conversion to WAV (via symphonia + hound)
  - `lock.rs` — File-based lock for transcription exclusivity

### Frontend (src/)
- `views/` — Top-level pages: NotesListView, NoteDetailView, SettingsView
- `components/` — UI components:
  - `AudioPlayer.tsx` — Playback with clickable timestamp seeking
  - `TranscriptionProgress.tsx` — Real-time progress display
  - `UploadDialog.tsx` — File selection dialog
  - `notes/` — NoteCard, NotesList, SegmentList
  - `settings/` — LanguageSettings, WhisperSettings
  - `ui/` — Reusable primitives (Button, Card, Dialog, Input, ProgressBar, Select, Spinner)
- `hooks/` — useNotes (CRUD), useTranscription (transcription flow)
- `contexts/` — SettingsContext (app settings), ToastContext (notifications)
- `api/` — Tauri invoke wrappers: notes, settings, transcription
- `types/` — TypeScript type definitions

## Conventions

### Adding a new Tauri command
1. Add handler function in `src-tauri/src/commands/`
2. Register in `src-tauri/src/lib.rs` invoke_handler
3. Add TypeScript invoke wrapper in `src/api/`
4. Call from React via the api layer

### Adding a new view
1. Create component in `src/views/`
2. Add navigation in `App.tsx`

### Parameter naming
- Use `snake_case` in Rust structs and commands (Tauri auto-converts to camelCase for frontend)
- Use `camelCase` in TypeScript

### Database migrations
- Add migration SQL in `db.rs` `initialize_database()` function
- Migrations run on app startup

## App Icon

Generate app icons with `make icon`. Uses `scripts/generate-icon.py` (Python + Pillow) to create a microphone/waveform themed icon. Run `make icon-presets` to see color presets, or `make icon PRESET=dark` for a specific one. First run will create a `.venv` and install Pillow automatically.

## Git

Commits: concise, "why"-focused messages. Do not add Co-Authored-By lines.

### Pre-commit hook
Run `make setup-hooks` once to enable. The hook runs `make check-all` before each commit.

## Testing

Frontend tests use Vitest + React Testing Library. Tauri APIs are mocked in `src/test/setup.ts`.

```bash
make test          # Run once
make test-watch    # Watch mode
make test-coverage # With coverage report
```
