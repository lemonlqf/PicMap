---
change: go-wails-migration
design-doc: docs/superpowers/specs/2026-08-13-go-wails-migration-design.md
base-ref: 4d477560d3aeb0b99426800b8d9314a5231173c6
---

# PicMap Go + Wails 迁移收尾实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成 go-wails-migration 变更的剩余收尾工作——依赖清理、构建脚本适配、前端构建验证、集成冒烟、数据兼容性/性能验证、打包与全功能回归，并如实修正 tasks.md 与实际代码状态的偏差。

**Architecture:** 本计划不重新实现已编码完成的 Go 后端（22 个 API、base64 上传链路、EXIF/缩略图/转换 service）与前端 Wails 适配层，只做验证、清理与打包。由于规划时对 base-ref 做了基线审计，发现 tasks.md 中已勾选的"路径上传"（P1.1-P1.4 / P2.1-P2.4）在代码中并未落地（详见下方"规划时基线审计快照"），因此 Task 1 是强制前置审计任务：任何后续任务都以其结论为准，P3.4-P3.6 手工验证受决策门控制，禁止伪造通过结果。

**Tech Stack:** Go 1.26.5、Wails v2.14.0、Vue 3 + TypeScript + Vite 5、Element Plus、Leaflet、PowerShell 5.1（本计划所有命令均为 PowerShell 语法）。

## 规划时基线审计快照（base-ref: 4d47756，2026-08-13）

规划前对代码做了只读核查，结果与 tasks.md 勾选状态存在差异，供执行者参考：

| tasks.md 条目 | 勾选状态 | 代码实际状态 |
|---|---|---|
| T1.x-T4.x（Go 后端 22 API） | 已勾选 | 与代码一致：`internal/handler/handler.go`、`app.go` 均已实现（base64 上传链路） |
| T5.1-T5.3（前端适配层） | 已勾选 | 与代码一致：`frontend/src/wails/api.ts` 存在，14 个文件已改导入 |
| T5.4（移除 axios） | 未勾选 | 基本已完成：package.json / package-lock.json 无 axios，`src/http/` 已删除，仅 api.ts:257 有陈旧注释 |
| P1.1-P1.4（路径上传 Go 端） | 已勾选 | **未落地**：`app.go` 无 `SelectImages`/`ImportImages`；`internal/model/result.go` 无 `ImportFile`/`SelectedImage`；`internal/` 无 `ImportImages` |
| P1.5-P1.6（EXIF/预览下沉） | 已勾选 | **部分落地**：`internal/service/exif.go`（45 行）、`thumbnail.go`（79 行）、`convert.go` 存在，但 `handler.go` 未引用 service 包 |
| P2.1-P2.4（路径上传前端） | 已勾选 | **未落地**：`frontend/src/wails/api.ts` 无 `selectImages`/`importImages`；`imgUpload/Index.vue` 仍使用 el-upload + ExifReader + readFileAsDataURL；`utils/Image.ts` 的 `uploadImages` 仍走 base64 |
| P3.1-P3.3（编译/启动验证） | 已勾选 | 需 Task 1 重新验证 |
| T6.4 打包 | 未勾选 | 已存在产物：暂存区 `build/bin/picmap.exe`（15.9MB），需重新打包验证 |

## Global Constraints

- 构建与静态检查必须通过：`go build ./...`、`go vet ./...`、`cd frontend && npx vue-tsc --noEmit --skipLibCheck`
- Go 模块下载需设置 `GOPROXY=https://goproxy.cn,direct`（国内网络环境）
- 数据目录结构与 JSON 格式完全不变：`D:\PicMap\[userId]\images\schema\schema.json`、`appSchema.json`；`schema.json` 版本字段为 `version`（历史文档曾误记为 `verison`，执行时以磁盘实际数据为准）
- Schema 写入必须走 tmp + `os.Rename` 原子写；图片上传并发上限 4（信号量）
- 性能红线（PERFORMANCE.md）：避免同步阻塞、限制并发、GPX/单图 50MB 上限、备份超 500MB 警告
- 打包目标：安装包体积 < 25MB；`tools/`（imagemagick、libraw）随 exe 同目录部署
- 前端 schema 保存必须走 `saveSchema()`，不得直接调 `API.schema.setSchema()`
- 不修改 `dist/` 目录内容（构建产物，被 .gitignore 忽略）；不要直接编辑 `frontend/wailsjs/`（wails 自动生成）
- 本计划所有产物与记录使用中文；验证结果统一写入 `docs/openspec/changes/go-wails-migration/verification.md`
- 每任务完成后 commit；仅提交与本任务相关的文件

---

### Task 1: 基线审计与任务清单对齐（强制前置任务）

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/tasks.md`（按审计结果修正勾选状态）
- Create: `docs/openspec/changes/go-wails-migration/verification.md`（验证记录文件，后续任务追加）

**Interfaces:**
- Consumes: 无
- Produces: `verification.md`（Task 5-8、11 追加结果）；tasks.md 修正后的勾选状态（Task 8 决策门依据）

- [x] **Step 1: 验证 Go 编译与静态检查**

Run:
```powershell
go build ./...
go vet ./...
```
Expected: 两条命令均无错误输出，退出码 0。

- [x] **Step 2: 验证前端类型检查**

Run:
```powershell
cd frontend; npx vue-tsc --noEmit --skipLibCheck
```
Expected: 0 errors。若出现错误，记录错误列表后仍继续本任务（错误清单写入 verification.md）。

- [x] **Step 3: 审计 P1.x/P2.x 落地证据**

Run（在仓库根目录）:
```powershell
Select-String -Path app.go -Pattern 'SelectImages|ImportImages'
Select-String -Path internal/model/result.go -Pattern 'ImportFile|SelectedImage'
Get-ChildItem internal -Recurse -Include *.go | Select-String -Pattern 'ImportImages'
Select-String -Path frontend/src/wails/api.ts -Pattern 'selectImages|importImages'
Select-String -Path frontend/src/components/imgUpload/Index.vue -Pattern 'el-upload|ExifReader|readFileAsDataURL'
Select-String -Path frontend/src/utils/Image.ts -Pattern 'importImages'
```
Expected（按 tasks.md 勾选状态）: 前 4 条应有匹配、后 2 条应无匹配。
规划时快照（base-ref 4d47756）: 前 4 条无匹配、后 2 条有匹配——即 P1.1-P1.4、P2.1-P2.4 实际未落地。

- [x] **Step 4: 创建 verification.md 并记录审计结论**

Create `docs/openspec/changes/go-wails-migration/verification.md`，内容包含：

```markdown
# 验证记录：go-wails-migration

## 基线审计（Task 1，日期：____）

| 检查项 | 命令 | 结果 |
|---|---|---|
| Go 编译 | go build ./... | ____ |
| Go vet | go vet ./... | ____ |
| 前端类型检查 | npx vue-tsc --noEmit --skipLibCheck | ____ |
| P1.4 app.go 绑定 | Select-String app.go 'SelectImages\|ImportImages' | ____ |
| P1.2 ImportFile 模型 | Select-String result.go 'ImportFile\|SelectedImage' | ____ |
| P1.3 ImportImages handler | Select-String internal/ 'ImportImages' | ____ |
| P2.1 api.ts 路径上传方法 | Select-String api.ts 'selectImages\|importImages' | ____ |
| P2.2 Index.vue 旧逻辑残留 | Select-String Index.vue 'el-upload\|ExifReader\|readFileAsDataURL' | ____ |

## 决策门结论

路径上传（P1.1-P1.4 / P2.1-P2.4）落地状态：已落地 / 未落地
对后续任务的影响：____
```

- [x] **Step 5: 修正 tasks.md 勾选状态**

按审计结果处理：
- 若某项"已勾选"但代码未落地：取消勾选，并在任务行尾追加 `<!-- 审计：未在 base-ref 落地 -->`；
- 若某项"未勾选"但代码已落地（如 T5.4）：保持未勾选，待对应任务完成后勾选；
- 审计确认通过的条目保持不动。

- [x] **Step 6: Commit**

```powershell
git add docs/openspec/changes/go-wails-migration/tasks.md docs/openspec/changes/go-wails-migration/verification.md
git commit -m "chore: 基线审计并修正 go-wails-migration 任务勾选状态"
```

---

### Task 2: T5.4 移除 axios 依赖残留

**Files:**
- Modify: `frontend/src/wails/api.ts:257`（陈旧注释）
- Modify: `frontend/package.json`（仅当审计发现 axios 仍在依赖中）

**Interfaces:**
- Consumes: 无
- Produces: 干净的依赖清单（Task 3 基于此调整构建脚本）

- [x] **Step 1: 核查三处 axios 残留**

Run（仓库根目录）:
```powershell
Select-String -Path frontend/package.json -Pattern 'axios'
Select-String -Path frontend/package-lock.json -Pattern '"axios"'
Get-ChildItem frontend/src -Recurse -Include *.ts,*.vue,*.js | Select-String -Pattern "axios|http/modules" | Select-Object Path, LineNumber, Line
```
Expected: 前两条无匹配；第三条最多命中 `frontend/src/wails/api.ts:257` 的注释（非代码引用）。
规划时快照: 全部符合预期。

- [x] **Step 2: 若 package.json 仍列 axios，移除并重装**

仅当 Step 1 第一条有匹配时执行：
```powershell
cd frontend; npm uninstall axios
```
Expected: package.json / package-lock.json 中 axios 条目消失。

- [x] **Step 3: 清理 api.ts 陈旧注释**

Edit `frontend/src/wails/api.ts:257`，将：
```typescript
// Export as module objects matching the original http/modules structure
```
替换为：
```typescript
// 以模块对象导出，保持与原 HTTP API 相同的调用形态（API.image.xxx / API.schema.xxx）
```

- [x] **Step 4: 检查 node_modules 残留并记录技术债**

Run:
```powershell
Test-Path frontend/node_modules/axios
```
Expected: False。若为 True，执行 `cd frontend; npm install` 清理后复测。
同时在 `verification.md` 追加：

```markdown
## T5.4 axios 清理（Task 2，日期：____）

- package.json / package-lock.json / src 引用：均已无 axios
- 技术债：exif-js、exifreader、heic2any 依赖仍保留——旧上传链路（el-upload）仍引用 exifreader（Index.vue:137），在路径上传（P1/P2）落地前不得移除
```

- [x] **Step 5: 验证前端类型检查仍通过**

Run: `cd frontend; npx vue-tsc --noEmit --skipLibCheck`
Expected: 0 errors。

- [x] **Step 6: Commit**

```powershell
git add frontend/src/wails/api.ts frontend/package.json frontend/package-lock.json docs/openspec/changes/go-wails-migration/verification.md
git commit -m "chore: 移除 axios 依赖残留并清理陈旧注释 (T5.4)"
```
注意：若 package.json / package-lock.json 无变化，不要 `git add` 不存在的变更，仅提交实际修改的文件。

---

### Task 3: T5.5 调整构建脚本适配 Wails

**Files:**
- Modify: `frontend/package.json`（新增 `typecheck` script）
- Delete: `frontend/pnpm-lock.yaml`（若 npm 为唯一包管理器）

**Interfaces:**
- Consumes: Task 2 后的干净依赖清单
- Produces: `npm run typecheck` 命令（Task 4、后续任务复用）；单一 lockfile（npm）

- [x] **Step 1: 核对 wails.json 与 package.json 脚本一致性**

Run:
```powershell
Get-Content wails.json
Get-Content frontend/package.json
```
Expected: `wails.json` 中 `frontend:install: npm install`、`frontend:build: npm run build`、`frontend:dev:watcher: npm run dev` 与 package.json 的 `dev/build/preview` 脚本一一对应。规划时快照: 已一致，无需修改 wails.json。

- [x] **Step 2: 新增 typecheck 脚本**

Edit `frontend/package.json` scripts 块，在 `"preview": "vite preview"` 后追加：
```json
"typecheck": "vue-tsc --noEmit --skipLibCheck"
```
（与 AGENTS.md 记录的前端类型检查命令一致。）

- [x] **Step 3: 统一 lockfile 为 npm**

Run:
```powershell
Test-Path frontend/pnpm-lock.yaml
```
若存在：确认 `frontend/node_modules` 由 npm 安装（存在 `node_modules/.package-lock.json` 即视为 npm），然后：
```powershell
Remove-Item frontend/pnpm-lock.yaml
cd frontend; npm install
git diff --stat frontend/package-lock.json
```
Expected: `npm install` 成功；package-lock.json 无变化或仅顺序性差异。若 package-lock.json 变化巨大，说明 lockfile 已过期，保留更新结果（构建验证将在 Task 4 覆盖）。

- [x] **Step 4: 核对 vite.config.js 无需改动**

Run: `Get-Content frontend/vite.config.js`
Expected: `base: './'`（Wails asset server 要求相对路径）、`@` alias 指向 `src`。规划时快照: 已正确，不改动。

- [x] **Step 5: 验证**

Run:
```powershell
cd frontend; npm run typecheck
```
Expected: 0 errors。

- [x] **Step 6: Commit**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/pnpm-lock.yaml
git commit -m "chore: 前端构建脚本适配 Wails（新增 typecheck，统一 npm lockfile）(T5.5)"
```
若 pnpm-lock.yaml 未删除则不要包含在 `git add` 中。

---

### Task 4: T5.6 前端构建验证

**Files:**
- 无代码修改（构建产物 `frontend/dist/` 被 .gitignore 忽略，不提交）

**Interfaces:**
- Consumes: Task 3 的 package.json / lockfile
- Produces: 可被 `go:embed all:frontend/dist` 嵌入的构建产物（Task 5、9 的前置）

- [x] **Step 1: 干净安装依赖**

Run:
```powershell
cd frontend; npm install
```
Expected: 无 error；输出与 package-lock.json 一致。

- [x] **Step 2: 生产构建**

Run:
```powershell
cd frontend; npm run build
```
Expected: vite 构建成功，`frontend/dist/` 生成（含 index.html、assets/），无 error/warning 阻塞项。

- [x] **Step 3: 类型检查**

Run: `cd frontend; npm run typecheck`
Expected: 0 errors。

- [x] **Step 4: 产物抽查**

Run:
```powershell
Test-Path frontend/dist/index.html
Test-Path frontend/dist/assets
(Get-Item frontend/dist/index.html).Length
```
Expected: 两项 True；index.html 非空。同时确认 `git status` 中不出现 `frontend/dist/` 的变更（被忽略）。

- [x] **Step 5: 追加验证记录并 Commit**

在 `verification.md` 追加：

```markdown
## T5.6 前端构建验证（Task 4，日期：____）

- npm install / npm run build / npm run typecheck：全部通过
- dist/ 产物生成正常，未被 git 跟踪
```

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md
git commit -m "chore: 前端构建验证通过并记录 (T5.6)"
```
（若无其他变更，此 commit 仅含 verification.md。）

---

### Task 5: T6.1 wails dev 集成冒烟与 API 功能验证

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`（追加结果）

**Interfaces:**
- Consumes: Task 4 的 dist 产物
- Produces: 冒烟结果矩阵（Task 11 回归的前置；任何未通过项在此发现）

- [x] **Step 1: 启动 wails dev**

Run（仓库根目录）:
```powershell
$env:GOPROXY = "https://goproxy.cn,direct"
wails dev
```
Expected: 应用窗口出现，控制台日志含 `PicMap started, data dir: D:\PicMap`（或探测到的首个盘符），无 panic。

- [x] **Step 2: 启动健康检查**

验证：窗口标题 PicMap；地图渲染出瓦片（Leaflet 正常加载，验证设计文档"Wails 与 Leaflet 兼容性"风险项）；右上角用户信息显示 user1；Console 无红错（Wails 绑定不可用的报错）。

- [x] **Step 3: 逐模块功能清单验证**

按以下矩阵逐项执行，结果记入 verification.md（Pass / Fail / 备注）：

| 模块 | 操作 | 期望结果 |
|---|---|---|
| Schema | 应用启动 | 自动加载 schema，地图中心为 30.2489634, 120.2052342（默认）或已保存位置 |
| 用户 | 创建 user2 | 右上角切换出现 user2；D:\PicMap\user2\ 目录生成 |
| 用户 | 切换到 user2 | 空数据界面；与 user1 数据隔离 |
| 用户 | 删除 user2 | user2 目录被删除，用户列表恢复 |
| 图片 | 上传 3 张含 GPS 的 JPG | 上传成功；地图出现 3 个标记；标记位置与高德地图对照偏移正确（GCJ02） |
| 图片 | 查看缩略图 | 图库/标记显示缩略图 |
| 图片 | 删除 1 张 | 图片文件与缩略图文件从磁盘消失，标记消失 |
| 分组 | 创建分组 + 批量加入图片 | 分组标记出现，颜色正确；可见性切换生效 |
| 轨迹 | 上传 GPX | 轨迹线显示，起终点标记正确，统计（距离/时长）合理 |
| 轨迹 | 删除 GPX | 轨迹线与文件消失 |
| 备份 | 创建备份 | PicMap_Backup\ 下生成 ZIP；若数据超 500MB 出现警告 |
| 备份 | 备份列表 | 列表显示文件名/大小/时间 |
| 备份 | cover 导入 | 数据被备份完全替换 |
| 备份 | merge 导入 | 现有数据保留，新文件合并去重 |
| 备份 | 删除备份 | ZIP 文件被删除 |
| 设置 | 语言切换 | 中英文切换生效 |
| 设置 | 瓦片源切换 | 高德/OSM/自定义瓦片正常渲染 |
| 设置 | 地图位置记忆 | 移动缩放后重启，位置恢复 |

- [x] **Step 4: 记录结果**

将矩阵结果以表格写入 `verification.md`：

```markdown
## T6.1 wails dev 集成冒烟（Task 5，日期：____）

| 模块 | 操作 | 结果 | 备注 |
|---|---|---|---|
| ... | ... | Pass/Fail | ... |
```

- [x] **Step 5: Commit**

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md
git commit -m "test: wails dev 集成冒烟结果记录 (T6.1)"
```

---

### Task 6: T6.2 数据兼容性测试（现有 D:\PicMap 数据）

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`（追加结果）

**Interfaces:**
- Consumes: Task 5 的冒烟结论
- Produces: 兼容性结论（数据目录结构、schema 拼写、备份结构三项不可变约束的验证证据）

- [x] **Step 1: 只读保护——备份关键元数据**

Run:
```powershell
$bk = "C:\Users\lemon\AppData\Local\Temp\opencode\picmap-schema-bak"
New-Item -ItemType Directory -Force -Path $bk | Out-Null
Copy-Item "D:\PicMap\appSchema.json" "$bk\appSchema.json" -Force
Copy-Item "D:\PicMap\user1\images\schema\schema.json" "$bk\schema-user1.json" -Force
```
Expected: 拷贝成功。本任务全程只读验证，不修改 D:\PicMap 任何数据；如某步骤误触发写入，用备份恢复。

- [x] **Step 2: 用现有数据启动并核对存量**

Run: `wails dev`
Expected:
- 用户列表与 Node 版一致（user1 及历史创建的用户都在）；
- 已有图片数量一致：右侧图库/时间轴统计与 Node 版一致；
- 已有图片缩略图正常显示（`_THUMBNAIL_*` 旧文件被 Go 端 `GetThumbnail` 的 glob 命中）。

- [x] **Step 3: 验证 schema.json 兼容性（version 字段）**

Run:
```powershell
Select-String -Path "D:\PicMap\user1\images\schema\schema.json" -Pattern 'version'
```
Expected: 有匹配（`"version"` 字段保留）。再在应用内做一次无害操作（如切换分组可见性），保存后再次运行该命令：字段仍在，且 `schema.json` 无 `.tmp` 残留文件。

- [x] **Step 4: 验证备份 ZIP 内部结构一致**

Run（应用内创建备份后）:
```powershell
tar -tf "D:\PicMap_Backup\<刚创建的备份文件名>" | Select-Object -First 20
```
Expected: 内部结构为 `appSchema.json` + `<userId>/images/schema/schema.json` + 图片文件相对路径，与 Node 版备份结构一致（对照设计文档"备份 ZIP 相同内部结构"）。

- [x] **Step 5: 记录并 Commit**

`verification.md` 追加：

```markdown
## T6.2 数据兼容性（Task 6，日期：____）

- 存量数据启动：用户列表/图片数量/缩略图显示与 Node 版一致
- schema.json version 字段保留；无 .tmp 残留
- 备份 ZIP 内部结构与 Node 版一致
```

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md
git commit -m "test: 数据兼容性验证记录 (T6.2)"
```

---

### Task 7: T6.3 性能测试（50 张并发上传）

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`（追加结果）

**Interfaces:**
- Consumes: Task 5 的冒烟结论
- Produces: 性能数据表（与 Node 版对比；无基线则记录绝对值并注明）

- [x] **Step 1: 准备测试素材**

准备 50 张测试图片放入独立目录 `C:\Users\lemon\AppData\Local\Temp\opencode\picmap-perf\`：48 张 JPG（2-5MB，含 GPS）+ 2 张 HEIC/RAW（若可获取）。检查 Node 版基线数据是否存在于 `docs/openspec/changes/go-wails-migration/` 或旧记录中；没有则记录"无基线"。

- [x] **Step 2: 计时上传**

在应用中选择全部 50 张并确认上传，用秒表或 PowerShell 记录耗时：
```powershell
# 在应用内操作的同时观察；上传完成后记录：
# - 总耗时（秒）
# - 上传过程中 UI 是否卡顿（可交互性）
# - 进度条是否按批推进（信号量 4 并发生效的间接证据）
```
Expected: 50 张全部成功；无 UI 冻结；进度按批推进。

- [x] **Step 3: 内存观察**

打开任务管理器 → 详细信息 → 观察 `picmap-dev.exe`（dev 模式）内存：
- 上传前基线、上传中峰值、上传后回落值均记录；
- 对比 Node 版（Electron 主进程+渲染进程）对应值（如有基线）。
Expected: 内存与图片总体积解耦（设计决策"前端内存与图片体积解耦"），峰值不过分高于基线+50 张预览图大小。

- [x] **Step 4: 记录数据表**

`verification.md` 追加：

```markdown
## T6.3 性能对比（Task 7，日期：____）

| 指标 | Node.js 版 | Wails 版 | 结论 |
|---|---|---|---|
| 50 张上传耗时 | （基线/无） | ____s |  |
| UI 卡顿 |  |  |  |
| 上传前内存 |  | ____MB |  |
| 上传中峰值 |  | ____MB |  |
| 上传后回落 |  | ____MB |  |
```

- [x] **Step 5: Commit**

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md
git commit -m "test: 50 张并发上传性能对比记录 (T6.3)"
```

---

### Task 8: P3.4-P3.6 路径上传手工验证（受 Task 1 决策门控制）

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`（追加结果）
- Modify: `docs/openspec/changes/go-wails-migration/tasks.md`（若 BLOCKED）

**Interfaces:**
- Consumes: Task 1 决策门结论
- Produces: P3.4-P3.6 验证结论或 BLOCKED 记录

- [x] **Step 0: 前置检查（决策门）**

Run:
```powershell
Select-String -Path app.go -Pattern 'SelectImages|ImportImages'
Select-String -Path frontend/src/wails/api.ts -Pattern 'selectImages|importImages'
```
- 若两者均有匹配（路径上传已落地）→ 继续 Step 1；
- 否则执行 BLOCKED 处置：
  1. 在 `verification.md` 追加：

```markdown
## P3.4-P3.6 路径上传手工验证（Task 8，日期：____）

**BLOCKED**：路径上传（P1.1-P1.4 / P2.1-P2.4）未在 base-ref 落地（app.go 与 wails/api.ts 均无 SelectImages/ImportImages）。本任务无法执行，需先实施 P1.x/P2.x（不在本计划范围）。不伪造通过结果。
```

  2. 确认 `tasks.md` 中 P1.x/P2.x/P3.x 均已取消勾选（Task 1 已修正）；
  3. Commit 记录后本任务结束，跳过 Step 1-4。

- [x] **Step 1: P3.4 单张 50MB HEIC 内存验证**

操作：选择一张约 50MB 的 HEIC 图片上传。
观察：DevTools → Performance monitor 的 JS heap；任务管理器中进程内存。
Expected: 前端内存不随图片体积暴涨（前端仅接收约 100-200KB 预览图）；UI 无卡顿；上传完成后图库/地图显示缩略图。

- [x] **Step 2: P3.5 批量 GPS 图片验证**

操作：选择 10 张含 GPS 的图片（混合 JPG/HEIC）批量上传。
Expected: 进度条按 4 张一批推进；地图出现 10 个标记，与高德瓦片对照 GCJ02 偏移正确；上传后 schema.json 中 10 条记录落库；缩略图全部可显示。

- [x] **Step 3: P3.6 确认前删除文件容错验证**

操作：通过后端对话框选择 3 个文件；在点击上传确认前，用资源管理器删除其中 1 个源文件；然后确认上传。
Expected: 被删文件返回明确错误（消息含"不存在/无法访问"类提示）；schema 不写入该图脏数据；同批其余 2 张正常上传、正常显示。

- [x] **Step 4: 记录并 Commit**

`verification.md` 追加三项结果；全部通过后同步勾选 `tasks.md` 的 P3.4-P3.6：

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md docs/openspec/changes/go-wails-migration/tasks.md
git commit -m "test: 路径上传手工验证 P3.4-P3.6"
```

---

### Task 9: T6.4 生产打包

**Files:**
- 构建产物：`build/bin/picmap.exe`（仓库此前已提交 `picmap-dev.exe`，沿用提交惯例）

**Interfaces:**
- Consumes: Task 4 的 dist 产物、Task 5 的冒烟结论
- Produces: 可独立运行的生产 exe（Task 10 度量对象）

- [x] **Step 1: 执行打包**

Run（仓库根目录）:
```powershell
$env:GOPROXY = "https://goproxy.cn,direct"
wails build -platform windows/amd64
```
Expected: 构建成功，`build/bin/picmap.exe` 重新生成（构建时间戳更新）。注意：main.go 通过 `go:embed all:frontend/dist` 嵌入前端，若 dist 过期先执行 Task 4 Step 2 再打包。

- [x] **Step 2: 独立启动验证（脱离 dev 环境）**

关闭所有 dev 进程后：
```powershell
Start-Process "build\bin\picmap.exe"
```
Expected: 窗口正常打开，无控制台错误；冒烟 3 项：地图渲染、上传 1 张图、查看缩略图。

- [x] **Step 3: 验证 tools/ 随 exe 部署（HEIC/RAW 兜底）**

`convert.go` 的 `getToolsDir()` 从 exe 所在目录解析 `tools/`。验证：
```powershell
Test-Path "build\bin\tools"
```
若不存在，将仓库 `tools\`（imagemagick、libraw）复制到 `build\bin\tools\`，然后重启 exe 上传一张 HEIC/RAW，Expected: 缩略图转换成功（magick/dcraw_emu 可执行）。
将部署要求记入 verification.md（打包产物需附带 tools/ 目录）。

- [x] **Step 4: 记录并 Commit**

`verification.md` 追加打包结果与 tools/ 部署说明：

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md build/bin/picmap.exe
git commit -m "build: windows/amd64 生产打包 (T6.4)"
```
（若 tools/ 复制到 build/bin/ 后需要入库，一并 add；若按惯例不入库，在 verification.md 注明部署步骤。）

---

### Task 10: T6.5 安装包体积与启动速度验证

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`（追加结果）

**Interfaces:**
- Consumes: Task 9 的 exe 产物
- Produces: 体积/启动指标（T6.6 前的发布门槛判定）

- [x] **Step 1: 测量体积**

Run:
```powershell
$exe = Get-Item "build\bin\picmap.exe"
"{0:N1} MB" -f ($exe.Length / 1MB)
```
Expected: < 25MB（规划时快照：暂存区旧版 15.9MB，达标）。

- [x] **Step 2: 测量冷启动速度**

关闭全部实例后计时（秒表或计时脚本）：从双击 exe 到地图窗口可交互。
Expected: 记录实测值；参考目标 ≤ 5s（设计文档未给硬性数值，以实测记录为准，明显卡顿（>10s）视为不达标需排查）。

- [x] **Step 3: 记录空闲内存**

任务管理器记录 exe 空闲内存占用，与 dev 模式对比。

- [x] **Step 4: 记录并 Commit**

`verification.md` 追加：

```markdown
## T6.5 体积与启动速度（Task 10，日期：____）

- picmap.exe 体积：____MB（目标 < 25MB，达标/不达标）
- 冷启动耗时：____s（参考目标 ≤ 5s）
- 空闲内存：____MB
```

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md
git commit -m "test: 安装包体积与启动速度验证 (T6.5)"
```

---

### Task 11: T6.6 全功能回归测试

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`（追加结果）
- Modify: `docs/openspec/changes/go-wails-migration/tasks.md`（勾选 T6.6）

**Interfaces:**
- Consumes: Task 9 打包产物（建议对打包版回归，兼顾 dev 已覆盖项）
- Produces: 回归结论（发布前最终门禁）

- [x] **Step 1: 执行回归清单**

对打包版（或 dev 版）逐项执行，结果（Pass/Fail/备注）记入 verification.md：

| # | 功能 | 操作 | 期望 |
|---|---|---|---|
| 1 | 地图渲染 | 启动即见瓦片 | Leaflet 正常，无空白瓦片区域 |
| 2 | 标记聚合 | 缩小地图 | 附近标记聚合为数字标记 |
| 3 | 瓦片源切换 | 高德/OSM/自定义 | 各源渲染正常 |
| 4 | 图片上传 | 批量 10 张 | 全部成功，进度可见 |
| 5 | 图片删除 | 单张/批量 | 文件与标记同步消失 |
| 6 | 下载原图 | 图片详情 → 下载 | 原图完整 |
| 7 | 手动定位 | 无 GPS 图片定位 | 标记落位，schema 保存 |
| 8 | 分组 CRUD | 创建/改名/删除 | 正常 |
| 9 | 分组批量操作 | 批量加入/移除 | 分组标记拼贴更新 |
| 10 | 分组可见性 | 显示/隐藏 | 地图标记同步 |
| 11 | 时间轴 | 拖动滑块 | 图片标记按时间过滤 |
| 12 | GPX 上传 | 上传 .gpx | 轨迹线/统计正确 |
| 13 | GPX 配色 | 改轨迹颜色 | 线条颜色更新 |
| 14 | 备份创建 | 创建 ZIP | 生成且列表可见 |
| 15 | 备份 cover 导入 | 替换数据 | 数据与备份一致 |
| 16 | 备份 merge 导入 | 合并数据 | 去重合并正确 |
| 17 | 多用户 | 创建/切换/删除 | 数据隔离 |
| 18 | 语言设置 | 中/英切换 | 文案切换 |
| 19 | 右键菜单 | 标记右键 | 删除/分组入口可用 |
| 20 | 重启恢复 | 移动地图后重启 | 位置恢复（设置记忆） |

- [x] **Step 2: 处理失败项**

任何 Fail：在 verification.md 记录复现步骤；判定是否阻塞（数据丢失类必阻塞，进入修复循环——修复后再跑该行直至 Pass）。全部 Pass 方可勾选 T6.6。

- [x] **Step 3: 勾选 tasks.md 并 Commit**

将 `tasks.md` 的 T6.6 勾选（回归全部 Pass 时）：

```powershell
git add docs/openspec/changes/go-wails-migration/verification.md docs/openspec/changes/go-wails-migration/tasks.md
git commit -m "test: 全功能回归通过，勾选 T6.6"
```

---

### Task 12: 收尾——任务清单与验证记录同步

**Files:**
- Modify: `docs/openspec/changes/go-wails-migration/tasks.md`
- Modify: `docs/openspec/changes/go-wails-migration/verification.md`

**Interfaces:**
- Consumes: Task 1-11 全部结论
- Produces: 与实际状态一致的 tasks.md 与完整验证记录（归档/Comet verify 阶段输入）

- [x] **Step 1: 终态同步 tasks.md**

逐条核对 tasks.md：
- 已勾选且验证通过：保持勾选；
- 已勾选但实际未落地（审计发现项）：取消勾选并注明原因；
- 未勾选且本计划完成：勾选（T5.4、T5.5、T5.6、T6.1-T6.6）；
- 未勾选且 BLOCKED（P3.4-P3.6，若路径上传未落地）：保持未勾选，行尾注明 `<!-- BLOCKED: P1.x/P2.x 未落地 -->`。

- [x] **Step 2: verification.md 汇总**

在文件末尾追加：

```markdown
## 总结论（Task 12，日期：____）

- 变更整体状态：可发布 / 有条件发布（列出阻塞项）
- 遗留事项：____（如：路径上传 P1.x/P2.x 未落地；exif-js/exifreader/heic2any 依赖待路径上传落地后移除）
```

- [x] **Step 3: Commit**

```powershell
git add docs/openspec/changes/go-wails-migration/tasks.md docs/openspec/changes/go-wails-migration/verification.md
git commit -m "docs: 同步任务清单与实际验证状态，输出收尾结论"
```
