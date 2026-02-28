# Transcribr

Desktop app for transcribing voice notes to text. Runs entirely offline using [OpenAI Whisper](https://github.com/openai/whisper) via [whisper.cpp](https://github.com/ggerganov/whisper.cpp) with Metal GPU acceleration on macOS.

Built with [Tauri 2](https://tauri.app/) (React/TypeScript frontend + Rust backend).

## Features

- **Local transcription** — all processing happens on your machine, no data leaves your device
- **Metal acceleration** — uses Apple GPU for fast inference on macOS
- **Multiple Whisper models** — from Tiny (75 MB, fastest) to Large v3 (3 GB, most accurate)
- **Audio format support** — WAV, MP3, AAC, M4A
- **Timestamped segments** — click any segment to jump to that point in the audio
- **Long recordings** — handles hour-long files with chunked processing and progress tracking
- **Auto language detection** — or manually select from supported languages
- **Dark mode** — respects system preferences

## Installation

Download the latest `.dmg` from [Releases](https://github.com/marcinbaniowski/transcribr/releases), open it and drag Transcribr to Applications.

Since the app is not signed with an Apple Developer certificate, macOS will block it on first launch. Remove the quarantine attribute:

```bash
xattr -cr /Applications/Transcribr.app
```

On first launch, download a Whisper model from Settings. The **Base** model (142 MB) is a good starting point.

## Building from Source

### Requirements

- macOS 10.15 (Catalina) or later
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- Xcode Command Line Tools (`xcode-select --install`)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/marcinbaniowski/transcribr.git
cd transcribr

# Install dependencies
make install

# Start development server
make dev
```

## Building

```bash
make build
```

The production `.app` bundle will be in `src-tauri/target/release/bundle/`.

## Development

```bash
make dev             # Start dev server with hot reload
make check-all       # Run all checks (format, lint, types, clippy, tests)
make test            # Run frontend tests
make rust-test       # Run Rust tests
make lint-fix        # Auto-fix ESLint issues
make format          # Format code with Prettier
```

Run `make help` for all available targets.

### Git Hooks

```bash
make setup-hooks     # Enable pre-commit hook that runs check-all
```

## Tech Stack

**Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite 7

**Backend:** Rust, Tauri 2, SQLite (rusqlite), whisper-rs (whisper.cpp bindings)

**Audio:** symphonia (decode), hound (WAV)

**Testing:** Vitest, React Testing Library

## License

[MIT](LICENSE)
