# JSON 数据结构文档

## 📁 文件概览

| 文件名 | 描述 |
|--------|------|
| `appSchema.json` | 应用配置/用户信息 schema |
| `schema.json` | 图片/地图数据 schema |

---

## 🌲 数据结构树

### 1. appSchema.json 完整结构

```
RootObject
├── version: string                    # "1.0.0"
├── userInfos: UserInfo[]              # 用户信息数组
│   └── []
│       ├── userName: string           # 用户名
│       ├── userAvatar: string         # 头像URL
│       ├── userId: string             # 用户ID (user_时间戳)
│       └── createTime: number         # 创建时间(毫秒)
└── mapInfo: MapInfo
    └── mapTiles: MapTile[]            # 地图瓦片数组
        └── []
            ├── id: string             # 瓦片ID (tile_时间戳)
            ├── name: string            # 瓦片名称
            ├── url: string             # 瓦片URL
            └── image: string           # 瓦片图片路径
```

### 2. schema.json 完整结构

```
RootObject
├── version: string                    # "1.0.0"
├── mapInfo: MapConfig
│   ├── center: [number, number]       # [纬度, 经度]
│   ├── activeTiles: string[]          # 激活的瓦片ID列表
│   └── zoom: number                   # 缩放级别
├── groupInfo: GroupInfo[]             # 图片分组数组
│   └── []
│       ├── id: string                 # 分组ID (group_时间戳)
│       ├── name: string               # 分组名称
│       ├── groupNumbers: string[]     # 图片文件名列表
│       └── GPSInfo: GPSInfo
│           ├── GPSAltitude: number   # 海拔(米)
│           ├── GPSLatitude: number    # 纬度
│           └── GPSLongitude: number   # 经度
└── imageInfo: ImageInfo[]            # 图片详情数组
    └── []
        ├── id: string                 # 图片ID/文件名
        ├── lastModified: number       # 最后修改时间戳
        ├── name: string              # 文件名
        ├── size: number              # 文件大小(字节)
        ├── type: string              # MIME类型
        ├── GPSInfo: GPSInfo
        │   ├── GPSLatitude: number | string
        │   ├── GPSLongitude: number | string
        │   └── GPSAltitude: number
        ├── imageInfo: ImageExif
        │   ├── Resolution: string    # "宽 x 高"
        │   ├── BrightnessValue: [number, number]
        │   └── size: string          # "1.42MB"
        ├── cameraInfo: CameraExif
        │   ├── Make: string[]        # 制造商
        │   ├── Model: string[]       # 型号
        │   ├── FNumber: [number, number]      # 光圈 f/
        │   ├── ExposureTime: [number, number]  # 曝光时间
        │   ├── ISOSpeedRatings: number        # ISO值
        │   ├── ExposureBiasValue: [number, number]
        │   ├── FocalLength: [number, number]  # 焦距(mm)
        │   └── MaxApertureValue: [number, number]
        └── authorInfo: AuthorInfo
            └── DateTime: number | null  # 拍摄时间戳
```

---

## 📋 字段详细说明

### appSchema.json

#### UserInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `userName` | `string` | ✅ | 用户名 | `"sadsfs"` |
| `userAvatar` | `string` | ✅ | 头像URL，空字符串表示无头像 | `""` |
| `userId` | `string` | ✅ | 用户唯一ID | `"user_1772726265585"` |
| `createTime` | `number` | ✅ | 创建时间(毫秒) | `1772726265585` |

#### MapTile

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | `string` | ✅ | 瓦片ID |
| `name` | `string` | ✅ | 瓦片名称 |
| `url` | `string` | ✅ | 瓦片资源URL |
| `image` | `string` | ✅ | 瓦片图片路径 |

---

### schema.json

#### MapConfig

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `center` | `[number, number]` | ✅ | 地图中心 [纬度, 经度] | `[30.185, 120.178]` |
| `activeTiles` | `string[]` | ✅ | 激活的瓦片ID列表 | `["tile_default1"]` |
| `zoom` | `number` | ✅ | 缩放级别 | `16` |

#### GroupInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | ✅ | 分组唯一ID | `"group_1772783799870"` |
| `name` | `string` | ✅ | 分组名称 | `"1"` |
| `groupNumbers` | `string[]` | ✅ | 包含的图片文件名 | `["20240618_121821.jpg"]` |
| `GPSInfo` | `GPSInfo` | ✅ | 分组GPS信息 | 见下方 |

#### ImageInfo

| 字段 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| `id` | `string` | ✅ | 图片唯一标识 | `"111.jpg"` |
| `lastModified` | `number` | ✅ | 最后修改时间戳 | `1770646931610` |
| `name` | `string` | ✅ | 文件名 | `"111.jpg"` |
| `size` | `number` | ✅ | 文件大小(字节) | `1451078` |
| `type` | `string` | - | MIME类型 | `"image/jpeg"` |
| `GPSInfo` | `GPSInfo` | - | GPS定位信息 | 见下方 |
| `imageInfo` | `ImageExif` | - | 图片EXIF信息 | 见下方 |
| `cameraInfo` | `CameraExif` | - | 相机EXIF信息 | 见下方 |
| `authorInfo` | `AuthorInfo` | - | 作者/拍摄信息 | 见下方 |

#### GPSInfo

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `GPSLatitude` | `number \| string` | 纬度 | `30.1869572` 或 `"30.1147726"` |
| `GPSLongitude` | `number \| string` | 经度 | `120.1728597` 或 `"120.2110385"` |
| `GPSAltitude` | `number` | 海拔(米) | `22` |

#### ImageExif

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `Resolution` | `string` | 分辨率 | `"3000 x 4000"` |
| `BrightnessValue` | `[number, number]` | 亮度值(分数) | `[714, 100]` |
| `size` | `string` | 文件大小描述 | `"1.42MB"` |

#### CameraExif

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `Make` | `string[]` | 相机制造商 | `["samsung"]` |
| `Model` | `string[]` | 相机型号 | `["Galaxy S23"]` |
| `FNumber` | `[number, number]` | 光圈值 f/ | `[180, 100]` = f/1.8 |
| `ExposureTime` | `[number, number]` | 曝光时间(秒) | `[5567099, 1000000000]` ≈ 1/180s |
| `ISOSpeedRatings` | `number` | ISO感光度 | `25` |
| `ExposureBiasValue` | `[number, number]` | 曝光补偿 | `[0, 100]` = 0 |
| `FocalLength` | `[number, number]` | 焦距(mm) | `[630, 100]` = 6.3mm |
| `MaxApertureValue` | `[number, number]` | 最大光圈 | `[153, 100]` |

#### AuthorInfo

| 字段 | 类型 | 描述 | 示例 |
|------|------|------|------|
| `DateTime` | `number \| null` | 拍摄时间戳(毫秒) | `1761459624000` 或 `null` |

---

## 🔗 数据关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        appSchema.json                        │
├─────────────────────────────────────────────────────────────┤
│  version (string)                                           │
│  userInfos []─────────────► UserInfo                        │
│  └── userName, userAvatar, userId, createTime              │
│  mapInfo                             MapInfo                │
│  └── mapTiles [] ─────────────► MapTile                     │
│      └── id, name, url, image                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         schema.json                          │
├─────────────────────────────────────────────────────────────┤
│  version (string)                                           │
│  mapInfo ───────────────────► MapConfig                     │
│  └── center, activeTiles, zoom                              │
│  groupInfo [] ──────────────► GroupInfo                     │
│  ├── id, name, groupNumbers                                 │
│  └── GPSInfo ──────────────► GPSInfo                        │
│                                │                             │
│                                ▼                             │
│  imageInfo [] ◄────────────────┘ (groupNumbers → name)     │
│  ├── id, name, size, type, lastModified                    │
│  ├── GPSInfo ──────────────► GPSInfo                        │
│  ├── imageInfo ─────────────► ImageExif                     │
│  │   └── Resolution, BrightnessValue, size                 │
│  ├── cameraInfo ─────────────► CameraExif                   │
│  │   └── Make, Model, FNumber, ExposureTime, ISOSpeed...   │
│  └── authorInfo ─────────────► AuthorInfo                   │
│      └── DateTime                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📌 备注

1. **时间戳**: 所有时间相关字段均为 **毫秒级** 时间戳
2. **EXIF 分数**: `FNumber`, `ExposureTime`, `FocalLength` 等使用分数形式 `[分子, 分母]`，实际值 = 分子 ÷ 分母
   - `ExposureTime: [5567099, 1000000000]` = 1/180 秒
   - `FNumber: [180, 100]` = f/1.8
3. **GPS 格式**: 经纬度可能是 `number` 或 `string` 类型
4. **图片设备**: 数据中主要使用 **Samsung Galaxy S23/S24 Ultra** 系列手机拍摄
5. **groupNumbers 关联**: `groupInfo[].groupNumbers` 数组中的文件名对应 `imageInfo[].name`

