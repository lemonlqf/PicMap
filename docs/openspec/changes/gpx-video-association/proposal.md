# Proposal: GPX 轨迹与轨迹视频统一关联上传

## Why

现有 PicMap 提供独立的「轨迹上传」入口，仅支持上传 GPX 轨迹文件。用户希望把「轨迹」与「轨迹视频」统一管理：在上传入口里既能上传 GPX 轨迹，也能上传与轨迹关联的视频（骑行/徒步等轨迹视频）。

核心诉求：
- 统一「轨迹/轨迹视频」上传入口，替代现有单独 GPX 入口
- 支持上传 GPX 轨迹、内嵌 GPS 的轨迹视频、关联 GPX 的普通视频
- **普通视频（无 GPS）不能单独上传**，必须先选中一个已有 GPX 轨迹并关联
- 一个 GPX 轨迹允许关联多个普通视频
- 普通视频关联时需**自动解析或手动指定**其在 GPX 上的初始时间戳
- 视频在轨迹上生成节点，坐标来自 GPX（或内嵌 GPS）时间对应位置；节点展示方式可区分（本次仅普通图片查看器，360 全景查看器后续）

## What Changes

- **统一上传入口**：原「轨迹上传」入口扩展为「轨迹/轨迹视频上传」，支持 GPX、内嵌 GPS 视频、关联 GPX 的普通视频
- **新增「视频」数据模型**：`VideoInfo` 存入 schema（id、name、path、时长、关联的 GPX、初始时间戳、节点展示类型等），视频原文件保存到 `videos/PM<id>.<ext>` 目录
- **GPX 轨迹挂载视频**：`TrackInfo` 扩展挂视频列表（`videoId + timeOffsetMS`），一个 GPX 挂多个视频
- **普通视频关联流程**：选中已有 GPX → 上传普通视频（一对一关联，一个 GPX 可被多个视频关联）→ 自动解析起点时刻（文件名 → creationdate）→ 失败则手动指定 → 按 GPX 线性时间轴生成视频节点
- **视频节点生成**：按视频相对时间映射到 GPX 绝对时刻 → 坐标，生成节点；短视频（GPX 距离 < 50m）保证至少一个节点（视频起点处）作为入口；长视频以距离为主采样生成多个节点；节点存 `viewType`（本次仅 `image`，`panorama` 后续）
- **视频节点展示**：点击节点默认显示帧图，另提供「播放」按钮，用 `<video>` 播放器播放视频（后端范围读取 + 前端 MediaSource 流式拼接，支持大文件 seek）
- **内嵌 GPS 视频**：可独立上传（自身即轨迹），也可再关联 GPX 校准（后续阶段）
- **大文件专项**：视频导入降并发 + 进度事件、视频范围读取（流式播放）、备份排除视频目录、磁盘空间预检

## Capabilities

### New Capabilities

- `gpx-video-association`: GPX 轨迹与轨迹视频统一关联上传能力（统一入口、GPX 挂多视频、普通视频关联 GPX 与时间对齐、视频节点生成、节点帧图展示与视频播放）

### Modified Capabilities

- `picmap-api`: 扩展轨迹上传绑定，新增视频解析/导入/节点相关绑定
- `map-rendering`: 复用现有 marker 系统承载视频节点（不改变图片渲染，仅新增一种节点类型）

## Impact

- **后端**：`internal/model/schema.go`（VideoInfo、TrackInfo 挂视频）、`internal/service/video.go`（新增，ffprobe/时间解析）、`internal/handler/handler.go`（统一上传入口 + 关联 + 导入 + 范围读取）、`internal/config/config.go`（视频目录）、`app.go`（绑定注册）
- **前端**：`wails/api.ts`（video 模块）、`type/video.ts`（新增）、`components/trackUpload/`（扩展统一入口）、`services/`（视频节点 + MediaSource 播放）、`components/videoPlayer/`（新增，播放器）、`components/map/Map.vue`（接入视频节点图层）
- **依赖**：Go 无新增库（走 exec ffmpeg）；工具打包 ffmpeg/ffprobe（~80MB+，已确认接受）
- **备份**：视频目录 `videos/` 默认排除出备份流程
- **性能风险**：超大视频（10GB+）导入与存储；备份策略需区分视频
