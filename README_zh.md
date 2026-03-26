# PicMap

[English](README.md)

---

> 一个基于 Vue3 前端和 Express 后端的图片地图应用，你可以在地图上展示和管理你的图片。

![Vue 3](https://img.shields.io/badge/Vue-3.3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Electron](https://img.shields.io/badge/Electron-36+-gray)

本应用除了地图瓦片需要在线获取外，其他的所有功能都无需联网，您的所有信息和图片都**保存在本地**，无个人信息泄露风险。

适配系统：Windows  
数据保存目录：`D:\PicMap`

---

## 功能预览

![功能展示](doc/image/image.png)

---

## 核心特性

| 特性 | 说明 |
|------|------|
| 🔒 本地存储 | 所有数据保存在本地，无隐私泄露风险 |
| 🗺️ 地图展示 | 支持多种地图瓦片，直观展示照片位置 |
| 📤 批量上传 | 一次选择多张图片，支持 HEIC/HEIF/RAW 格式 |
| 🏷️ 图片分组 | 创建分组、筛选、批量操作 |
| 👥 多用户 | 支持多用户系统，数据相互隔离 |
| 💾 数据备份 | 支持备份、导入、恢复 |
| 🛤️ GPX 轨迹 | 上传、展示和管理 GPX 轨迹文件 |

---

## 快速开始

### 1. 安装依赖

```bash
npm run install:all
```

或手动安装：

```bash
# 前端
cd picMap_fontend
npm install

# 后端
cd picMap_backend
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

这将同时启动前端和后端。

或分别启动：

```bash
# 前端 (端口 5173)
cd picMap_fontend
npm run dev

# 后端 (端口 3000)
cd picMap_backend
npm start
```

---

## 构建 Electron 应用

### 方式一：一键构建（推荐）

```bash
npm run build:auto
```

这将自动完成：
1. 打包前端
2. 打包后端
3. 打包 Electron 应用
4. 清理 dist 中的 node_modules

### 方式二：手动构建

```bash
# 1. 打包前端
cd picMap_fontend
npm run build

# 2. 打包后端
cd picMap_backend
npm run build

# 3. 根目录打包应用
npm run build
```

打包成功后会在根目录下生成 `dist` 目录。

---

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Leaflet + Element Plus + Pinia
- **后端**：Node.js + Express
- **打包**：Electron + electron-builder
- **地图**：Leaflet 并支持 GPX 轨迹插件

---

## 文档

- [功能介绍](doc/feature_overview_zh.md) - 详细的功能说明
- [数据 Schema](doc/DATA_SCHEMA.md) - 数据结构说明
- [API 接口文档](doc/API.md) - 前后端接口

---

## 注意事项

- 💡 所有数据保存在本地，建议定期备份
- 📍 只有含 EXIF GPS 信息的图片才能自动定位
- 📂 默认存储路径：D:\PicMap
- 🌐 除地图瓦片外，其他功能可离线使用
- 🛤️ GPX 轨迹会自动从 WGS84 坐标转换为 GCJ02 坐标，适配国内地图服务商
