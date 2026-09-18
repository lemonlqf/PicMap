# JSON 数据结构文档

## 文件概览

| 文件名 | 位置 | 描述 |
|--------|------|------|
| `appSchema.json` | 数据根目录 | 应用配置（用户列表、地图瓦片、叠加层、图标库） |
| `schema.json` | `<用户ID>/images/schema/` | 单用户的图片/分组/轨迹/视频/地图数据 |
| `.picmap-config.json` | 用户主目录 | 存储目录配置（数据目录、备份目录） |

> 所有 schema 写入均采用「临时文件 + 原子重命名」策略，避免中断导致文件损坏。
> 前端保存前会清理图片的 `url` / `blobUrl` / `thumbnailUrl` 等临时字段。

---

## 数据结构树

### 1. appSchema.json 完整结构

```
RootObject
├── version: string                    # 版本号
├── userInfos: UserInfo[]              # 用户信息数组
│   └── []
│       ├── userId: string             # 用户ID
│       ├── userName: string           # 用户名
│       ├── userAvatar: string         # 头像 URL
│       └── createTime: number         # 创建时间(毫秒)
├── mapInfo: AppSchemaMapInfo
│   ├── mapTiles: MapTile[]            # 地图瓦片数组
│   │   └── []
│   │       ├── id: string             # 瓦片ID
│   │       ├── name: string           # 瓦片名称
│   │       ├── url: string            # 瓦片URL（含 {x}{y}{z} 占位）
│   │       └── image: string          # 瓦片封面图片
│   ├── defaultTileId: string          # 默认瓦片ID
│   └── tileOverlays: Record<string, TileOverlay[]>  # 瓦片ID -> 叠加层列表
│       └── "<tileId>": []
│           ├── name: string           # 叠加层名称（如"路网标注"）
│           └── url: string            # 叠加层瓦片URL（含占位符）
└── iconLibrary: IconItem[]            # 全局图标库（可选）
    └── []
        ├── id: string                 # 图标ID
        ├── name: string               # 图标名称
        ├── url: string                # 相对路径（自定义）或预设 key
        ├── category: string           # "avatar" | "track"
        └── source: string             # "preset" | "custom"
```

### 2. schema.json 完整结构

```
RootObject
├── version: string                    # 版本号
├── mapInfo: MapInfo
│   ├── center: number[]               # 地图中心 [纬度, 经度]
│   ├── maxZoom: number                # 最大缩放级别
│   ├── minZoom: number                # 最小缩放级别
│   ├── zoom: number                   # 当前缩放级别
│   ├── pitch: number                  # 俯仰角（可选）
│   ├── bearing: number                # 旋转角（可选）
│   ├── activeTiles: string[]          # 激活的瓦片ID列表
│   ├── defaultTileId: string          # 默认瓦片ID
│   └── overlayVisible: Record<string, boolean>  # 瓦片ID -> 叠加层开关
├── groupInfo: GroupInfo[]             # 图片分组数组
│   └── []
│       ├── id: string                 # 分组ID
│       ├── name: string               # 分组名称
│       ├── GPSInfo: GPSInfo
│       │   ├── GPSLatitude: number    # 纬度
│       │   ├── GPSLongitude: number   # 经度
│       │   └── GPSAltitude: number    # 海拔(米)
│       ├── groupNumbers: string[]     # 图片ID列表
│       ├── videoNumbers: string[]     # 视频ID列表
│       ├── trackNumbers: string[]     # 轨迹ID列表
│       └── visible: boolean           # 是否可见
├── imageInfo: ImageInfo[]             # 图片详情数组
│   └── []
│       ├── id: string                 # 图片ID/文件名
│       ├── name: string               # 文件名
│       ├── size: number               # 文件大小(字节)
│       ├── type: string               # MIME类型
│       ├── lastModified: number       # 最后修改时间戳
│       ├── describe: string           # 图片描述
│       ├── url: string                # 图片URL（临时，保存前清理）
│       ├── blobUrl: string            # Blob URL（临时，保存前清理）
│       ├── isPanorama: boolean        # 是否全景图片
│       ├── panoramaType: string       # "spherical" | "cylindrical"
│       └── GPSInfo: GPSInfo
│           ├── GPSLatitude: number    # 纬度
│           ├── GPSLongitude: number   # 经度
│           └── GPSAltitude: number    # 海拔(米)
├── trackInfo: TrackInfo[]             # 轨迹信息数组（可选）
│   └── []
│       ├── id: string                 # 轨迹ID
│       ├── name: string               # 轨迹名称
│       ├── distance: number           # 总距离(米)
│       ├── startTime: string          # 开始时间
│       ├── endTime: string            # 结束时间
│       ├── movingTime: number         # 移动时间(毫秒)
│       ├── totalTime: number          # 总时间(毫秒)
│       ├── movingPace: number         # 平均移动配速
│       ├── movingSpeed: number        # 平均移动速度(公里/小时)
│       ├── totalSpeed: number         # 平均总速度(公里/小时)
│       ├── elevationMin: number       # 最低海拔(米)
│       ├── elevationMax: number       # 最高海拔(米)
│       ├── elevationGain: number      # 累计爬升(米)
│       ├── elevationLoss: number      # 累计下降(米)
│       ├── speedMax: number           # 最大速度(公里/小时)
│       ├── averageHr: number          # 平均心率
│       ├── averageCadence: number     # 平均踏频
│       ├── averageTemp: number        # 平均温度
│       ├── setting: TrackSetting
│       │   ├── lineColor: string      # 轨迹线颜色
│       │   ├── showOnMainMap: boolean # 是否固定显示在主地图
│       │   ├── startIconId: string    # 起点图标ID
│       │   └── endIconId: string      # 终点图标ID
│       ├── videos: VideoRef[]         # 关联的视频列表
│       │   └── []
│       │       ├── videoId: string    # 视频ID
│       │       └── timeOffsetMs: number  # 相对 GPX 起点的偏移(毫秒)
│       └── images: string[]           # 关联的图片ID列表
└── videoInfo: VideoInfo[]             # 轨迹视频数组（可选）
    └── []
        ├── id: string                 # 唯一ID
        ├── name: string               # 原始文件名
        ├── path: string               # videos/ 下的文件名
        ├── durationMs: number         # 时长(毫秒)
        ├── startTimeMs: number        # 视频自身绝对开始时间(epoch 毫秒)
        ├── isPanorama: boolean        # 是否 360 全景视频
        ├── size: number               # 文件大小(字节)
        ├── lastModified: number       # 修改时间(epoch 毫秒)
        ├── GPSLatitude: number        # 内嵌 GPS 单点纬度（GCJ02）
        └── GPSLongitude: number       # 内嵌 GPS 单点经度（GCJ02）
```

> 说明：`trackInfo.videos` 是视频与轨迹关联的**权威存储**；`videoInfo` 本身不保存 `trackId`/`timeOffsetMs`。

---

## 字段详细说明

### appSchema.json

#### UserInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `userId` | `string` | 是 | 用户唯一ID | `"user_1772726265585"` |
| `userName` | `string` | 是 | 用户名 | `"张三"` |
| `userAvatar` | `string` | 否 | 头像URL，空字符串表示无头像 | `""` |
| `createTime` | `number` | 否 | 创建时间(毫秒) | `1772726265585` |

#### MapTile

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | 是 | 瓦片ID |
| `name` | `string` | 是 | 瓦片名称 |
| `url` | `string` | 是 | 瓦片资源URL（含 `{x}{y}{z}` 占位） |
| `image` | `string` | 是 | 瓦片封面图片 |

#### TileOverlay

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `name` | `string` | 是 | 叠加层名称 | `"路网标注"` |
| `url` | `string` | 是 | 叠加层瓦片URL（含占位符） | `"https://.../{x}/{y}/{z}"` |

#### IconItem

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | 是 | 图标ID | `"icon_001"` |
| `name` | `string` | 是 | 图标名称 | `"跑步"` |
| `url` | `string` | 是 | 相对路径（自定义）或预设 key | `"icons/track/xxx.png"` |
| `category` | `string` | 是 | 分类：`avatar` \| `track` | `"track"` |
| `source` | `string` | 是 | 来源：`preset` \| `custom` | `"custom"` |

---

### schema.json

#### MapInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `center` | `number[]` | 是 | 地图中心 [纬度, 经度] | `[30.185, 120.178]` |
| `maxZoom` | `number` | 否 | 最大缩放级别 | `18` |
| `minZoom` | `number` | 否 | 最小缩放级别 | `3` |
| `zoom` | `number` | 否 | 当前缩放级别 | `16` |
| `pitch` | `number` | 否 | 俯仰角 | `30` |
| `bearing` | `number` | 否 | 旋转角 | `0` |
| `activeTiles` | `string[]` | 是 | 激活的瓦片ID列表 | `["tile_default1"]` |
| `defaultTileId` | `string` | 否 | 默认瓦片ID | `"tile_default1"` |
| `overlayVisible` | `Record<string, boolean>` | 否 | 瓦片ID → 叠加层开关（未记录默认开启） | `{ "tile_default1": true }` |

#### GroupInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | 是 | 分组唯一ID | `"group_1772783799870"` |
| `name` | `string` | 是 | 分组名称 | `"我的分组"` |
| `GPSInfo` | `GPSInfo` | 是 | 分组GPS信息 | 见下方 |
| `groupNumbers` | `string[]` | 否 | 包含的图片ID列表 | `["img_001", "img_002"]` |
| `videoNumbers` | `string[]` | 否 | 包含的视频ID列表 | `["video_001"]` |
| `trackNumbers` | `string[]` | 否 | 包含的轨迹ID列表 | `["track_001.gpx"]` |
| `visible` | `boolean` | 否 | 是否可见 | `true` |

#### ImageInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | 是 | 图片唯一标识 | `"img_001"` |
| `name` | `string` | 是 | 文件名 | `"photo.jpg"` |
| `size` | `number` | 否 | 文件大小(字节) | `1451078` |
| `type` | `string` | 是 | MIME类型 | `"image/jpeg"` |
| `lastModified` | `number` | 否 | 最后修改时间戳 | `1770646931610` |
| `describe` | `string` | 否 | 图片描述 | `"这是一张照片"` |
| `isPanorama` | `boolean` | 否 | 是否全景图片 | `true` |
| `panoramaType` | `string` | 否 | 全景类型：`spherical` \| `cylindrical` | `"spherical"` |
| `url` | `string` | 否 | 图片URL（临时字段，保存前清理） | `"/user1/images/photo.jpg"` |
| `blobUrl` | `string` | 否 | Blob URL（临时字段，保存前清理） | `"blob:..."` |
| `GPSInfo` | `GPSInfo` | 是 | GPS定位信息 | 见下方 |

#### TrackSetting

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `lineColor` | `string` | 否 | 轨迹线颜色 | `"#FF6B6B"` |
| `showOnMainMap` | `boolean` | 否 | 是否固定显示在主地图 | `true` |
| `startIconId` | `string` | 否 | 起点自定义图标ID | `"icon_001"` |
| `endIconId` | `string` | 否 | 终点自定义图标ID | `"icon_002"` |

#### VideoRef

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `videoId` | `string` | 是 | 关联视频ID | `"video_001"` |
| `timeOffsetMs` | `number` | 否 | 视频起点相对 GPX 起点的偏移(毫秒) | `120000` |

#### TrackInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | 是 | 轨迹唯一ID | `"20240115_跑步.gpx"` |
| `name` | `string` | 否 | 轨迹名称 | `"跑步"` |
| `distance` | `number` | 否 | 总距离(米) | `5230` |
| `startTime` | `string` | 否 | 开始时间 | `"2024-01-15T08:30:00"` |
| `endTime` | `string` | 否 | 结束时间 | `"2024-01-15T09:15:00"` |
| `movingTime` | `number` | 否 | 移动时间(毫秒) | `2700000` |
| `totalTime` | `number` | 否 | 总时间(毫秒) | `3600000` |
| `movingPace` | `number` | 否 | 平均移动配速 | `300000` |
| `movingSpeed` | `number` | 否 | 平均移动速度(公里/小时) | `6.5` |
| `totalSpeed` | `number` | 否 | 平均总速度(公里/小时) | `5.2` |
| `elevationMin` | `number` | 否 | 最低海拔(米) | `15` |
| `elevationMax` | `number` | 否 | 最高海拔(米) | `52` |
| `elevationGain` | `number` | 否 | 累计爬升(米) | `120` |
| `elevationLoss` | `number` | 否 | 累计下降(米) | `115` |
| `speedMax` | `number` | 否 | 最大速度(公里/小时) | `12.3` |
| `averageHr` | `number` | 否 | 平均心率 | `145` |
| `averageCadence` | `number` | 否 | 平均踏频 | `170` |
| `averageTemp` | `number` | 否 | 平均温度 | `18` |
| `setting` | `TrackSetting` | 否 | 轨迹设置 | 见上方 |
| `videos` | `VideoRef[]` | 否 | 关联的视频列表 | 见上方 |
| `images` | `string[]` | 否 | 关联的图片ID列表 | `["img_001"]` |

#### VideoInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | 是 | 视频唯一ID | `"video_001"` |
| `name` | `string` | 否 | 原始文件名 | `"DJI_0001.mp4"` |
| `path` | `string` | 否 | `videos/` 下的文件名 | `"PM3f8a...mp4"` |
| `durationMs` | `number` | 否 | 视频时长(毫秒) | `185000` |
| `startTimeMs` | `number` | 否 | 视频绝对开始时刻(epoch 毫秒) | `1705300000000` |
| `isPanorama` | `boolean` | 否 | 是否 360 全景视频 | `false` |
| `size` | `number` | 否 | 文件大小(字节) | `104857600` |
| `lastModified` | `number` | 否 | 修改时间(epoch 毫秒) | `1705300100000` |
| `GPSLatitude` | `number` | 否 | 内嵌 GPS 单点纬度（GCJ02） | `30.1869572` |
| `GPSLongitude` | `number` | 否 | 内嵌 GPS 单点经度（GCJ02） | `120.1728597` |

#### GPSInfo

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `GPSLatitude` | `number` | 纬度 | `30.1869572` |
| `GPSLongitude` | `number` | 经度 | `120.1728597` |
| `GPSAltitude` | `number` | 海拔(米) | `22` |

---

## 数据关系图

```
┌──────────────────────────────────────────────────────────────┐
│                        appSchema.json                         │
├──────────────────────────────────────────────────────────────┤
│  version (string)                                             │
│  userInfos []─────────────► UserInfo                          │
│  └── userId, userName, userAvatar, createTime                 │
│  mapInfo                                                      │
│  ├── mapTiles [] ──────────► MapTile                          │
│  │   └── id, name, url, image                                 │
│  ├── defaultTileId (string)                                   │
│  └── tileOverlays {} ──────► TileOverlay[]  (瓦片ID → 叠加层)  │
│  iconLibrary [] ───────────► IconItem                         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                         schema.json                            │
├──────────────────────────────────────────────────────────────┤
│  version (string)                                             │
│  mapInfo ──────────────────► MapInfo                          │
│  └── center, zoom, pitch, bearing, activeTiles, overlayVisible│
│  groupInfo [] ─────────────► GroupInfo                        │
│  ├── id, name, GPSInfo, visible                               │
│  ├── groupNumbers → imageInfo[].id                            │
│  ├── videoNumbers → videoInfo[].id                            │
│  └── trackNumbers → trackInfo[].id                            │
│                                                               │
│  imageInfo [] ─────────────► ImageInfo                        │
│  └── id, name, size, type, GPSInfo                            │
│      isPanorama, panoramaType, describe                       │
│                                                               │
│  trackInfo [] (可选) ──────► TrackInfo                        │
│  ├── 统计字段 + setting(lineColor/showOnMainMap/icon)         │
│  ├── videos [] ────────────► VideoRef { videoId, timeOffsetMs }│
│  │                              │                             │
│  │                              ▼                             │
│  └── images []                videoInfo [].id                 │
│                                                               │
│  videoInfo [] (可选) ──────► VideoInfo                        │
│  └── id, name, path, durationMs, startTimeMs                  │
│      isPanorama, GPSLatitude, GPSLongitude                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 备注

1. **时间戳**: 所有时间相关字段均为 **毫秒级** 时间戳。
2. **version 字段**: schema.json 中版本号字段为 `version`（历史文档曾误记为 `verison`）。
3. **GPS 格式**: 经纬度为 `number` 类型；图片/分组/视频的 GPS 统一存储为 **GCJ02**（导入时由后端从 WGS84 转换）。
4. **图片设备**: 示例数据中主要使用 **Samsung Galaxy S23/S24 Ultra** 系列手机拍摄。
5. **groupNumbers 关联**: `groupInfo[].groupNumbers` 数组中的值对应 `imageInfo[].id`。
6. **videoNumbers 关联**: `groupInfo[].videoNumbers` 数组中的值对应 `videoInfo[].id`。
7. **trackNumbers 关联**: `groupInfo[].trackNumbers` 数组中的值对应 `trackInfo[].id`。
8. **轨迹文件**: 实际 GPX 轨迹文件存储在用户目录的 `tracks/` 文件夹下，`trackInfo[].id` 对应文件名。
9. **视频文件**: 实际视频文件存储在用户目录的 `videos/` 文件夹下，文件名形如 `PM<id>.<ext>`。
10. **视频-轨迹关联**: 以 `trackInfo[].videos` 为权威存储，`VideoRef.timeOffsetMs` 表示视频起点相对轨迹起点的偏移；`videoInfo` 不保存关联信息。
11. **全景字段**: 图片全景由后端自动检测（XMP GPano 优先，宽高比兜底）写入 `isPanorama`/`panoramaType`；视频全景由用户手动设置 `isPanorama`。
12. **保留字段**: `url` / `blobUrl` 为运行时临时字段，前端保存 schema 前会清理，不会持久化。
13. **EXIF 信息**: 图片的 EXIF（相机信息、拍摄时间等）在上传时解析用于展示，不在 schema.json 中持久化。
