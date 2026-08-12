# Tasks: PicMap Go + Wails 迁移

## 阶段一：环境准备与项目初始化

- [x] **T1.1** 安装 Go 1.21+ 和 Wails CLI v2，验证 `go version` 和 `wails version`
- [x] **T1.2** 手动搭建 Wails 项目脚手架（main.go, app.go, wails.json, go.mod）
- [x] **T1.3** 创建 Go 数据模型 (`internal/model/`)，对齐 TypeScript 类型定义（含 `verison` 拼写兼容）
- [x] **T1.4** 实现配置模块 (`internal/config/`)，复刻 `globalVariable.js` 的路径逻辑
- [x] **T1.5** 实现文件工具 (`internal/util/fileutil.go`)，路径构建、glob 查找
- [x] **T1.6** 实现坐标工具 (`internal/util/coordinate.go`)，WGS84↔GCJ02 转换

## 阶段二：Schema 与用户管理 API

- [x] **T2.1** 实现 `GetSchema` / `SetSchema`（含原子写入：写 `.tmp` → `os.Rename`）
- [x] **T2.2** 实现 `GetAppSchema` / `SetAppSchema` / `GetUserInfos`
- [x] **T2.3** 实现 `CreateUser` / `DeleteUser`（创建/删除用户目录及默认 schema）
- [x] **T2.4** 实现初始化逻辑（创建默认目录结构、appSchema.json、默认用户 user1）

## 阶段三：图片处理 API

- [x] **T3.1** 实现标准格式缩略图生成 (`disintegration/imaging`，resize width 800/1000)
- [x] **T3.2** 实现 EXIF GPS 信息解析 (`rwcarlsen/goexif`，提取经纬度、海拔)
- [x] **T3.3** 集成外部工具（ImageMagick magick.exe / dcraw_emu.exe）复制到 `tools/`
- [x] **T3.4** 实现 `UploadImages`（批量保存 base64 图片 + 并发 goroutine 处理，信号量 max=4）
- [x] **T3.5** 实现 `GetThumbnail` / `GetThumbnails`（查找 `_THUMBNAIL_*` 或原始文件，返回 base64）
- [x] **T3.6** 实现 `DeleteImages`（glob 匹配删除原始文件 + 缩略图文件）
- [x] **T3.7** 实现 `DownloadImage`（返回完整图片 base64）
- [x] **T3.8** 实现 `UpdateImages`（保持空实现，与 Node.js 版一致）

## 阶段四：Track 与 Backup API

- [x] **T4.1** 实现 `UploadTrack` / `DeleteTrack` / `GetTrack`（GPX 文件管理，50MB 限制）
- [x] **T4.2** 实现 `CreateBackup`（遍历数据目录 → `archive/zip` 打包，500MB 警告）
- [x] **T4.3** 实现 `GetBackupSize` / `GetBackupList`（统计大小、列出备份文件）
- [x] **T4.4** 实现 `ImportBackup` cover 模式（删除现有 → 解压 ZIP → 复制恢复）
- [x] **T4.5** 实现 `ImportBackup` merge 模式（合并 schema.json 去重、仅复制新文件）
- [x] **T4.6** 实现 `DeleteBackup`（删除指定备份 ZIP 文件）

## 阶段五：前端适配

- [x] **T5.1** 创建 `picMap_fontend/src/wails/api.ts`（前端仍在原目录）
- [x] **T5.2** `wails/api.ts` 封装所有 Go 绑定方法，暴露与现有 HTTP modules 相同签名
- [x] **T5.3** 修改所有导入路径（14 个文件，`http/modules/*` → `wails/api`）
- [ ] **T5.4** 移除 axios 依赖和相关配置（`package.json`, `http/` 目录）
- [ ] **T5.5** 调整 package.json 构建脚本适配 Wails
- [ ] **T5.6** 复制前端到 `frontend/` 并验证 `npm run build` 正常

## 阶段六：集成测试与打包

- [ ] **T6.1** 使用 `wails dev` 本地调试，验证所有 API 功能
- [ ] **T6.2** 测试数据兼容性（用现有 `D:\PicMap\` 数据目录启动）
- [ ] **T6.3** 性能测试：50 张图片并发上传对比 Node.js 版
- [ ] **T6.4** 使用 `wails build -platform windows/amd64` 打包
- [ ] **T6.5** 验证安装包大小（目标 < 25MB）和启动速度
- [ ] **T6.6** 回归测试所有功能（地图、分组、时间轴、GPX、备份、多用户）
