# PicMap

[English](README.md)

---

> 一个基于 Vue3 前端和 Express 后端的图片地图应用，你可以在地图上展示和管理你的图片。

![Vue 3](https://img.shields.io/badge/Vue-3.3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Electron](https://img.shields.io/badge/Electron-28+-gray)

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
| 📤 批量上传 | 一次选择多张图片，支持 HEIC/HEIF 格式 |
| 🏷️ 图片分组 | 创建分组、着色、筛选 |
| 👥 多用户 | 支持多用户系统，数据相互隔离 |
| 💾 数据备份 | 支持备份、导入、恢复 |

---

## 快速开始

### 1. 安装依赖

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
# 前端
cd picMap_fontend
npm run dev

# 后端
cd picMap_backend
npm run start
```

---

## 构建 Electron 应用

```bash
# 1. 分别打包前后端
cd picMap_fontend && npm run build
cd picMap_backend && npm run build

# 2. 根目录构建应用
cd ..
npm run build
```

打包成功后会在根目录下生成 `dist` 目录

---

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Leaflet + Element Plus
- **后端**：Node.js + Express
- **打包**：Electron + electron-builder

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
