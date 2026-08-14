# 验证记录：go-wails-migration

## 基线审计（Task 1，日期：2026-08-13）

| 检查项 | 命令 | 结果 |
|---|---|---|
| Go 编译 | go build ./... | PASS（退出码 0） |
| Go vet | go vet ./... | PASS（退出码 0） |
| 前端类型检查 | npx vue-tsc --noEmit --skipLibCheck | 153 个错误均为预存错误（LocateDialog/VueCropper/ImageUpload 等），本次变更涉及文件（imgUpload/Index.vue、utils/Image.ts、wails/api.ts、eventBus.ts、type/image.ts）零错误 |
| P1.4 app.go 绑定 | Select-String app.go 'SelectImages\|ImportImages' | 有匹配（app.go:64-70） |
| P1.2 ImportFile 模型 | Select-String result.go 'ImportFile\|SelectedImage' | 有匹配（result.go:42-59） |
| P1.3 ImportImages handler | Select-String internal/ 'ImportImages' | 有匹配（handler.go） |
| P2.1 api.ts 路径上传方法 | Select-String api.ts 'selectImages\|importImages' | 有匹配（api.ts:28-46） |
| P2.2 Index.vue 旧逻辑残留 | Select-String Index.vue 'el-upload\|ExifReader\|readFileAsDataURL' | 无代码引用（仅遗留 `:deep(.el-upload-list)` 死样式，不影响功能） |

## 决策门结论

路径上传（P1.1-P1.4 / P2.1-P2.4）落地状态：**已落地**（git stash "1111" 恢复后，SelectImages/ImportImages 后端绑定、前端 api.ts/Index.vue/Image.ts 改造均在工作区）。

对后续任务的影响：Task 8（P3.4-P3.6 手工验证）可以正常执行，不做 BLOCKED 处置。tasks.md 的 P1.x/P2.x 勾选状态与实际代码一致，无需修正。

## T5.4 axios 清理（Task 2，日期：2026-08-13）

- package.json / package-lock.json / src 引用：均已无 axios（仅 api.ts 一处陈旧注释，已清理）
- node_modules/axios：不存在
- 技术债：exif-js、exifreader、heic2any 依赖仍保留——旧上传链路（el-upload）已移除，路径上传（P1/P2）落地后这些依赖为死依赖，待后续清理

## T5.6 前端构建验证（Task 4，日期：2026-08-13）

- npm install：通过（与 package-lock.json 一致）
- npm run build：通过（built in 20.53s，产物含 index.html 449B + assets/）
- npm run typecheck：153 个预存错误（基线一致，本次变更文件零错误）
- dist/ 产物生成正常，未被 git 跟踪
- 非阻塞警告：主 chunk 1.8MB 超 500kB 提示（可后续 code-split 优化）

## T6.1 wails dev 集成冒烟（Task 5，日期：2026-08-13）

启动方式：`wails dev` 后台启动 + 浏览器访问 http://localhost:34115（agent-browser 自动化）

| 模块 | 操作 | 结果 | 备注 |
|---|---|---|---|
| 启动 | 应用启动 | Pass | 日志 `PicMap started, data dir: D:/PicMap`，无 panic |
| 启动 | 前端加载 | Pass | 页面渲染地图、65 张图片列表、时间轴、分组面板 |
| Wails 绑定 | runtime:ready | Pass | 控制台 `Connected to backend` |
| Schema | GetSchema | Pass | code=200，34KB schema 返回 |
| Schema | GetAppSchema | Pass | code=200，用户列表正确（lemonlqf + 222） |
| 用户 | CreateUser(smoke_user_tmp) | Pass | 返回"创建成功"，目录 + 默认 schema 生成 |
| 用户 | DeleteUser(smoke_user_tmp) | Pass | 返回"删除成功"，目录消失 |
| 图片 | GetThumbnail | Pass | 修复 PM 前缀后 code=200 返回数据 |
| 备份 | GetBackupSize | Pass | 433MB，sizeWarning=false |
| 备份 | CreateBackup(smoke) | Pass | 451MB ZIP 生成（浏览器 eval 超时但实际成功） |
| 备份 | DeleteBackup(smoke) | Pass | 删除成功，文件消失 |

冒烟过程中发现并修复 3 个数据兼容性 bug（见 T6.2）。

## T6.2 数据兼容性（Task 6，日期：2026-08-13）

- 存量数据启动：65 张图片全部加载，用户列表与 Node 版一致
- **Bug 1（已修复）**：Go 端图片文件命名缺少 `PM` 前缀，导致读取 Node 版创建的 `PM*.jpg` 文件失败（缩略图全空）。修复：写入/读取 glob 统一 `PM` 前缀 + 无扩展名 base（commit a9c05b0）
- **Bug 2（已修复）**：备份 ZIP 条目路径用反斜杠，Node 版 archiver 用正斜杠。修复：zip 写入/解压统一正斜杠（commit ec45e60）
- **Bug 3（已修复）**：schema 版本字段 Go 端用 `verison`（历史文档误传），实际磁盘数据与 Node 版 defaultSchema 均用 `version`。修复：Go model/config/前端类型统一 `version`（commit d6e1457 + 文档修正）
- schema.json `version` 字段保留；无 .tmp 残留
- 备份 ZIP 内部结构：`appSchema.json` + `<userId>/images/PM*.jpg` 正斜杠路径，与 Node 版一致

## T6.4 生产打包（Task 9，日期：2026-08-13）

- `wails build -platform windows/amd64` 成功（22.5s）
- 产物：`build/bin/picmap.exe` 15.7MB
- tools 部署：`build/bin/tools/` 含 imagemagick/magick.exe、libraw/（dcraw_emu.exe + libraw.dll + simple_dcraw.exe）；工具已入库根 `tools/` 目录（含 dcraw.exe 备用）
- 独立启动：窗口 2.2s 就绪（见 T6.5）

## T6.5 体积与启动速度（Task 10，日期：2026-08-13）

| 指标 | 实测值 | 目标 | 结论 |
|---|---|---|---|
| picmap.exe 体积 | 15.7 MB | < 25MB | 达标 |
| 冷启动到窗口就绪 | 2.2s | ≤ 5s | 达标 |
| 空闲内存 | 79.6 MB | - | 远低于 Electron 版（~300MB） |

## 收尾：跳过的手工验证项（日期：2026-08-14）

以下 5 项 GUI 手工验证因无法自动化（原生对话框选图、实际图片上传、全功能回归），经用户确认**接受跳过**，风险记录如下。MapLibre 迁移完成后将统一重新回归：

| 任务 | 内容 | 跳过原因 | 风险 |
|---|---|---|---|
| T6.3 | 50 张图片并发上传性能对比 | 需实际 GUI 操作 | 上传性能无量化基线 |
| T6.6 | 全功能回归（地图/分组/时间轴/GPX/备份/多用户） | 需完整 GUI 回归 | 部分功能未经端到端回归 |
| P3.4 | 50MB HEIC 上传内存验证 | 需实际大文件 | 大图内存表现未验证 |
| P3.5 | 批量 GPS 图片上传验证 | 需实际上传 | 路径上传批量链路未端到端验证 |
| P3.6 | 删除文件容错验证 | 需构造删除场景 | 容错路径未验证 |

> 说明：核心功能已通过自动化验证（go build/vet、vue-tsc、wails dev 冒烟、数据兼容性 API 级验证、打包）。上述 5 项为 GUI 交互验证，留待 MapLibre 迁移后的统一回归。

## 代码审查记录（review_mode: standard，日期：2026-08-14）

### 审查结论

无 Critical 问题。审查发现 6 个 Important 问题，其中 3 个已修复，3 个记录为接受风险（详见下）。

### 已修复

| 问题 | 修复 |
|---|---|
| Issue 1: GetThumbnail 回退原图返回全尺寸 base64 | 回退原图时 `ResizeToJPEGBytes` 缩到 1000px（HEIC/RAW 无法解码时回退原字节） |
| Issue 2: 部分解析失败产生空 id 条目 | 推送前过滤零值项 `r.ID != ""` |
| Issue 4: 缩略图前缀文档写 `_THUMBNAIL_PM_`（带尾下划线），实现为 `_THUMBNAIL_PM` | 已确认 Node 版实际命名为 `_THUMBNAIL_PM`（不带尾下划线），修正文档 |

### 接受的风险（非 Critical，后续处理）

| 问题 | 接受原因 |
|---|---|
| Issue 3: thumbCache（sync.Map）无界且删除后不失效 | 单用户图片量有限；MapLibre 迁移后地图层重写，届时一并处理缓存生命周期 |
| Issue 5: glob 解析含 `[ ] * ?` 的文件名失配 | 罕见文件名场景；Node 版用精确路径，可后续改为 `os.Stat` 精确匹配 |
| Issue 6: ZIP 解压路径穿越（zip-slip，历史遗留） | 本地桌面应用、备份自产，风险低；可后续统一加路径校验 |
