# PicMap 接口文档（Wails 绑定）

## 概述

PicMap 前端与后端通过 **Wails v2 绑定**通信，**不提供 HTTP 服务**。
前端通过 `window.go.main.App.<Method>(...)` 调用 Go 侧方法，调用集中在
`frontend/src/wails/api.ts`，并自动注入当前用户 `userId`。

> 另有一个仅监听 `127.0.0.1` 的**本地媒体流服务**用于视频/图片的流式访问
> （支持 HTTP Range），详见文末「媒体流服务」。

---

## 通用说明

### 响应格式

所有绑定方法返回统一的 `model.Result`：

```json
{
  "code": 200,
  "msg": "成功",
  "data": {},
  "time": 1704067200000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `number` | `200` 成功 / `500` 失败 |
| `msg` | `string` | 状态信息 |
| `data` | `any` | 返回数据，因接口而异 |
| `time` | `number` | 毫秒时间戳 |

### 约定

- `userId` 由前端 `api.ts` 从当前用户自动注入，本文档参数表中不再重复说明。
- 图片、视频的 `id` 通常为原始文件名；后端以 `PM<baseName>.<ext>` 命名存储。
- 资源文件的展示优先走媒体流 URL，不可用时前端回退 base64 桥接。

---

## 目录

- [用户与配置](#用户与配置)
- [图片](#图片)
- [轨迹](#轨迹)
- [视频](#视频)
- [图标库](#图标库)
- [备份](#备份)
- [存储目录](#存储目录)
- [事件（后端 → 前端）](#事件后端--前端)
- [媒体流服务](#媒体流服务)

---

## 用户与配置

### CreateUser

创建用户及其目录结构与默认 schema。

**签名**: `CreateUser(userId: string)`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | `string` | 是 | 用户ID |

**返回数据**: `"创建成功"` 或 `"用户已存在"`

---

### DeleteUser

删除用户目录、清理该用户缩略图缓存，并从 `appSchema.json` 移除该用户。

**签名**: `DeleteUser(userId: string)`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | `string` | 是 | 用户ID |

**返回数据**: `"删除成功"`

---

### GetAppSchema

获取应用级配置（用户列表、地图瓦片、叠加层、图标库）。

**签名**: `GetAppSchema()`

**返回数据**: `AppSchema` 对象（见 [DATA_SCHEMA.md](DATA_SCHEMA.md)）

---

### SetAppSchema

保存应用级配置。

**签名**: `SetAppSchema(schemaJSON: string)`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `schemaJSON` | `string` | 是 | AppSchema 的 JSON 字符串 |

---

### GetUserInfos

获取所有用户的基本信息。

**签名**: `GetUserInfos()`

**返回数据**: `UserInfo[]`

---

### GetSchema

获取指定用户的 schema（图片/分组/轨迹/视频/地图数据）。文件不存在时自动创建默认 schema。

**签名**: `GetSchema(userId: string)`

**返回数据**: schema 的 **JSON 字符串**（需前端 `JSON.parse`）

---

### SetSchema

保存指定用户的 schema（原子写入）。

**签名**: `SetSchema(userId: string, schemaJSON: string)`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `schemaJSON` | `string` | 是 | Schema 的 JSON 字符串 |

---

## 图片

### SelectImages

打开原生多选文件对话框，立即返回路径列表，后台分批解析 EXIF 并推送事件。

**签名**: `SelectImages()`

**返回数据**:

```json
{ "filePaths": ["C:\\a.jpg"], "total": 1 }
```

解析结果通过 `images-parsed` / `images-progress` / `images-done` 事件推送。

---

### ImportImages

将选中的图片从原路径复制到用户图片目录；HEIC/RAW 额外生成缩略图。

**签名**: `ImportImages(files: ImportFile[])`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 图片ID |
| `name` | `string` | 文件名 |
| `path` | `string` | 源文件路径 |

**返回数据**: `{ images: UploadResult[], errors?: string[] }`

---

### GetThumbnail

获取 1000px 缩略图（base64，带 LRU 缓存）。

**签名**: `GetThumbnail(imageId: string)`

**返回数据**: `{ file: string }`（base64）

---

### GetMarkerThumbnail

获取 120px marker 专用小图（base64，带 LRU 缓存）。

**签名**: `GetMarkerThumbnail(imageId: string)`

**返回数据**: `{ file: string }`

---

### GetThumbnails

批量获取 1000px 缩略图（最多 4 并发）。

**签名**: `GetThumbnails(imageIds: string[])`

**返回数据**: `{ files: string[] }`（与入参顺序对应）

---

### GetFullImage

获取原图（完整分辨率 base64，用于全景预览等）。

**签名**: `GetFullImage(imageId: string)`

**返回数据**: `{ file: string }`

---

### GetImageStreamUrl

获取图片的本地流地址（支持 Range，供 `<img>` 直接加载，替代 base64）。

**签名**: `GetImageStreamUrl(imageId: string, kind: string)`

| 参数 | 类型 | 说明 |
|------|------|------|
| `kind` | `string` | `thumb`（默认，1000px）\| `marker`（120px）\| `full`（原图） |

**返回数据**: `{ url: string }`

---

### DeleteImages

批量删除图片及其缩略图，并清理对应缓存。

**签名**: `DeleteImages(imageIds: string[])`

---

### DownloadImage

下载图片（返回原图 base64）。

**签名**: `DownloadImage(imageId: string)`

---

### UpdateImages

> ⚠️ 接口开发中，当前固定返回失败。

**签名**: `UpdateImages()`

---

## 轨迹

### UploadTrack

上传 GPX 轨迹文件（base64 传输，限制 50MB，仅 `.gpx`）。

**签名**: `UploadTrack(fileData: string, fileName: string)`

| 参数 | 类型 | 说明 |
|------|------|------|
| `fileData` | `string` | GPX 文件 base64 |
| `fileName` | `string` | 原始文件名 |

**返回数据**: `{ filePath: string, fileName: string }`

---

### DeleteTrack

删除指定轨迹文件。

**签名**: `DeleteTrack(fileName: string)`

**返回数据**: `{ message: "删除成功" }`

---

### GetTrack

获取轨迹文件内容。

**签名**: `GetTrack(fileName: string)`

**返回数据**: `{ fileContent: string }`（GPX XML 文本）

---

## 视频

### SelectVideos

打开原生多选视频对话框，立即返回路径列表，后台分批解析并推送事件。

**签名**: `SelectVideos()`

**返回数据**: `{ filePaths: string[], total: number }`

解析结果通过 `videos-parsed` / `videos-progress` / `videos-done` 事件推送。

---

### ImportVideo

将视频复制到用户视频目录，探测时长、起始时间与内嵌 GPS。

**签名**: `ImportVideo(file: ImportVideoFile)`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 视频ID |
| `name` | `string` | 文件名 |
| `path` | `string` | 源文件路径 |

**返回数据**: `VideoInfo` 对象

---

### DeleteVideos

删除视频文件。

**签名**: `DeleteVideos(videoIds: string[])`

---

### GetVideoRange

按字节范围读取视频片段（base64），用于分块播放回退方案。单次上限 8MB。

**签名**: `GetVideoRange(videoId: string, start: number, end: number)`

**返回数据**: `{ data: string, start: number, end: number, length: number }`

---

### GetVideoThumbnail

获取视频第一帧封面（base64 JPEG）。

**签名**: `GetVideoThumbnail(videoId: string)`

---

### GetVideoThumbnails

批量获取视频封面。

**签名**: `GetVideoThumbnails(videoIds: string[])`

**返回数据**: `{ files: Record<string, string> }`（videoId → base64）

---

### GetVideoFramePreview

从任意路径提取视频第一帧（用于待上传视频预览）。

**签名**: `GetVideoFramePreview(path: string)`

---

### GetVideoStreamUrl

获取视频的本地流地址（支持 Range，供 `<video>` 边下边播）。

**签名**: `GetVideoStreamUrl(videoId: string)`

**返回数据**: `{ url: string }`

---

## 图标库

### UploadIcon

上传自定义图标到全局图标库（限制 5MB，仅图片格式）。

**签名**: `UploadIcon(fileName: string, fileData: string, category: string)`

| 参数 | 类型 | 说明 |
|------|------|------|
| `fileName` | `string` | 文件名 |
| `fileData` | `string` | 文件 base64 |
| `category` | `string` | `avatar` \| `track` |

**返回数据**: `{ filePath, fileName, relPath }`

---

### GetIcon

读取图标文件（base64）。

**签名**: `GetIcon(category: string, fileName: string)`

**返回数据**: `{ file: string }`

---

### DeleteIcon

删除自定义图标。

**签名**: `DeleteIcon(category: string, fileName: string)`

---

### ListIcons

列出指定分类下的图标文件。

**签名**: `ListIcons(category: string)`

**返回数据**: `string[]`（文件名数组）

---

## 备份

### CreateBackup

启动备份任务（异步，进度经 `backup-progress` 事件推送，完成后发 `backup-done`）。

**签名**: `CreateBackup(name: string)`

| 参数 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 自定义备份名（留空按时间命名） |

**返回数据**:

```json
{
  "filePath": "D:\\PicMap_Backup\\PicMap_Backup_xxx.zip",
  "fileName": "PicMap_Backup_xxx.zip",
  "size": 10485760,
  "sizeWarning": false,
  "started": true
}
```

---

### CancelBackup

取消正在进行的备份。

**签名**: `CancelBackup()`

---

### GetBackupSize

获取当前数据体积。

**签名**: `GetBackupSize()`

**返回数据**: `{ size: number, sizeWarning: boolean }`

---

### GetBackupList

获取备份文件列表（按创建时间倒序）。

**签名**: `GetBackupList()`

**返回数据**: `{ fileName, filePath, size, createTime }[]`

---

### ImportBackup

从备份导入数据。

**签名**: `ImportBackup(filePath: string, mode: string)`

| 参数 | 类型 | 说明 |
|------|------|------|
| `mode` | `string` | `cover`（覆盖，先解压校验再原子替换）\| `merge`（合并，按 ID 去重追加） |

---

### DeleteBackup

删除指定备份文件。

**签名**: `DeleteBackup(filePath: string)`

---

## 存储目录

### GetStorageConfig

获取当前数据目录与备份目录。

**签名**: `GetStorageConfig()`

**返回数据**: `{ archiveDir: string, backupDir: string }`

---

### SelectDirectory

打开目录选择框。

**签名**: `SelectDirectory()`

**返回数据**: `{ path: string }`

---

### SelectBackupFile

打开备份文件选择框（`.zip`）。

**签名**: `SelectBackupFile()`

**返回数据**: `{ path: string, filePath: string }`

---

### SetStorageConfig

保存存储目录配置（需重启应用生效）。

**签名**: `SetStorageConfig(archiveDir: string, backupDir: string)`

---

## 事件（后端 → 前端）

通过 `window.runtime.EventsOn` 监听。

| 事件名 | 触发时机 | 载荷 |
|--------|----------|------|
| `images-parsed` | 一批图片解析完成 | `{ images: SelectedImage[], errors: string[] }` |
| `images-progress` | 图片解析进度 | `{ processed: number, total: number }` |
| `images-done` | 全部图片解析完成 | `{ total: number }` |
| `videos-parsed` | 一批视频解析完成 | `{ videos: SelectedVideo[], errors: string[] }` |
| `videos-progress` | 视频解析进度 | `{ processed: number, total: number }` |
| `videos-done` | 全部视频解析完成 | `{ total: number }` |
| `backup-progress` | 备份进度 | `{ processed: number, total: number, percent: number }` |
| `backup-done` | 备份结束 | `{ success: boolean, cancelled?: boolean, fileName?: string, filePath?: string, message?: string }` |

---

## 媒体流服务

后端启动一个仅监听 `127.0.0.1` 随机端口的 HTTP 服务，用于媒体文件的流式访问
（支持 HTTP Range / 断点续传）。地址通过 `GetVideoStreamUrl` / `GetImageStreamUrl` 获取。

| 路径 | 查询参数 | 说明 |
|------|----------|------|
| `GET /video` | `userId`, `videoId` | 视频字节流（`http.ServeContent` 处理 Range） |
| `GET /image` | `userId`, `imageId`, `kind` | 图片字节流；`kind`: `thumb` \| `marker` \| `full` |

> 说明：
> - 服务仅监听本机回环地址，应用退出（`OnShutdown`）时关闭。
> - 响应带 `Access-Control-Allow-Origin: *`，供 Wails 页面跨源加载。
> - 图片端点对 HEIC/RAW 会先转码再返回 JPEG。

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-01-15 | 初版（Express HTTP 接口） |
| 1.1.0 | 2026-03-26 | 新增轨迹功能 |
| 2.0.0 | 2026-07-30 | 迁移至 Go + Wails 绑定；新增视频、图标库、存储目录、媒体流 |
