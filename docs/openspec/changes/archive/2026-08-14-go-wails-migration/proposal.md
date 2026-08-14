# Proposal: PicMap Electron → Go + Wails 迁移

## Why

当前 PicMap 基于 Electron + Node.js Express 构建，存在以下痛点：

1. **安装包体积过大**：~150MB（包含完整 Chromium + Node.js 运行时）
2. **多图上传性能瓶颈**：Node.js 单线程处理 HEIC/RAW 转码时阻塞，大量图片并发上传慢
3. **内存占用高**：Electron 常驻 Chromium 进程，空闲时也消耗大量内存
4. **启动速度慢**：需要加载完整浏览器引擎

## What Changes

将后端从 Node.js Express 迁移至 Go，将桌面打包从 Electron 迁移至 Wails，实现：

- 安装包体积降至 15-20MB
- 多图并发上传利用 Go 的 goroutine 实现真正的并行处理
- 内存占用大幅降低（无 Chromium 运行时）
- 启动速度提升至秒级
- **Vue 3 前端代码几乎全部复用**（仅替换 HTTP 调用层）

## 技术选型

| 层级 | 当前 | 迁移后 | 理由 |
|------|------|--------|------|
| 前端 | Vue 3 + TS + Vite | Vue 3 + TS + Vite (保留) | 核心资产，无需改动 |
| UI | Element Plus | Element Plus (保留) | 与 Vue 3 配套 |
| 地图 | Leaflet | Leaflet (保留) | 轻量、成熟 |
| 后端 | Node.js Express | Go (Wails 绑定) | 并发强、性能好 |
| 打包 | Electron | Wails v2 | 体积小、内存低 |
| 图片处理 | sharp / heic-convert | Go imaging 生态 + 外部工具 | 原生性能 |
| 图片转码 | 外部工具 (dcraw/ImageMagick) | 外部工具兜底 | 渐进迁移 |

## 范围

- **全部 API 对齐**：22 个现有 API 端点全部迁移，保证功能完整
- **数据兼容**：保持 `D:\PicMap\` 目录结构和 JSON schema 格式不变
- **前端复用**：仅修改 HTTP 调用层，UI 组件不变
- **不涉及**：新功能开发、UI 改版、数据模型变更

## 风险

| 风险 | 缓解措施 |
|------|----------|
| HEIC/RAW 转码在 Go 生态不如 Node.js 成熟 | 保留外部工具 (dcraw/ImageMagick) 作为兜底方案 |
| Wails 与 Leaflet 地图组件兼容性 | 提前在 Wails 环境中验证 Leaflet 渲染 |
| 数据迁移兼容性 | 保持 JSON 结构和文件命名完全一致，提供回滚方案 |
| Go 并发文件操作安全性 | 使用 mutex 保护 schema 写入，原子写入策略 |
