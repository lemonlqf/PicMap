# Design: PicMap Go + Wails 迁移

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
│   ├── service/         # 业务逻辑 (image, thumbnail, exif, schema, backup, file)
│   └── util/            # 工具 (coordinate, fileutil)
└── tools/               # 外部工具（复制自 Node.js 版）
    ├── imagemagick/magick.exe
    └── libraw/dcraw_emu.exe
```

## 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 返回格式 | Go idiomatic + 前端适配层 | Go 简洁 + 前端 Result 格式兼容 |
| 图片传输 | 保持 base64 | 前端改动最小 |
| Schema 格式 | Go struct 直接返回 | Wails 自动序列化，减少开销 |
| 图片处理 | 零 CGo + 外部工具 | 纯 Go EXIF/标准格式，exec 调 HEIC/RAW |
| 并发上传 | 信号量池 max=4 | 避免 I/O 竞争 |
| Schema 写入 | tmp + Rename 原子 | 防崩溃损坏 |
| 备份 ZIP | 标准库 archive/zip | 零外部依赖 |

## API 映射（22个端点）

全部 Express API → Go Wails 绑定方法，详见 tasks.md。

## 图片处理管道

1. EXIF/GPS → 纯 Go `dsoprea/go-exif`
2. 标准格式缩略图 → 纯 Go `disintegration/imaging`
3. HEIC → `exec.Command("magick", ...)`
4. RAW → `exec.Command("dcraw_emu", ...)` 三层降级
5. GPX → 纯 Go `twpayne/go-gpx`

零 CGo 依赖，全平台交叉编译无忧。

## 前端改动

- 新增 `src/wails/api.ts` 封装 Go 绑定
- 修改 11 个文件的导入路径（`http/modules/*` → `wails/api`）
- 删除 `http/axios.ts`, `http/index.ts`, `http/modules/*`
- 移除 axios 依赖

## 数据兼容性

- appSchema.json: 相同 JSON 结构
- schema.json: 字段名为 `version`（历史文档曾误记为 `verison`）
- 图片/GPX 文件: 相同命名规则
- 备份 ZIP: 相同内部结构
- 目录结构: 完全不变
