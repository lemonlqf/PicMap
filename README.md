# PicMap

[中文](README_zh.md)

PicMap is an image mapping application based on Vue3 for the frontend and Express for the backend. You can display and manage your images on the map.

This application requires an internet connection only to fetch map tiles; all other features do not require online access. All your information and images are stored locally, eliminating the risk of personal information leakage.

The directory for saving images and data is: `D:\PicMap`

Supported system: `Windows`

# Main Features
- Image Location Display
![alt text](doc/image/image.png)

- Image Grouping

- User Management

  Allows adding, deleting, and editing user information.

- Map Management

  Allows management of map tiles.

## Tech Stack

- Frontend: Vue 3 + Vite + TypeScript + Leaflet
- Backend: Node.js + Express
- Build/Packaging: Vite、webpack、electron-builder

---

## Quick Start

### 1. 依赖安装

Frontend：

Navigate to the `picMap_frontend` directory

```bash
npm install
```
Backend:

Navigate to the `picMap_backend` directory

```bash
npm install
```

### 2. Start Development Environment

Frontend：

Navigate to the `picMap_frontend` directory

```bash
npm run dev
```
Backend：

Navigate to the `picMap_backend` directory

```bash
npm run start
```

## Build Electron Application

First, package the frontend and backend projects separately using the following command:

```bash
npm run build
```

After obtaining the frontend and backend artifacts, proceed to the next step.

Return to the root directory and run the application build command:

```bash
npm run build
```

After a successful build, the artifacts will be generated in the `dist` directory in the root folder.

