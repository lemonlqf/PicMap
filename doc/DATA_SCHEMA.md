# JSON 数据结构文档

## 文件概览

| 文件名 | 描述 |
|--------|------|
| `appSchema.json` | 应用配置/用户信息 schema |
| `schema.json` | 图片/地图/轨迹数据 schema |

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
│       ├── userAvatar: string         # 头像URL
│       └── createTime: number         # 创建时间(毫秒)
└── mapInfo: MapInfo
    ├── mapTiles: MapTile[]            # 地图瓦片数组
    │   └── []
    │       ├── id: string             # 瓦片ID
    │       ├── name: string           # 瓦片名称
    │       ├── url: string            # 瓦片URL
    │       └── image: string          # 瓦片图片路径
    └── defaultTileId: string          # 默认瓦片ID
```

### 2. schema.json 完整结构

```
RootObject
├── verison: string                    # 版本号 (注意: 拼写为 verison)
├── mapInfo: MapConfig
│   ├── center: number[]              # [纬度, 经度]
│   ├── maxZoom: number               # 最大缩放级别
│   ├── minZoom: number               # 最小缩放级别
│   ├── zoom: number                  # 当前缩放级别
│   ├── activeTiles: string[]          # 激活的瓦片ID列表
│   └── defaultTileId: string          # 默认瓦片ID
├── groupInfo: GroupInfo[]            # 图片分组数组
│   └── []
│       ├── id: string                # 分组ID
│       ├── name: string              # 分组名称
│       ├── GPSInfo: GPSInfo
│       │   ├── GPSLatitude: number    # 纬度
│       │   ├── GPSLongitude: number   # 经度
│       │   └── GPSAltitude: number   # 海拔(米)
│       ├── groupNumbers: string[]    # 图片ID列表
│       ├── trackNumbers: string[]     # 轨迹ID列表
│       └── visible: boolean           # 是否可见
├── imageInfo: ImageInfo[]             # 图片详情数组
│   └── []
│       ├── id: string                # 图片ID/文件名
│       ├── name: string              # 文件名
│       ├── size: number              # 文件大小(字节)
│       ├── type: string              # MIME类型
│       ├── lastModified: number      # 最后修改时间戳
│       ├── describe: string          # 图片描述
│       ├── url: string               # 图片URL
│       ├── blobUrl: string           # Blob URL
│       └── GPSInfo: GPSInfo
│           ├── GPSLatitude: number    # 纬度
│           ├── GPSLongitude: number  # 经度
│           └── GPSAltitude: number   # 海拔(米)
├── trackInfo: TrackInfo[]             # 轨迹信息数组 (可选)
│   └── []
│       ├── id: string                # 轨迹ID
│       ├── name: string               # 轨迹名称
│       ├── distance: number          # 总距离(米)
│       ├── startTime: string         # 开始时间
│       ├── endTime: string           # 结束时间
│       ├── movingTime: number        # 移动时间(毫秒)
│       ├── totalTime: number         # 总时间(毫秒)
│       ├── movingPace: number        # 平均移动配速
│       ├── movingSpeed: number       # 平均移动速度(公里/小时)
│       ├── totalSpeed: number        # 平均总速度(公里/小时)
│       ├── elevationMin: number      # 最低海拔(米)
│       ├── elevationMax: number      # 最高海拔(米)
│       ├── elevationGain: number     # 累计爬升(米)
│       ├── elevationLoss: number     # 累计下降(米)
│       ├── speedMax: number          # 最大速度(公里/小时)
│       ├── averageHr: number         # 平均心率
│       ├── averageCadence: number   # 平均踏频
│       ├── averageTemp: number       # 平均温度
│       └── setting:                  # 轨迹设置
│           └── lineColor: string     # 轨迹线颜色
```

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
| `url` | `string` | 是 | 瓦片资源URL |
| `image` | `string` | 是 | 瓦片图片路径 |

#### MapInfo

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `mapTiles` | `MapTile[]` | 是 | 地图瓦片数组 |
| `defaultTileId` | `string` | 否 | 默认瓦片ID |

---

### schema.json

#### MapConfig

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `center` | `number[]` | 是 | 地图中心 [纬度, 经度] | `[30.185, 120.178]` |
| `maxZoom` | `number` | 是 | 最大缩放级别 | `18` |
| `minZoom` | `number` | 是 | 最小缩放级别 | `3` |
| `zoom` | `number` | 是 | 当前缩放级别 | `16` |
| `activeTiles` | `string[]` | 是 | 激活的瓦片ID列表 | `["tile_default1"]` |
| `defaultTileId` | `string` | 否 | 默认瓦片ID | `"tile_default1"` |

#### GroupInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | 是 | 分组唯一ID | `"group_1772783799870"` |
| `name` | `string` | 是 | 分组名称 | `"我的分组"` |
| `GPSInfo` | `GPSInfo` | 是 | 分组GPS信息 | 见下方 |
| `groupNumbers` | `string[]` | 否 | 包含的图片ID列表 | `["img_001", "img_002"]` |
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
| `url` | `string` | 否 | 图片URL | `"/user1/images/photo.jpg"` |
| `blobUrl` | `string` | 否 | Blob URL | `"blob:..."` |
| `GPSInfo` | `GPSInfo` | 是 | GPS定位信息 | 见下方 |

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
| `setting` | `object` | 否 | 轨迹设置 | `{ lineColor: "#FF6B6B" }` |

#### GPSInfo

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `GPSLatitude` | `number` | 纬度 | `30.1869572` |
| `GPSLongitude` | `number` | 经度 | `120.1728597` |
| `GPSAltitude` | `number` | 海拔(米) | `22` |

---

## 数据关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        appSchema.json                        │
├─────────────────────────────────────────────────────────────┤
│  version (string)                                            │
│  userInfos []─────────────► UserInfo                        │
│  └── userId, userName, userAvatar, createTime              │
│  mapInfo                                                    │
│  ├── mapTiles [] ──────────► MapTile                        │
│  │   └── id, name, url, image                              │
│  └── defaultTileId (string)                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         schema.json                           │
├─────────────────────────────────────────────────────────────┤
│  verison (string) - 注意: 拼写为 verison                    │
│  mapInfo ───────────────────► MapConfig                     │
│  └── center, maxZoom, minZoom, zoom, activeTiles          │
│  groupInfo [] ──────────────► GroupInfo                     │
│  ├── id, name, GPSInfo, groupNumbers, trackNumbers, visible│
│  └── GPSInfo ───────────────► GPSInfo                       │
│                                │                             │
│                                ▼                             │
│  imageInfo [] ◄────────────────┘ (groupNumbers → id)      │
│  ├── id, name, size, type, lastModified, describe         │
│  │   url, blobUrl                                          │
│  └── GPSInfo ───────────────► GPSInfo                       │
│                                                              │
│  trackInfo [] (可选) ────────► TrackInfo                    │
│  └── id, name, distance, startTime, endTime, movingTime   │
│      totalTime, movingPace, movingSpeed, totalSpeed        │
│      elevationMin, elevationMax, elevationGain, elevationLoss
│      speedMax, averageHr, averageCadence, averageTemp      │
│      setting                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 备注

1. **时间戳**: 所有时间相关字段均为 **毫秒级** 时间戳
2. **verison 拼写**: schema.json 中版本号字段拼写为 `verison`（而非 `version`），为历史遗留问题
3. **GPS 格式**: 经纬度为 `number` 类型
4. **图片设备**: 数据中主要使用 **Samsung Galaxy S23/S24 Ultra** 系列手机拍摄
5. **groupNumbers 关联**: `groupInfo[].groupNumbers` 数组中的值对应 `imageInfo[].id`
6. **trackNumbers 关联**: `groupInfo[].trackNumbers` 数组中的值对应 `trackInfo[].id`
7. **轨迹文件**: 实际 GPX 轨迹文件存储在用户目录的 `tracks/` 文件夹下
8. **EXIF 信息**: 图片的 EXIF 信息（相机信息、拍摄时间等）在上传时用于解析，但不在 schema.json 中持久化存储
