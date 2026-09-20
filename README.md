# PicMap

[中文](README_zh.md)

---

> An image map application based on Vue3 and Go (Wails). Display and manage your photos on the map.

![Vue 3](https://img.shields.io/badge/Vue-3.3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Go](https://img.shields.io/badge/Go-1.25-blue)
![Wails](https://img.shields.io/badge/Wails-v2-red)

This application requires an internet connection only to fetch map tiles; all other features work offline. All your information and images are stored locally, eliminating personal information leakage risk.

Supported System: Windows 10/11 (64-bit)

---

## Features Preview

![Feature Demo](doc/image/image.png)

---

## Core Features

| Feature | Description |
|---------|-------------|
| 🔒 Local Storage | All data stored locally, no privacy leak risk |
| 🗺️ Map Display | Supports multiple map tiles, displaying photo locations |
| 📤 Batch Upload | Select multiple images, supports HEIC/HEIF/RAW formats |
| 🏷️ Image Grouping | Create groups, filtering, batch operations |
| 👥 Multi-user | Multiple users with isolated data |
| 💾 Data Backup | Backup, import and restore support |
| 🛤️ GPX Track | Upload, display and manage GPX track files |
| 🎬 Track Video | Associate videos with tracks, with embedded GPS and panorama support |
| 📍 Panorama | Immersive viewing of panorama photos and videos |

---

## User Guide

### Download & Install

1. Download the latest `picmap.exe` (or installer) from [Releases](../../releases).
2. Run it directly — no separate installation is required. On first launch, the data directory and a default user are created automatically.

> **System requirements**: Windows 10/11 64-bit. The app relies on the system-provided
> **WebView2** runtime, which is preinstalled on Windows 11 and most Windows 10 systems.
> If the window is blank after launch, install the
> [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

### Getting Started

1. Use the default user "User 1" on first launch, or create/switch users from the top-right corner (data is fully isolated per user).
2. Click the upload panel and select images — GPS coordinates are parsed from EXIF and located on the map automatically.
3. Images without GPS can be located manually; GPX tracks with GPS can be dropped in to upload.
4. In "Settings" you can change the language, manage map tiles, and change the data storage directory.

---

## Data Storage Location

All data is stored locally and **never goes through any server**.

### Default location

The app auto-selects the data directory in this order:

1. The first existing drive letter (starting from `D:`), using `X:\PicMap`;
2. If no extra drive is available, it uses `PicMap` under your home directory
   (`C:\Users\<username>\PicMap`).

So the default path is usually `D:\PicMap`. You can also change the data directory and
backup directory manually under "Settings → Storage".

### Directory structure

```
D:\PicMap\
├── appSchema.json           # App config (user list, map settings)
├── PicMap_Backup\           # Backup files (sibling of the data directory by default)
└── <userId>\
    ├── images\
    │   ├── schema\schema.json  # Per-user metadata: images/groups/tracks/videos
    │   ├── _THUMBNAIL_PM*.jpg  # Generated thumbnails
    │   └── PM*.jpg              # Imported original images
    ├── tracks\               # GPX track files
    ├── videos\               # Track video files
    └── icons\                # User-defined icons
```

### Storage config file

Your chosen storage directory is recorded in `.picmap-config.json` in your home
directory (`C:\Users\<username>\.picmap-config.json`). This lets the app remember your
choice even after you change the data directory. If you move the data directory, update
the paths in this file accordingly.

---

## Backup & Restore

> Regular backups are recommended. All data is stored locally; nothing is ever uploaded.

### Create a backup

1. Open "Settings";
2. Click "Create Backup" — you may set a custom name (a timestamp is used if left empty);
3. Progress is shown and the task can be cancelled at any time;
4. The backup is a ZIP file saved in the backup directory (default `D:\PicMap_Backup`).

A backup packages `appSchema.json` plus all user directories. The app warns you when the
data size exceeds 500MB.

### Restore a backup

1. Open "Settings" → "Import Backup" and select a previously created ZIP;
2. Choose a mode:
   - **Overwrite**: fully replaces existing data (it extracts and validates first, then
     swaps; on failure your original data is preserved);
   - **Merge**: keeps existing data and only appends images/groups/tracks/videos that are
     not already present (deduplicated by ID);
3. Restart the app after importing.

### Manual backup

You can also simply copy the entire data directory (default `D:\PicMap`) as a backup and
copy it back to restore.

---

## Build & Development

### Prerequisites

- Go 1.25+ ([download](https://go.dev/dl/))
- Wails CLI v2
- Node.js 18+

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Install frontend dependencies
cd frontend && npm install

# Start development
cd .. && wails dev
```

### Build (Windows release)

The one-click build script generates icons, runs the Wails build, and assembles a
self-contained release into `dist/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

The release directory is `dist/` (ready to distribute, including the app and required tools):

```
dist/
├── picmap.exe
└── tools/            # External tools shipped with the app (self-contained)
    ├── ffmpeg/       # Video probing / frame extraction
    ├── imagemagick/  # HEIC transcoding
    └── libraw/       # RAW decoding
```

> Note: `build/` only holds Wails build config (`appicon.png`, `windows/*`) and intermediate
> artifacts; it is not part of the release. To change the app icon, replace
> `build/appicon.png` and rebuild.

You can also run the underlying build only (output in `build/bin/`, copy `tools/` yourself):

```bash
wails build -platform windows/amd64
```

### Quality checks

```bash
go build ./...    # Compile all Go packages
go vet ./...      # Go static analysis
go test ./...     # Run tests

cd frontend
npm run typecheck # Frontend type check (vue-tsc)
npm run build     # Frontend production build
```

---

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + MapLibre GL + Element Plus + Pinia
- **Backend**: Go (Wails bindings, no HTTP server)
- **Packaging**: Wails v2 + WebView2
- **Map**: MapLibre GL with GPX track support

---

## Documentation

- [Feature Overview](doc/feature_overview.md) - Detailed feature documentation
- [Data Schema](doc/DATA_SCHEMA.md) - Data structure specification
- [API Documentation](doc/API.md) - Frontend and backend API reference

---

## Notes

- 💡 All data stored locally, recommend regular backups
- 📍 Only images with EXIF GPS info can be auto-located
- 📂 Default storage path: `D:\PicMap` (changeable in Settings)
- 🌐 Except map tiles, other features work offline
- 🛤️ GPX tracks are automatically converted from WGS84 to GCJ02 for Chinese map providers
