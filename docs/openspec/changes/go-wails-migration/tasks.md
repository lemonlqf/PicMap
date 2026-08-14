# Tasks: PicMap Go + Wails 迁移

## 阶段一：环境准备与项目初始化

- [x] **T1.1** 安装 Go 1.21+ 和 Wails CLI v2，验证 `go version` 和 `wails version`
- [x] **T1.2** 手动搭建 Wails 项目脚手架（main.go, app.go, wails.json, go.mod）
- [x] **T1.3** 创建 Go 数据模型 (`internal/model/`)，对齐 TypeScript 类型定义（`version` 字段，历史文档曾误记为 `verison`）
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

## 阶段七：图片路径上传（替代 base64 载体）

### 1. 后端：文件选择与路径上传

- [x] **P1.1** 新增 `SelectImages()` 绑定：调用 Wails 原生对话框（`OpenMultipleFilesDialog`）返回所选图片绝对路径数组
- [x] **P1.2** 修改 `internal/model/result.go`：新增 `SelectedImage`/`ImportFile` 模型，路径语义取代 base64 URL
- [x] **P1.3** 修改 `internal/handler/handler.go`：新增 `ImportImages` 按路径 `os.Stat` 校验 + `io.Copy` 写入 `images/{id}.{ext}`，保留 4 并发限流，ID 做 `filepath.Base` 清理
- [x] **P1.4** 在 `app.go` 暴露 `SelectImages`/`ImportImages` 绑定，ctx 传入 handler
- [x] **P1.5** EXIF 解析下沉 Go 端（`internal/service/exif.go`）：GPS/相机/作者/图像信息全字段，GPS 在 Go 端完成 WGS84→GCJ02
- [x] **P1.6** 预览图生成服务（`internal/service/preview.go`）：标准格式 imaging 缩略 800px，HEIC/RAW 经外部工具转 JPEG；HEIC/RAW 导入时生成 `_THUMBNAIL_PM_` 缩略图文件

### 2. 前端：调用与解析改造

- [x] **P2.1** 修改 `frontend/src/wails/api.ts`：新增 `selectImages`/`importImages`
- [x] **P2.2** 修改 `frontend/src/components/imgUpload/Index.vue`：选文件改走后端对话框，移除 el-upload/exifreader/`readFileAsDataURL`/canvas 缩略图逻辑
- [x] **P2.3** 修改 `frontend/src/utils/Image.ts` 的 `uploadImages`：以路径数组驱动，4 张一批调用 `importImages`
- [x] **P2.4** `utils/eventBus.ts` 补充事件类型定义；`type/image.ts` 增加 `path`/`preview`/`type` 字段

### 3. 验证

- [x] **P3.1** `go build ./...` 与 `go vet ./...` 通过
- [x] **P3.2** `cd frontend && npx vue-tsc --noEmit --skipLibCheck` 通过（修改文件零错误）
- [x] **P3.3** `wails dev` 启动无报错
- [ ] **P3.4** 手工验证：单张 50MB HEIC 上传前端内存不随图暴涨、无卡顿
- [ ] **P3.5** 手工验证：批量多张含 GPS 图片上传成功、地图标记正确、进度可追踪
- [ ] **P3.6** 手工验证：文件在确认前被删除时返回明确错误、不写脏数据、不影响同批其他图片

### 4. 分批解析与事件推送

- [x] **P4.1** Go 端：`SelectImages` 拆分为「立即返回路径列表 + 后台 `parseImagesInBatches` 分批解析」，`Handler` 加 `parsing atomic.Bool` 防重入
- [x] **P4.2** Go 端：事件常量（images-parsed/images-progress/images-done）+ 首批 50ms 微延迟时序兜底 + ctx 有效性检查
- [x] **P4.3** 前端 api.ts：新增 `onImagesParsed/onImagesProgress/onImagesDone/offImagesEvents` 事件封装
- [x] **P4.4** 前端 Index.vue：`onMounted` 注册监听（先注册后触发）、批处理 push 一次写入、marker `nextTick` 延迟渲染、`onUnmounted` 清理监听
- [x] **P4.5** 前端模板：解析进度条（`v-show` 防 DOM 重建 + percentage NaN 防护）
- [x] **P4.6** 验证：`go build`/`go vet`/`vue-tsc` 通过 + wails dev 启动无报错
