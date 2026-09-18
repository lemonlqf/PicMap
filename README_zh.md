# PicMap

[English](README.md)

---

> 一个基于 Vue3 前端和 Go 后端的图片地图应用，你可以在地图上展示和管理你的图片。

![Vue 3](https://img.shields.io/badge/Vue-3.3.4-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Go](https://img.shields.io/badge/Go-1.25-blue)
![Wails](https://img.shields.io/badge/Wails-v2-red)

本应用除了地图瓦片需要在线获取外，其他的所有功能都无需联网，您的所有信息和图片都**保存在本地**，无个人信息泄露风险。

适配系统：Windows 10/11（64 位）

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
| 🎬 轨迹视频 | 关联视频到轨迹，支持内嵌 GPS 定位与全景视频 |
| 📍 全景图片 | 支持全景图片/视频的沉浸式查看 |

---

## 用户使用说明

### 下载与安装

1. 从 [Releases](../../releases) 下载最新的 `picmap.exe`（或打包后的安装包）。
2. 双击运行即可，无需单独安装。首次运行会自动创建数据目录与默认用户。

> **系统要求**：Windows 10/11 64 位。程序依赖系统自带的 **WebView2** 运行时；
> Win11 及大部分 Win10 已预装。若启动后界面空白，请安装
> [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

### 首次使用流程

1. 启动后使用默认用户「用户1」，也可在右上角创建/切换用户（数据按用户完全隔离）。
2. 点击上传面板 → 选择图片，程序会自动解析 EXIF 中的 GPS 坐标并在地图上定位。
3. 无 GPS 的图片可手动标注位置；带 GPS 的 GPX 轨迹可直接拖入上传。
4. 在「设置」中可切换语言、管理地图瓦片、修改数据存储目录。

---

## 数据存储位置

所有数据保存在本地，**不经过任何服务器**。

### 默认位置

程序按以下顺序自动选择数据目录：

1. 第一个存在的盘符（从 `D:` 开始向后查找），创建为 `X:\PicMap`；
2. 若没有可用盘符，则使用用户主目录下的 `PicMap`（`C:\Users\<用户名>\PicMap`）。

因此默认路径通常是 `D:\PicMap`。你也可以在「设置 → 存储」中手动修改数据目录和备份目录。

### 目录结构

```
D:\PicMap\
├── appSchema.json           # 应用配置（用户列表、地图设置）
├── PicMap_Backup\           # 备份文件目录（默认在数据目录同级）
└── <用户ID>\
    ├── images\
    │   ├── schema\schema.json  # 该用户的图片/分组/轨迹/视频元数据
    │   ├── _THUMBNAIL_PM*.jpg  # 生成的缩略图
    │   └── PM*.jpg              # 导入的原始图片
    ├── tracks\               # GPX 轨迹文件
    ├── videos\               # 轨迹视频文件
    └── icons\                # 用户自定义图标
```

### 存储配置文件

你选择的存储目录会记录在用户主目录下的 `.picmap-config.json`
（`C:\Users\<用户名>\.picmap-config.json`）。它的作用是：即使你之后修改了数据目录，
程序下次启动仍能记住你的选择。若移动数据目录，请一并更新此文件中的路径。

---

## 备份与恢复

> 建议定期备份，数据完全保存在本地，程序不会自动上传任何内容。

### 创建备份

1. 打开「设置」；
2. 点击「创建备份」，可自定义备份文件名（留空则按时间命名）；
3. 备份过程中会显示进度，可随时取消；
4. 备份文件为 ZIP，保存在备份目录（默认 `D:\PicMap_Backup`）。

备份会打包 `appSchema.json` 与所有用户目录。数据量超过 500MB 时程序会给出提示。

### 恢复备份

1. 打开「设置」→「导入备份」，选择之前生成的 ZIP 文件；
2. 选择导入模式：
   - **覆盖模式**：完全替换现有数据（先解压校验，成功后才替换，失败会保留原数据）；
   - **合并模式**：保留现有数据，仅追加备份中不存在的图片/分组/轨迹/视频（按 ID 去重）；
3. 导入完成后重启应用生效。

### 手动备份

你也可以直接复制整个数据目录（默认 `D:\PicMap`）作为备份，恢复时复制回去即可。

---

## 构建与开发

### 环境要求

- Go 1.25+（[下载](https://go.dev/dl/)）
- Wails CLI v2
- Node.js 18+

```bash
# 安装 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 国内用户需设置 Go 代理
go env -w GOPROXY=https://goproxy.cn,direct

# 安装前端依赖
cd frontend && npm install

# 启动开发模式
cd .. && wails dev
```

### 构建

```bash
wails build -platform windows/amd64
```

打包成功后会在 `build/bin/` 目录下生成可执行文件。

### 质量检查

```bash
go build ./...    # 编译所有 Go 包
go vet ./...      # Go 静态检查
go test ./...     # 运行测试

cd frontend
npm run typecheck # 前端类型检查（vue-tsc）
npm run build     # 前端生产构建
```

---

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + MapLibre GL + Element Plus + Pinia
- **后端**：Go（Wails 绑定，无 HTTP 服务）
- **打包**：Wails v2 + WebView2
- **地图**：MapLibre GL，支持 GPX 轨迹展示

---

## 文档

- [功能介绍](doc/feature_overview_zh.md) - 详细的功能说明
- [数据 Schema](doc/DATA_SCHEMA.md) - 数据结构说明
- [API 接口文档](doc/API.md) - 前后端接口

---

## 注意事项

- 💡 所有数据保存在本地，建议定期备份
- 📍 只有含 EXIF GPS 信息的图片才能自动定位
- 📂 默认存储路径：`D:\PicMap`（可在设置中修改）
- 🌐 除地图瓦片外，其他功能可离线使用
- 🛤️ GPX 轨迹会自动从 WGS84 坐标转换为 GCJ02 坐标，适配国内地图服务商
