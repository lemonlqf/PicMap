# Design: 图片路径上传（替代 base64 载体）

## 背景

当前图片上传链路中，前端用 `readFileAsDataURL` 将整张图片读成 base64 字符串常驻内存，确认上传后再通过 Wails 绑定把整图 base64 跨进程传给后端解码落盘。一张 50MB 图片会导致前端 base64 字符串 + 跨进程序列化副本 + Go 端解码 bytes 三份内存同时存在（峰值可超 150MB），批量上传时内存暴涨、界面卡顿甚至崩溃。

## 决策

### D1. 文件路径获取：后端原生对话框绑定

新增 Go 绑定 `SelectImages()`，内部调用 Wails runtime 的 `OpenMultipleFilesDialog`，返回用户所选文件的绝对路径 `[]string`。选图后逐文件解析 EXIF（GPS/相机/作者信息）并生成 800px JPEG 预览图（base64 小图），随路径一起返回。

- 为什么：Wails 官方支持的稳定路径获取方式；WebView2 下 `File.path` 默认不可用。

### D2. 上传载体：路径数组替代 base64

新增 `ImportImages(userId, files []ImportFile)`，Go 端对每个路径做 `os.Stat` 校验存在性，`os.Open` + `io.Copy` 写入 `images/{id}.{ext}`，信号量 4 并发限流。HEIC/RAW 同时生成 `_THUMBNAIL_PM_` 缩略图文件。

### D3. ID 与扩展名

沿用"文件名即 ID"策略（`id = filepath.Base(path)`），从原路径取扩展名；无扩展名回退 `.jpg`。ID 经 `filepath.Base` 清理，防止路径穿越。

### D4. EXIF 与预览下沉 Go 端

EXIF 解析（`rwcarlsen/goexif`）与预览图生成全部下沉 Go 端：
- GPS 坐标在 Go 端完成 WGS84→GCJ02 转换
- 标准格式用 `imaging` 缩略 800px；HEIC/RAW 经 magick/dcraw_emu 转 JPEG 再缩略
- 前端仅接收小尺寸预览 base64（约 100-200KB/张），不再持有整图二进制

> 实现说明：相较原设计 D4/D5（前端保留隐藏 input 读文件头），最终采用更彻底的下沉方案——EXIF 与预览全部由 Go 完成，前端不再需要 `File` 对象。

### D5. 前端职责

- `imgUpload/Index.vue`：移除 el-upload、`readFileAsDataURL`、exifreader、canvas 缩略图逻辑
- `utils/Image.ts` 的 `uploadImages`：以路径数组驱动，4 张一批调用 `importImages`
- 上传成功后以 Go 返回的预览图更新图片缓存

### D6. 分批解析与事件推送（体验优化）

`SelectImages` 改为「秒回路径 + 后台分批解析 + 事件推送」：

- Go 端：弹框选文件后立即返回 `{ filePaths, total }`；后台 goroutine 每批 4 张解析（`processSelectedImage` 复用），批完成即 `runtime.EventsEmit` 推送
- 事件契约：`images-parsed`（批结果 + 错误）、`images-progress`（processed/total）、`images-done`（全部完成）
- 防重入：`Handler.parsing atomic.Bool`，解析中拒绝二次选择
- 时序兜底：前端监听在 `onMounted` 注册一次（先注册后触发）；Go 端首批前 `time.Sleep(50ms)` 双保险
- 性能：前端每批 `push(...batch)` 一次性写入（减少响应式更新）、marker 渲染 `nextTick` 延迟、进度条 `v-show` 防 DOM 反复创建
- 清理：`onUnmounted` 中 `EventsOff` 移除全部监听，防重复注册与内存泄漏

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 文件在确认上传前被外部移动/删除 | 上传时逐路径 `os.Stat` 校验，缺失返回明确错误，不写脏数据 |
| 路径穿越 / ID 注入 | ID 做 `filepath.Base` 清理 |
| HEIC/RAW 预览转换失败 | 预览为空串不阻塞选择流程；缩略图生成失败仅记录错误不影响原图落盘 |
| Wails 对话框多选能力 | v2.14 提供 `OpenMultipleFilesDialog`，已验证 |
