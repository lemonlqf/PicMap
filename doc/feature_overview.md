# PicMap - Feature Overview

---

> A local image map management app based on Vue3 frontend + Go (Wails) backend, displaying your photos on the map!

---

## Core Features

| Feature | Description |
|---------|-------------|
| 🔒 Local Storage | All data stored locally, no privacy leak risk |
| 🗺️ Map Display | Multiple map tiles and overlays, showing photo locations |
| 📤 Batch Upload | Select multiple images, supports HEIC/HEIF/RAW formats |
| 🏷️ Image Grouping | Create groups, filtering, batch operations |
| 🛤️ GPX Track | Upload, display and manage GPX track files |
| 🎬 Track Video | Align videos to tracks by time, stream playback and panorama video |
| 📍 Panorama | Immersive viewing of spherical/cylindrical panorama photos and videos |
| ⏱️ Timeline | Filter map images/videos by capture time |
| 👥 Multi-user | Multiple users with isolated data |
| 💾 Data Backup | Backup, import and restore support |
| 🌍 Internationalization | Supports Chinese, English and other languages |

---

## Features

### 1. Image Upload & Management

- **Batch Upload**: Select and preview multiple images before uploading (name, GPS coordinates, etc.)
- **Auto GPS Parsing**: Automatically extracts GPS coordinates from image EXIF data
- **Manual Location**: Set location for images without GPS by clicking on the map
- **Image Delete**: Delete single or multiple images
- **Image Describe**: Add description to images
- **Panorama Photos**: Auto-detect spherical/cylindrical panoramas (XMP GPano metadata first, aspect-ratio fallback), immersive viewing, also manually switchable via right-click

### 2. Map Display

- **Multiple Map Tiles**: Built-in Gaode satellite/vector/3D, supports OpenStreetMap and custom tiles
- **Tile Overlays**: Add extra overlays to a base tile (e.g. road labels over satellite), multiple supported, without covering track lines
- **Marker Display**: Show images and videos as markers on the map
- **Marker Clustering**: Supercluster-based clustering with merge/split animations; spiderfy for overlapping markers
- **Image Details**: Click markers to view image details in drawer
- **View Control**: Zoom, pan, pitch, locate to specific images
- **Pure Mode**: Hide sidebar for fullscreen map viewing
- **WGS84 to GCJ02**: Automatic coordinate conversion for Chinese map providers

### 3. Image Grouping

- **Create Groups**: Create multiple groups for image classification
- **Group Coloring**: Each group can have different colors
- **Group Filter**: Filter map markers by group
- **Batch Grouping**: Set group for multiple images at once
- **Right-click Menu**: Quickly set groups via right-click menu
- **Group Visibility**: Toggle visibility of groups on map

### 4. GPX Track Management

- **Upload GPX**: Upload GPX track files from sports apps (Strava, Nike, etc.), 50MB limit
- **Track Display**: Display tracks on map with start/end markers
- **Show on Main Map**: Pin selected tracks on the main map with click details, highlight switching and right-click actions
- **Track Color**: Customize track line colors
- **Track Hover Card**: Hover to show name, distance and total duration
- **Track Statistics Details**:
  - Total distance
  - Start/end time
  - Moving time and total time
  - Average moving speed and pace
  - Elevation min/max/gain/loss
  - Max speed
  - Average heart rate, cadence, temperature (if available in GPX)
- **Multi-track Support**: Display multiple tracks simultaneously
- **Track-group Association**: Associate tracks with image groups
- **Timezone Setting**: Interpret GPX timestamps without timezone using a selected timezone (built-in common timezones, UTC-12:00 ~ UTC+14:00)

### 5. Track Video

- **Video Import**: Import local videos; duration and capture time are probed automatically (creation_time preferred, filename fallback)
- **Embedded-GPS Standalone Video**: Videos with embedded GPS appear as standalone markers on the map
- **Time Alignment**: Through the "Align Video" dialog, drag/enter videos as colored bands on the track timeline to associate them with a GPX track
  - Supports **absolute alignment** (by video start/end time) and **relative alignment** (spaced out when all videos precede the track start)
- **Track Video Nodes**: Generate video nodes along the track by sampling and distance decimation; click a node to open the play dialog
- **Video Playback**: video.js-based custom control bar with play/pause, volume, progress, fullscreen and keyboard shortcuts
- **Streaming Playback**: Prefers a local HTTP stream with Range support (progressive playback), falls back to chunked reading
- **Video Thumbnail**: First frame extracted automatically as the marker/list cover
- **Panorama Video**: Manually switch to panorama video for immersive equirectangular playback
- **Video Grouping & Delete**: Add videos to groups and delete in batch

### 6. Timeline

- **Time Filter**: Dual-slider time range to filter map images/videos in real time (including clusters)
- **Precision Switch**: Year / Month / Day precision
- **Distribution Chart**: Smooth area chart showing the data distribution over time
- **Reset**: Restore the full time range with one click

### 7. Box Selection & Batch Operations

- **Box Select**: Hold `Ctrl` (macOS `Cmd`) + left-drag to box-select; holding the modifier appends to the selection, otherwise replaces it; `Esc` cancels
- **Selection Preview**: Top toolbar shows the number of selected nodes
- **Batch Actions**: Batch delete, batch add to group, clear selection
- Group nodes are excluded from box selection; clusters expand to all contained images/videos

### 8. User Management

- **Multi-user**: Create multiple users with isolated data spaces
- **User Switch**: Quickly switch between users to view their data
- **User Delete**: Delete user and all their data (cached thumbnails are cleared too)
- **User Avatar**: Support setting user avatar
- **Data Isolation**: Each user's data is isolated from others

### 9. Data Backup & Restore

- **Create Backup**: One-click package all data into a ZIP backup, with progress and cancellation support
- **Backup History**: View all created backup files
- **Data Restore**: Restore data from backup files
- **Import Modes**:
  - Overwrite: replace existing data after validation (original data preserved on failure)
  - Merge: keep existing data and append new items from the backup (deduplicated by ID)
- **Backup Delete**: Delete unwanted backup files

### 10. System Settings

- **Language Switch**: Supports Chinese, English and other languages
- **Map Tile Config**: Add, edit, delete custom map tiles; set covers and configure overlays
- **Storage Directory**: Change the data directory and backup directory
- **User & Data Management**: User add/remove, data backup import/export

---

## Supported Image Formats

| Format | Extension | GPS | Notes |
|--------|-----------|:---:|-------|
| JPEG | .jpg / .jpeg | ✓ | Common photo format |
| PNG | .png | ✓ | Supports transparency |
| GIF | .gif | ✗ | Animated images |
| WEBP | .webp | ✓ | Modern image format |
| HEIC | .heic | ✓ | iPhone common format |
| HEIF | .heif | ✓ | High efficiency format |
| BMP | .bmp | ✓ | Bitmap format |
| TIFF | .tif / .tiff | ✓ | Tagged image format |
| RAW | .raw / .dng | ✓ | Universal RAW format |
| Canon RAW | .cr2 / .cr3 | ✓ | Canon DSLR |
| Nikon RAW | .nef | ✓ | Nikon DSLR |
| Sony RAW | .arw | ✓ | Sony camera |
| Fuji RAF | .raf | ✓ | Fujifilm camera |
| Panasonic RW2 | .rw2 | ✓ | Panasonic camera |
| Olympus ORF | .orf | ✓ | Olympus camera |
| GoPro GPR | .gpr | ✓ | GoPro |

> Note: PicMap locates photos by reading GPS data from image EXIF. Some images may not have GPS info and require manual location setting. HEIC/RAW formats are transcoded before parsing and thumbnail generation.

### Supported Video Formats

`.mp4` / `.mov` / `.m4v` / `.mkv` / `.avi`

---

## Data Storage

### Directory Structure

```
D:\PicMap\
├── appSchema.json          # App config (user list, map tile config, etc.)
├── PicMap_Backup\          # Backup files directory
│   └── PicMap_Backup_*.zip
└── [UserID]\               # User data directory
    ├── images\
    │   ├── schema\
    │   │   └── schema.json # User image annotation data
    │   ├── _THUMBNAIL_PM*.jpg  # Generated thumbnails
    │   └── PM*.jpg         # Uploaded image files
    ├── tracks\             # GPX track files
    ├── videos\             # Track video files
    └── icons\              # User-defined icons
```

### File Description

| File/Directory | Description |
|----------------|-------------|
| appSchema.json | App-level config, user list, map tile config |
| [UserID]/images/ | User uploaded images and thumbnails |
| [UserID]/images/schema/schema.json | User annotation data (imageInfo, groupInfo, trackInfo, videoInfo, mapInfo) |
| [UserID]/tracks/ | User GPX track files |
| [UserID]/videos/ | User track video files |
| [UserID]/icons/ | User-defined icons |
| PicMap_Backup/ | Generated backup files |

### Storage Config File

The chosen storage directory is recorded in `.picmap-config.json` in your home directory
(`C:\Users\<username>\.picmap-config.json`), so the data and backup directories are remembered across launches.

---

## Tech Stack

### Frontend

- **Vue 3**: Progressive frontend framework
- **TypeScript**: Type-safe JavaScript superset
- **Vite**: Next generation frontend build tool
- **MapLibre GL**: Open-source map library (WebGL vector rendering)
- **Photo Sphere Viewer**: Panorama photo/video viewing
- **video.js**: Video player
- **Element Plus**: Vue 3 based UI component library
- **Pinia**: Lightweight state management library
- **ExifReader**: Image EXIF parsing
- **Supercluster**: Marker clustering
- **vue-i18n**: Internationalization solution
- **lodash-es**: Utility library

### Backend

- **Go + Wails v2**: Desktop app framework; frontend/backend communicate via Wails bindings (no HTTP server)
- **imaging / golang.org/x/image**: Image decoding, resizing, thumbnail generation
- **goexif**: EXIF parsing
- **archive/zip**: Backup packing and restore
- **Local HTTP media stream server**: Listens on 127.0.0.1 only, provides Range-enabled streaming for video/image access
- **External tools**: ImageMagick (HEIC transcoding), libraw (RAW decoding), ffmpeg (video probing/frame extraction), shipped with the app (`dist/tools/`)

---

## Notes

- 💡 All data stored locally, recommend regular backups
- 📍 Only images with EXIF GPS info can be auto-located, others need manual setting
- 📂 Default storage path: `D:\PicMap` (changeable in Settings)
- 🌐 Except for map tiles, other features work offline
- 👤 Multi-user data is isolated, deleting user removes all their data
- 🛤️ GPX tracks are automatically converted from WGS84 to GCJ02 coordinates for display on Chinese map providers

---

## FAQ

**Q: Uploaded images not showing on map?**

A: Check if images contain GPS info. Images without GPS need manual location setting.

**Q: How to backup data?**

A: Go to settings, click "Create Backup", system will generate ZIP backup file.

**Q: How to switch users?**

A: Click user icon in top right corner, select or create another user.

**Q: HEIC images not displaying?**

A: System automatically converts HEIC to JPEG format. If conversion fails, ensure image integrity.

**Q: How to add GPX tracks?**

A: Go to track management panel, click upload button and select GPX file. Tracks will be displayed on map after upload.

**Q: How to associate videos with a track?**

A: Use the "Align Video" function in the track upload/edit view, drag videos onto the track timeline, and save. Video nodes will then appear on the track.

**Q: No video nodes on the track?**

A: Make sure the videos have been time-aligned and associated with that track, and that the track is visible.

---

## Related Docs

- [API Documentation](API.md) - Frontend and backend API reference
- [Data Schema](DATA_SCHEMA.md) - Data structure specification
