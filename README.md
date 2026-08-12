# PicMap

[中文](README_zh.md)

---

> An image map application based on Vue3 and Go (Wails). Display and manage your photos on the map.

![Vue 3](https://img.shields.io/badge/Vue-3.3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Go](https://img.shields.io/badge/Go-1.26-blue)
![Wails](https://img.shields.io/badge/Wails-v2-red)

This application requires an internet connection only to fetch map tiles; all other features work offline. All your information and images are stored locally, eliminating personal information leakage risk.

Supported System: Windows
Data Storage Directory: `D:\PicMap`

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

---

## Quick Start

### Prerequisites

- Go 1.21+ ([download](https://go.dev/dl/))
- Wails CLI
- Node.js 18+

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Install frontend dependencies
cd frontend && npm install

# Start development
cd .. && wails dev
```

---

## Build

```bash
wails build -platform windows/amd64
```

Build artifacts will be generated in `build/bin/`.

---

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Leaflet + Element Plus + Pinia
- **Backend**: Go (Wails bindings)
- **Packaging**: Wails v2 + WebView2
- **Map**: Leaflet with GPX plugin support

---

## Documentation

- [Feature Overview](doc/feature_overview.md) - Detailed feature documentation
- [Data Schema](doc/DATA_SCHEMA.md) - Data structure specification
- [API Documentation](doc/API.md) - Frontend and backend API reference

---

## Notes

- 💡 All data stored locally, recommend regular backups
- 📍 Only images with EXIF GPS info can be auto-located
- 📂 Default storage path: D:\PicMap
- 🌐 Except map tiles, other features work offline
- 🛤️ GPX tracks are automatically converted from WGS84 to GCJ02 for Chinese map providers
