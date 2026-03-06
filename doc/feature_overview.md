# PicMap - Feature Overview

---

> A local image map management app based on Vue3 + Express, displaying your photos on the map!

---

## Core Features

| Feature | Description |
|---------|-------------|
| 🔒 Local Storage | All data stored locally, no privacy leak risk |
| 🗺️ Map Display | Supports multiple map tiles, displaying photo locations |
| 📤 Batch Upload | Select multiple images, supports HEIC/HEIF format |
| 👥 Multi-user | Multiple users with isolated data |
| 💾 Data Backup | Backup, import and restore support |
| 🌍 Internationalization | Supports Chinese, English and other languages |

---

## Features

### 1. Image Upload & Management

- **Batch Upload**: Select and upload multiple images at once, buttons disabled during loading
- **Auto GPS Parsing**: Automatically extracts GPS coordinates from image EXIF data
- **Manual Location**: Set location for images without GPS by clicking on the map
- **Image Preview**: Preview image name, GPS coordinates before uploading
- **Image Delete**: Delete single or multiple images

### 2. Map Display

- **Multiple Map Tiles**: Supports Gaode, Baidu, OpenStreetMap and other online map tiles
- **Tile Management**: Add, delete, enable/disable map tiles in settings
- **Marker Display**: Show photos as markers on the map
- **Image Details**: Click markers to view image details in drawer
- **View Control**: Zoom, pan, locate to specific images
- **Pure Mode**: Hide sidebar for fullscreen map viewing

### 3. Image Grouping

- **Create Groups**: Create multiple groups for image classification
- **Group Coloring**: Each group can have different colors
- **Group Filter**: Filter map markers by group
- **Batch Grouping**: Set group for multiple images at once
- **Right-click Menu**: Quickly set groups via right-click menu

### 4. User Management

- **Multi-user**: Create multiple users with isolated data spaces
- **User Switch**: Quickly switch between users to view their data
- **User Delete**: Delete user and all their data
- **User Avatar**: Support setting user avatar
- **Data Isolation**: Each user's data is isolated from others

### 5. Data Backup & Restore

- **Create Backup**: One-click package all data into ZIP backup file
- **Backup History**: View all created backup files
- **Data Restore**: Restore data from backup files
- **Import Modes**:
  - Cover Mode: Clear existing data, import backup data
  - Merge Mode: Keep existing data, add new data from backup
- **Backup Delete**: Delete unwanted backup files

### 6. System Settings

- **Language Switch**: Supports Chinese, English and other languages
- **Map Tile Config**: Add, edit, delete custom map tiles
- **Cover Image**: Set cover images for map tiles

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

> Note: PicMap locates photos by reading GPS data from image EXIF. Some images may not have GPS info and require manual location setting.

---

## Data Storage

### Directory Structure

```
D:\PicMap\
├── appSchema.json          # App config (user list, map tile config, etc.)
├── PicMap_Backup\         # Backup files directory
│   └── PicMap_Backup_*.zip
└── [UserID]\              # User data directory
    └── images\
        ├── schema\
        │   └── schema.json  # User image annotation data
        └── *.jpg            # Uploaded image files
```

### File Description

| File/Directory | Description |
|----------------|-------------|
| appSchema.json | App-level config, user list, map tile config |
| [UserID]/images/ | User uploaded images storage |
| schema.json | User image annotation data (marker, group, imageInfo) |
| PicMap_Backup/ | Generated backup files |

---

## Tech Stack

### Frontend

- **Vue 3**: Progressive frontend framework
- **TypeScript**: Type-safe JavaScript superset
- **Vite**: Next generation frontend build tool
- **Leaflet**: Open-source map library
- **Element Plus**: Vue 3 based UI component library
- **Pinia**: Lightweight state management library
- **ExifReader**: Image EXIF parsing
- **heic2any**: HEIC format conversion
- **vue-i18n**: Internationalization solution

### Backend

- **Node.js**: JavaScript runtime
- **Express**: Node.js web framework
- **archiver**: ZIP compression
- **node-stream-zip**: ZIP decompression

---

## Notes

- 💡 All data stored locally, recommend regular backups
- 📍 Only images with EXIF GPS info can be auto-located, others need manual setting
- 📂 Default storage path: D:\PicMap
- 🌐 Except for map tiles, other features work offline
- 👤 Multi-user data is isolated, deleting user removes all their data

---

## FAQ

**Q: Uploaded images not showing on map?**

A: Check if images contain GPS info. Images without GPS need manual location setting.

**Q: How to backup data?**

A: Go to settings, click "Create Backup", system will generate ZIP backup file.

**Q: How to switch users?**

A: Click user icon in top right corner, select or create another user.

**Q: HEIC images not displaying?**

A: System automatically converts HEIC to JPEG. If conversion fails, ensure image integrity.

---

## Related Docs

- [API Documentation](API.md) - Frontend and backend API reference
