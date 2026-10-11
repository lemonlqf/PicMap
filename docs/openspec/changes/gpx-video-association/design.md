# Design: GPX 轨迹与轨迹视频统一关联上传

## Context

PicMap 现有独立的「轨迹上传」入口，仅支持 GPX 文件。用户希望统一为「轨迹/轨迹视频上传」：GPX 轨迹、内嵌 GPS 的轨迹视频、关联 GPX 的普通视频都在同一入口管理。普通视频（无 GPS）必须关联一条已有 GPX，通过手动对齐初始时间戳建立帧↔坐标对应。一个 GPX 可挂多个视频。

关键事实（已用真实视频文件验证）：
- 所有 mp4/mov 都有**相对帧时间戳**（PTS，从视频开头计），用于定位任意帧
- **绝对时间戳**（几点几分）不一定有：iPhone/GoPro/Insta360 有标准 `creationdate`，但 Android 相机（如三星）通常只有私有 key，无标准日期时间
- 普通视频内嵌 GPS 通常仅一个点，**不是**逐帧轨迹（仅 360 相机有内嵌逐帧 GPS 数据流）
- 视频可能 **10GB / 10 小时**，内存与磁盘压力大

## Goals / Non-Goals

**Goals:**
- 统一「轨迹/轨迹视频」上传入口，替代现有单独 GPX 入口
- 支持上传：GPX、内嵌 GPS 视频、关联 GPX 的普通视频
- 普通视频不能单独上传，必须关联已有 GPX（一对一）
- 一个 GPX 挂多个视频
- 普通视频关联时自动解析起点时刻（文件名 → creationdate），失败则手动指定
- 视频在轨迹上生成节点，坐标来自 GPX 时间对应位置；短视频（GPX 距离 < 50m）保证至少 1 个节点
- 点击视频节点默认显示帧图，提供「播放」按钮，`<video>` 流式播放整段视频（范围读取 + MediaSource，支持 seek）
- 支持 10GB+/10h+ 超大视频（内存安全、有进度反馈、磁盘预检、流式播放不整载）
- 视频默认不纳入备份

**Non-Goals（本次）:**
- 不做 360° 全景渲染器（节点 `viewType` 仅 `image`，`panorama` 后续阶段）
- 不做视频内嵌 GPS 数据流的逐帧解析（后续阶段；普通视频不依赖它）
- 不做视频转码压缩入库（仅原样复制）
- 不改变现有图片上传/分组/轨迹统计的既有行为

## Decisions

### D1. 外部工具：打包 ffmpeg/ffprobe，`os/exec` 调用

- 复用 `getToolsDir()` 模式（convert.go:11），ffprobe 读时长/尺寸、ffmpeg 后续抽帧
- 不新增 Go 解码库（避免 10GB 视频读进内存）
- 用户已确认接受 ~80MB+ 体积

### D2. 普通视频时间对齐：自动解析起点 + 手动兜底

- **自动解析起点**优先级：
  1. 视频 metadata 标准 `creationdate`（iPhone/GoPro/Insta360）
  2. 文件名时间（如 `20260820_171710` → `2026-08-20 17:17:10`）
- **手动兜底**：自动解析失败 → 用户手动输入/拾取视频起点绝对时刻
- 一旦起点绝对时刻确定，帧绝对时刻 = 起点 + 帧相对时间（视频时间轴线性，无变速）
- GPX 对齐：帧绝对时刻 → 在 GPX 逐点轨迹上线性插值得到坐标
- **关键**：需在 Go 侧新增 GPX **逐点**解析（现有 TrackInfo 仅存统计值，无逐点序列）

### D3. 视频节点生成

- 视频按其时间轴（相对时间 → 绝对时刻 → GPX 坐标）生成节点
- **至少一个节点**：短视频（对应 GPX 距离 < 50m）保证至少 1 个节点（视频起点处），作为视频入口
- **长视频以距离为主**：距离足够时按 50m 采样生成多个节点，短视频自动降为 1 个
- **区分两类点**：GPX 距离采样（50m）管「轨迹线」显示密度；「视频节点」独立按视频生成，不因距离不足而消失
- 节点存 `viewType`：`"image"`（普通图片查看器，复用现有 el-image）/ `"panorama"`（360 全景，后续）
- 本次仅 `image`；`panorama` 预留字段，不影响数据模型

### D4. 视频节点展示与播放

- 点击视频节点：默认显示**帧图**（该节点时间点的画面）
- 提供独立「播放」按钮：进入 `<video>` 播放模式播放整段视频
- **范围读取 + MediaSource 流式**：后端 `GetVideoRange(videoId, start, end)` 按字节范围流式返回 base64；前端用 `MediaSource` 分段 append 到 `<video>`；支持 seek（拖动进度 → 后端从对应偏移继续读取）
- 否决 `file://` 直接播放（WebView2/Chromium 安全限制拦截本地 file 协议）；否决整文件 base64（10GB 内存爆）
- 10GB 视频零内存压力，seek 实时

### D5. 数据关系与 schema 结构

#### 视频文件保存位置（磁盘）

```
D:\PicMap\
├── appSchema.json
├── [用户ID]\
│   ├── images\          # 图片（现有）
│   ├── tracks\          # GPX 轨迹（现有）
│   └── videos\          # 视频原文件（新增）
│       └── PM<videoId>.<ext>     # 例：PM3f8a...mp4
```

- 视频原文件统一存 `videos/` 目录，文件名沿用图片的 `PM<id>.<ext>` 前缀约定
- 视频目录与图片/轨迹并列，路径由 `config.VideoDirPath(userId)` 提供
- 抽帧缓存（后续）放 `video_cache/`，与图片缩略图逻辑对齐

#### `Schema` 扩展

```jsonc
{
  "version": "1.0.0",
  "mapInfo": { ... },
  "groupInfo": [ ... ],
  "imageInfo": [ ... ],
  "trackInfo": [ ... ],
  "videoInfo": [           // 新增：全部视频（含内嵌 GPS 独立视频）
    {
      "id": "3f8a2b...",            // 唯一 ID（UUID/hex）
      "name": "20260820_171710.mp4",// 原始文件名
      "path": "PM3f8a...mp4",       // videos/ 下的文件名（不含目录）
      "durationMs": 4430,           // 视频时长（毫秒）
      "trackId": "7c1d...",         // 关联的 GPX 轨迹 ID（普通视频必填；内嵌 GPS 独立视频可为空）
      "startTimeMs": 1724145430000, // 视频起点绝对时刻（epoch 毫秒），用于 GPX 时间对齐
      "viewType": "image",          // "image" | "panorama"（本次仅 image）
      "size": 7460749,              // 文件大小（字节）
      "lastModified": 1724145430000 // 修改时间（epoch 毫秒）
    }
  ]
}
```

#### `TrackInfo`（GPX）扩展挂视频

`trackInfo` 数组中的每条 GPX 增加 `videos` 字段，存该 GPX 关联的所有视频引用：

```jsonc
{
  "id": "7c1d...",
  "name": "骑行轨迹.gpx",
  "distance": 25400.5,
  "startTime": "2026-08-20 17:17:00",
  "endTime": "2026-08-20 19:30:00",
  "videos": [              // 新增：该 GPX 关联的视频
    { "videoId": "3f8a2b...", "timeOffsetMs": 10000 },  // timeOffsetMs = 视频起点相对 GPX 起点的偏移（毫秒）
    { "videoId": "9c4e...", "timeOffsetMs": 7200000 }
  ]
}
```

- `videos` 用 `omitempty`，不影响已有 GPX 数据
- `timeOffsetMs` = 视频起点绝对时刻 - GPX 起点绝对时刻，用于快速定位视频在轨迹上的位置（毫秒）
- 一个 GPX 挂多个视频；一个普通视频一对一关联一条 GPX（`VideoInfo.trackId` 指向它）

#### 内嵌 GPS 视频（后续）

- 内嵌 GPS 视频 `VideoInfo.trackId` 为空，自身即轨迹（独立视频轨迹）
- 后续可在其基础上再关联 GPX 校准
- 数据模型已统一（同为 `VideoInfo`），仅 `trackId` 有无区分

### D6. 大文件专项处理

- **导入降并发**：视频导入串行或 1-2 并发
- **导入进度事件**：新增复制进度推送（现有导入无进度回调，10GB 耗时会被当卡死）
- **磁盘空间预检**：导入前检查剩余空间，不足给出提示
- **备份排除视频**：`createZip`/`calcDataSize` 排除 `videos/` 目录

### D7. 查看器差异（预留）

- 360 与普通视频**数据模型统一**，差异仅在节点渲染
- 本次节点用普通图片查看器（`viewType=image`）
- 360 全景查看器（photo-sphere-viewer）后续阶段接入，`viewType=panorama`

## Risks / Trade-offs

- [Android 相机视频无标准 creationdate，自动解析失败] → D2 文件名解析 + 手动兜底，三层保障
- [文件名解析误判（文件名非时间格式）] → 仅作为自动解析候选，不匹配则交手动
- [GPX 逐点对齐需新增后端解析，工作量] → D2 独立阶段；现有 TrackInfo 统计逻辑复用
- [视频与 GPX 时间轴需严格线性（无变速）] → 前提假设；变速视频对齐精度下降，需用户确认起点
- [10GB 视频导入卡死] → D6 降并发 + 进度事件 + 磁盘预检
- [10GB 备份进 zip 卡死] → D6 备份排除视频目录
- [视频文件缺 ffmpeg/ffprobe] → D1 打包到 tools，与 magick/dcraw 相同模式

## Migration Plan

- **阶段 1 验证 spike**：ffprobe 就绪、文件名→时间解析、GPX 逐点解析
- **阶段 2 数据模型**：`VideoInfo`、`TrackInfo` 挂视频、视频目录、GPX 逐点解析
- **阶段 3 统一入口 + 关联上传**：扩展 trackUpload 入口，选 GPX → 传视频 → 对齐时间
- **阶段 4 时间对齐 + 节点生成**：自动解析 + 手动兜底，按 GPX 时间生成视频节点（含短视频至少 1 个节点）
- **阶段 5 视频播放**：范围读取 + MediaSource 流式 `<video>` 播放
- **阶段 6 大文件专项 + 回归**：导入进度、降并发、磁盘预检、备份排除视频、全功能回归
- **回滚**：视频为独立 capability，schema 用 `omitempty` 向后兼容；`TrackInfo` 挂视频字段可选，可安全回退

## Open Questions（后续阶段）

- 360° 全景查看器：`viewType=panorama` 的渲染接入，photo-sphere-viewer + three.js spike 验证
- 视频内嵌 GPS 数据流解析：360 相机内嵌逐帧 GPS 的提取与独立轨迹能力
- 变速视频对齐精度：非标准帧率/变速视频的时间对齐精度需实测
- 一个视频是否允许跨多条 GPX（当前设计一对一）
