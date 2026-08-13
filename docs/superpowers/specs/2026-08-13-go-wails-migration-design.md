# Design: PicMap Go + Wails 迁移（含图片路径上传）

> 变更：go-wails-migration
> 关联：docs/openspec/changes/go-wails-migration/design.md、design-path-upload.md

## 架构对比

```
【当前 Electron】
Electron Main → fork(Express :5120) + BrowserWindow(Vue)
                    ↑ axios localhost:5120

【迁移后 Wails】
Wails Runtime(Go) → WebView2(Vue)
                      ↑ @wailsapp/runtime 绑定调用
```

## Go 项目结构

```
picmap-go/
├── main.go / app.go / wails.json
├── frontend/src/        # 现有 Vue 前端（保留）
│   └── wails/api.ts     # 新增：替换 axios 调用
├── internal/
│   ├── config/          # 路径解析、初始化
│   ├── model/           # 数据模型 (schema.go, app_schema.go, result.go)
│   ├── handler/         # Wails 绑定方法 (22个API)
│   ├── service/         # 业务逻辑 (image, thumbnail, exif, preview, convert)
│   └── util/            # 工具 (coordinate, fileutil)
└── tools/               # 外部工具（复制自 Node.js 版）
    ├── imagemagick/magick.exe
    └── libraw/dcraw_emu.exe
```

## 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 返回格式 | Go idiomatic + 前端适配层 | Go 简洁 + 前端 Result 格式兼容 |
| 图片传输 | 本地文件路径（不再 base64） | 避免跨进程大载荷，前端内存与图片体积解耦 |
| Schema 格式 | Go struct 直接返回 | Wails 自动序列化，减少开销 |
| 图片处理 | 零 CGo + 外部工具 | 纯 Go EXIF/标准格式，exec 调 HEIC/RAW |
| 并发上传 | 信号量池 max=4 | 避免 I/O 竞争 |
| Schema 写入 | tmp + Rename 原子 | 防崩溃损坏 |
| 备份 ZIP | 标准库 archive/zip | 零外部依赖 |

## 图片路径上传设计（替代 base64）

### D1. 文件路径获取：后端原生对话框绑定

新增 Go 绑定 `SelectImages()`，内部调用 Wails runtime 的 `OpenMultipleFilesDialog`，返回用户所选文件的绝对路径 `[]string`。选图后逐文件解析 EXIF（GPS/相机/作者信息）并生成 800px JPEG 预览图（base64 小图，约 100-200KB/张），随路径一起返回。

### D2. 上传载体：路径数组替代 base64

新增 `ImportImages(userId, files []ImportFile)`，Go 端对每个路径做 `os.Stat` 校验存在性，`os.Open` + `io.Copy` 写入 `images/{id}.{ext}`，信号量 4 并发限流。HEIC/RAW 同时生成 `_THUMBNAIL_PM_` 缩略图文件。

### D3. ID 与扩展名

沿用"文件名即 ID"策略（`id = filepath.Base(path)`），从原路径取扩展名；无扩展名回退 `.jpg`。ID 经 `filepath.Base` 清理，防止路径穿越。

### D4. EXIF 与预览下沉 Go 端

EXIF 解析（`rwcarlsen/goexif`）与预览图生成全部下沉 Go 端：
- GPS 坐标在 Go 端完成 WGS84→GCJ02 转换
- 标准格式用 `imaging` 缩略 800px；HEIC/RAW 经 magick/dcraw_emu 转 JPEG 再缩略
- 前端仅接收小尺寸预览 base64，不再持有整图二进制

### D5. 前端职责

- `imgUpload/Index.vue`：移除 el-upload、`readFileAsDataURL`、exifreader、canvas 缩略图逻辑
- `utils/Image.ts` 的 `uploadImages`：以路径数组驱动，4 张一批调用 `importImages`
- 上传成功后以 Go 返回的预览图更新图片缓存

## 图片处理管道

1. EXIF/GPS → 纯 Go `rwcarlsen/goexif`
2. 标准格式缩略图 → 纯 Go `disintegration/imaging`
3. HEIC → `exec.Command("magick", ...)`
4. RAW → `exec.Command("dcraw_emu", ...)` 三层降级
5. GPX → 纯 Go（前端解析，schema 存统计）

零 CGo 依赖，全平台交叉编译无忧。

## 前端改动

- 新增 `src/wails/api.ts` 封装 Go 绑定
- 修改 14 个文件的导入路径（`http/modules/*` → `wails/api`）
- 删除 `http/` 目录（axios）、移除 axios/express/body-parser 依赖
- 上传组件改为"原生对话框选图 + 路径导入"

## 数据兼容性

- appSchema.json: 相同 JSON 结构
- schema.json: 字段名为 `version`（历史文档曾误记为 `verison`）
- 图片/GPX 文件: 相同命名规则
- 备份 ZIP: 相同内部结构
- 目录结构: 完全不变

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| HEIC/RAW 转码在 Go 生态不如 Node.js 成熟 | 保留外部工具 (dcraw/ImageMagick) 作为兜底 |
| 文件在确认上传前被外部移动/删除 | 上传时逐路径 `os.Stat` 校验，缺失返回明确错误 |
| 路径穿越 / ID 注入 | ID 做 `filepath.Base` 清理 |
| Wails 与 Leaflet 地图组件兼容性 | 提前在 Wails 环境中验证 Leaflet 渲染 |
| 数据迁移兼容性 | 保持 JSON 结构和文件命名完全一致，提供回滚方案 |
| Go 并发文件操作安全性 | 使用 mutex 保护 schema 写入，原子写入策略 |
