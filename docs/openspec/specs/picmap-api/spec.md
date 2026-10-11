# picmap-api Specification

## Purpose
TBD - created by archiving change go-wails-migration. Update Purpose after archive.
## Requirements
### Requirement: Go 后端 API 对齐

系统 SHALL 将 Node.js Express 的 22 个 API 端点迁移到 Go Wails 绑定，保持功能与数据格式完全兼容，返回统一 `Result` 结构（`code`/`msg`/`data`/`time`）。

#### Scenario: 图片管理 API

- **WHEN** 前端调用图片上传、缩略图获取、删除、下载等接口
- **THEN** 返回 `code` 200，行为与 Express 版一致（并发信号量 max=4、glob 匹配文件）

#### Scenario: Schema 管理 API

- **WHEN** 前端调用 GetSchema/SetSchema
- **THEN** 读取/原子写入（`.tmp` → `os.Rename`）schema.json，保留 `version` 字段（历史文档曾误记为 `verison`）

#### Scenario: 用户与 AppSchema API

- **WHEN** 前端调用 CreateUser/DeleteUser/GetAppSchema/SetAppSchema/GetUserInfos
- **THEN** 创建/删除用户目录及默认 schema，返回统一结果

#### Scenario: Track 与 Backup API

- **WHEN** 前端调用 UploadTrack/DeleteTrack/GetTrack/CreateBackup/ImportBackup/DeleteBackup
- **THEN** GPX 文件管理（50MB 限制）、ZIP 打包（正斜杠路径、500MB 警告）、cover/merge 导入

### Requirement: 数据兼容性

系统 SHALL 保持 `D:\PicMap\` 目录结构、JSON schema 格式、磁盘文件命名与 Node 版完全一致。

#### Scenario: 用 Node 版数据目录启动

- **WHEN** 用 Node.js 版创建的完整数据目录启动 Go 版
- **THEN** 所有图片在正确 GPS 位置显示，分组、轨迹、地图位置正确恢复，时间轴筛选正常

#### Scenario: 磁盘文件命名兼容

- **WHEN** 图片写入磁盘
- **THEN** 文件名使用 `PM` 前缀（`PM<baseName>.<ext>`），缩略图使用 `_THUMBNAIL_PM<baseName>.jpg`，与 Node 版一致

#### Scenario: 备份 ZIP 结构兼容

- **WHEN** 创建备份
- **THEN** ZIP 内部条目路径使用正斜杠（`appSchema.json` + `<userId>/images/PM*.jpg`），与 Node 版 archiver 输出一致

