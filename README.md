# PicMap

[中文](README_zh.md)

---

> An image map application based on Vue3 and Express. You can display and manage your photos on the map.

![Vue 3](https://img.shields.io/badge/Vue-3.3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Electron](https://img.shields.io/badge/Electron-28+-gray)

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
| 📤 Batch Upload | Select multiple images, supports HEIC/HEIF format |
| 🏷️ Image Grouping | Create groups, color coding, filtering |
| 👥 Multi-user | Multiple users with isolated data |
| 💾 Data Backup | Backup, import and restore support |

---

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
cd picMap_fontend
npm install

# Backend
cd picMap_backend
npm install
```

### 2. Start Development

```bash
# Frontend
cd picMap_fontend
npm run dev

# Backend
cd picMap_backend
npm run start
```

---

## Build Electron App

```bash
# 1. Build frontend and backend separately
cd picMap_fontend && npm run build
cd picMap_backend && npm run build

# 2. Build app in root directory
cd ..
npm run build
```

Build artifacts will be generated in the `dist` directory

---

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Leaflet + Element Plus
- **Backend**: Node.js + Express
- **Packaging**: Electron + electron-builder

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
