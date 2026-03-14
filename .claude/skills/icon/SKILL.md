# Icon Generation Skill

Generate app icons for Transcribr using a Python script with Pillow.

## Usage

```
/icon                    # Generate with default preset
/icon --preset dark      # Generate with dark preset
/icon --list-presets     # Show available presets
```

## What It Does

1. Generates a 1024x1024 base icon (`icon_1024.png`)
2. Creates all Tauri-required sizes in `icons_generated/`
3. Creates `.ico` for Windows

## Implementation

Run: `make icon` (or `make icon PRESET=dark`)

The script is at `scripts/generate-icon.py`. It draws a microphone + waveform design with configurable color presets.

## Prerequisites

- Python 3
- Pillow (`make icon-install` to set up)

## After Generating

Copy the generated icons to `src-tauri/icons/` and run `npm run tauri icon` for platform-specific formats.
