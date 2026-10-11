# Tasks: GPX 轨迹与轨迹视频统一关联上传

## 1. 验证 spike（前置 gate）

- [ ] **1.1** 下载并放入 `tools/ffmpeg/ffmpeg.exe` + `ffprobe.exe`，验证 getToolsDir 可找到
- [ ] **1.2** 用 ffprobe 解析测试视频的时长、尺寸，验证可获取相对帧时间轴（PTS）
- [ ] **1.3** 验证文件名→时间解析（如 `20260820_171710` → `2026-08-20 17:17:10`），识别非时间文件名
- [ ] **1.4** 验证 GPX 逐点解析（提取 [绝对时间, lat, lng] 序列），供后续时间→坐标映射
- [ ] **1.5** 决策点：ffprobe 时长/帧时间解析可用才继续

## 2. 数据模型

- [ ] **2.1** `model/schema.go` 新增 `VideoInfo`（id/name/path/durationMs/trackId/startTimeMs/viewType/size/lastModified）、`VideoRef`（videoId/timeOffsetMs）；`Schema` 增加 `VideoInfo []VideoInfo`（omitempty）
- [ ] **2.2** `model/schema.go` 的 `TrackInfo` 扩展挂视频列表 `Videos []VideoRef`（omitempty）
- [ ] **2.3** `config/config.go` 新增 `VideoDirPath`（`videos/` 目录）
- [ ] **2.4** `service/video.go` 新增 `ProbeVideo`（ffprobe 时长/尺寸）
- [ ] **2.5** `service/video.go` 新增 `ParseStartTimeFromName`（文件名时间解析）
- [ ] **2.6** `service/video.go` 或 track 服务新增 GPX 逐点解析（[绝对时间, lat, lng]）

## 3. 统一入口 + 关联上传

- [ ] **3.1** 扩展 `components/trackUpload/`：原「轨迹上传」入口改为「轨迹/轨迹视频上传」
- [ ] **3.2** 支持上传 GPX、内嵌 GPS 视频（可独立）、普通视频（必须先选 GPX）
- [ ] **3.3** `wails/api.ts` 新增 `video` 模块（解析/导入/关联）
- [ ] **3.4** `type/video.ts` 新增类型
- [ ] **3.5** 普通视频关联 GPX 的 UI：选 GPX → 上传视频 → 显示起点时间解析结果
- [ ] **3.6** `handler/handler.go` 新增 `SelectVideos`（过滤器 + 批量解析事件推送）

## 4. 时间对齐 + 节点生成

- [ ] **4.1** 起点时刻自动解析（metadata creationdate → 文件名），失败转手动输入/拾取
- [ ] **4.2** 视频帧绝对时刻 = 起点 + 相对时间（线性，无变速）
- [ ] **4.3** 帧绝对时刻 → GPX 逐点线性插值 → 坐标
- [ ] **4.4** 按视频时间生成节点，存 `viewType=image`
- [ ] **4.5** 短视频（GPX 距离 < 50m）保证至少 1 个节点（视频起点处）；长视频按距离采样多节点
- [ ] **4.6** 视频节点接入地图（复用 marker 系统），点击展示普通图片查看器
- [ ] **4.7** `handler/handler.go` 新增 `ImportVideo`、`DeleteVideos`、节点/关联相关绑定

## 5. 视频播放（范围读取 + MediaSource）

- [ ] **5.1** 后端 `handler` 新增 `GetVideoRange(videoId, start, end)`（按字节范围流式返回 base64）
- [ ] **5.2** 前端 `wails/api.ts` 新增 `getVideoRange`，封装分段请求
- [ ] **5.3** `components/videoPlayer/VideoPlayer.vue`：MediaSource 流式拼接 `<video>`，支持播放/暂停/seek
- [ ] **5.4** 节点详情「播放」按钮：默认显示帧图，点击进入播放模式
- [ ] **5.5** 验证 10GB 视频 seek 正常、内存稳定

## 6. 大文件专项 + 回归

- [ ] **6.1** 视频导入降并发（串行或 1-2）
- [ ] **6.2** 导入进度事件推送（复制进度，10GB 不卡死）
- [ ] **6.3** 磁盘空间预检提示
- [ ] **6.4** 备份流程排除视频目录（`createZip`/`calcDataSize`）
- [ ] **6.5** 全功能回归（轨迹上传、图片上传、分组、时间轴、备份、多用户）
- [ ] **6.6** 验证 10GB 视频导入不卡死、有进度、内存稳定
