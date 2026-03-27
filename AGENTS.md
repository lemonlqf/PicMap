# AGENTS.md - PicMap Development Guide

## Project Overview

PicMap is an Electron-based image map application with Vue 3 + TypeScript frontend and Express backend.

**Tech Stack:**
- Frontend: Vue 3, TypeScript, Vite, Pinia, Element Plus, Leaflet
- Backend: Node.js, Express, Webpack
- Desktop: Electron + electron-builder

**Directory Structure:**
```
PicMap/
├── picMap_fontend/     # Vue 3 + TypeScript frontend (Vite)
├── picMap_backend/     # Express backend (Webpack)
├── dist/               # Build output
└── doc/                # Documentation
```

---

## Features Overview

PicMap 是一款基于 Electron 的本地图片地图应用，将带有 GPS 坐标的照片展示在交互式地图上。

### 1. 图片管理 (Image Management)
- **上传**: 批量上传图片，自动解析 EXIF GPS 信息
- **预览**: 上传前预览图片及 GPS 坐标
- **删除**: 从 schema 和文件系统删除图片
- **缩略图**: 自动为 HEIC/RAW 格式生成缩略图
- **手动定位**: 无 GPS 图片可手动标注位置
- **支持格式**: JPEG, PNG, GIF, WEBP, HEIC, HEIF, RAW, Canon CR2/CR3, Nikon NEF, Sony ARW 等

### 2. 地图展示 (Map Display)
- **多瓦片源**: 高德、百度、OpenStreetMap、自定义瓦片
- **标记点**: 图片标记（缩略图）、分组标记（多图拼贴）
- **标记聚合**: 低缩放级别时自动聚合附近标记
- **时间筛选**: 通过时间轴滑块按拍摄时间筛选
- **坐标转换**: WGS84 转 GCJ02（适配中国地图提供商）
- **右键菜单**: 删除、设置分组等快捷操作

### 3. 轨迹管理 (Track/GPX Management)
- **上传 GPX**: 从运动 App（Strava、Nike 等）导入轨迹文件
- **轨迹展示**: 在地图上显示轨迹及起终点标记
- **统计计算**: 距离、配速、海拔、时长等
- **轨迹配色**: 自定义轨迹线颜色
- **关联分组**: 将轨迹关联到图片分组
- **文件限制**: 最大 50MB

### 4. 多用户支持 (Multi-User)
- **用户切换**: 右上角用户图标切换
- **数据隔离**: 每个用户的数据完全独立
- **存储结构**: `D:\PicMap\[用户ID]\images\`

### 5. 分组管理 (Group Organization)
- **创建分组**: 按主题/行程组织图片
- **分组颜色**: 每个分组可设置自定义颜色
- **批量操作**: 批量添加/移除图片
- **可见性**: 分组可独立显示/隐藏

### 6. 备份恢复 (Backup/Restore)
- **创建备份**: 打包所有用户数据为 ZIP
- **两种模式**: 覆盖模式（完全替换）、合并模式（保留现有数据）
- **备份列表**: 查看备份文件及大小
- **超过 500MB**: 显示警告提示

### 7. 设置 (Settings)
- **语言切换**: 中文、英文等多语言支持
- **瓦片管理**: 添加、编辑、删除自定义地图瓦片
- **地图位置**: 保存/恢复地图中心和缩放级别

---

### 主要数据模型

```typescript
// 图片信息
interface IImageInfo {
  id: string
  name: string
  GPSInfo: { GPSLatitude: number, GPSLongitude: number, GPSAltitude?: number }
  type: string
  describe?: string
}

// 分组信息
interface IGroupInfo {
  name: string
  id: string
  GPSInfo: { GPSLatitude: number, GPSLongitude: number, GPSAltitude?: number }
  groupNumbers?: string[]  // 分组中的图片ID列表
  trackNumbers?: string[] // 关联的轨迹ID列表
  visible?: boolean       // 是否在地图上显示
}

// 轨迹信息
interface ITrackInfo {
  id: string
  name?: string
  distance?: number       // 总距离(米)
  startTime?: string      // 开始时间
  endTime?: string        // 结束时间
  movingTime?: number      // 移动时长(秒)
  elevationGain?: number   // 海拔上升(米)
  setting?: { lineColor?: string }
}
```

### 主页面布局 (Index.vue)

```
┌─────────────────────────────────────────┐
│ [用户]                    [地图选择器]   │
│                                          │
│  ┌────────┐                              │
│  │ 上传   │                              │
│  │ 面板   │        地图                   │
│  │        │    (Leaflet)                 │
│  │        │                              │
│  └────────┘     ┌─────────┐              │
│                  │ 分组面板 │              │
│                  └─────────┘              │
│  ┌──────────────────────────────────┐    │
│  │           时间轴                   │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │        图片详情抽屉                │    │
│  └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### 存储目录结构

```
D:\PicMap\
├── appSchema.json           # 应用配置（用户列表、地图设置）
├── PicMap_Backup\           # 备份文件目录
└── [用户ID]\
    ├── images\
    │   ├── schema\
    │   │   └── schema.json   # 用户的图片/分组/轨迹元数据
    │   └── *.jpg              # 用户的图片文件
    └── tracks\               # 用户的 GPX 轨迹文件
```

---

## Build Commands

### Root (Electron App)
```bash
npm run dev              # Start both frontend + backend concurrently
npm run build:auto       # Full build: frontend + backend + electron-builder
npm start                # Run Electron with nodemon
```

### Frontend (picMap_fontend/)
```bash
npm run dev              # Vite dev server (port 5173)
npm run build            # Production build with Vite
npm run preview          # Preview production build
```

### Backend (picMap_backend/)
```bash
npm start                # Start with nodemon (port 5120)
npm run build            # Webpack production build
```

### Single Component/Module Build Test
```bash
# Frontend - type-check a specific file
npx vue-tsc --noEmit src/views/picMap/Map.vue

# Backend - run webpack on specific entry
npx webpack --entry ./bin/www
```

---

## Code Style Guidelines

### TypeScript (Frontend)

**Imports:**
- Use path aliases: `@/` for `src/` (configured in tsconfig.json)
- Use `import type` for type-only imports
- Group imports: external packages → internal modules → relative imports

```typescript
// Good
import { ref, computed } from 'vue'
import type { PropType } from 'vue'
import { useAppStore } from '@/store/appSchema'
import IconHTMLFactory, { IconType } from '@/utils/iconHTML'

// Bad
import vue from 'vue'
```

**Types:**
- Use TypeScript interfaces and types (avoid `any` when possible)
- Enable strict mode (already configured in tsconfig.json)
- Use `type` for unions/intersections, `interface` for object shapes

```typescript
// Good
interface IImageDetailInfo {
  id: string
  name: string
  GPSInfo: IGPSInfo
  [key: string]: any
}

// Good - type alias for unions
type IShowType = "image" | "group" | "temporary-image"

// Bad
const something: any = {}
```

**Naming:**
- Components: PascalCase (`.vue` files), PascalCase in templates
- Variables/functions: camelCase
- Types/interfaces: PascalCase with `I` prefix (e.g., `IUserInfo`)
- Constants: SCREAMING_SNAKE_CASE
- CSS classes: kebab-case

**Vue SFCs:**
- Use `<script setup lang="ts">` composition API
- Define props with `defineProps` and type annotation
- Define emits with `defineEmits`
- Use `ref<T>()` and `reactive()` for reactive state
- Use `onMounted`, `onUnmounted`, `watch` lifecycle hooks

```typescript
// Props with type validation
const props = defineProps({
  imageIds: {
    type: Object as PropType<string[]>,
    default: () => []
  }
})

// Typed emits
const emit = defineEmits<{
  (e: 'markerClick', imageId: string): void
}>()

// Reactive state
const isFullscreen = ref(false)
const markers: L.Marker[] = []
```

### JavaScript (Backend)

**Imports:**
- Use CommonJS `require()` for backend modules
- Use `const` for imports

```javascript
// Good
const express = require('express')
const Result = require('./resultCode/result.js')
const { getImageFileById } = require('../utils/image/image.js')

// Bad
let express = require('express')
```

**Error Handling:**
- Backend routes: use try-catch and return `Result.fail()`
- Async handlers: catch errors and pass to `next()`
- Frontend: use `Promise.reject(error)` in interceptors

```javascript
// Backend route error handling
router.post('/getJPGImage', async function (req, res, next) {
  const form = new IncomingForm({ multiples: false })
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('解析上传文件失败:', err)
      res.send(Result.fail('解析上传文件失败'))
      return
    }
    // ...
  })
})

// Frontend interceptor
function (error) {
  ElMessage.error(error.msg ?? error.message)
  return Promise.reject(error)
}
```

**Result Pattern:**
- Backend uses `Result.success(data)` and `Result.fail(message)`
- Frontend expects response in `result.data` format

### File Headers

Files use comment headers for authorship tracking:
```javascript
/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-16 22:06:18
 * @FilePath: \PicMap\picMap_backend\routes\image.js
 * @Description: 图片相关接口
 */
```

### Styling

- Use SCSS with Element Plus theming
- Vue scoped styles with kebab-case class names
- Element Plus component styling via CSS variables

### Whitespace

- 必要的空格要有（如运算符两侧、逗号后、关键字与括号之间）
- 行尾不要有多余空格（trailing whitespace）
- 代码块内的空行不要超过一行

```vue
<style scoped>
.map {
  background-color: rgba(0, 0, 0, 0.9);
  transition: all 0.1s ease;
}
</style>
```

---

## Type Checking

```bash
# Frontend type check (vue-tsc)
cd picMap_fontend && npx vue-tsc --noEmit

# Full type check with vue-tsc
cd picMap_fontend && npx vue-tsc --noEmit --skipLibCheck
```

---

## Data Storage

- Default storage path: `D:\PicMap`
- Schema files: JSON format in user directories
- Images stored with ID-based filenames
- Thumbnails prefixed with `_THUMBNAIL_PM`

---

## API Conventions

Backend runs on port 5120. All API responses follow:
```javascript
{
  code: number,    // 0 = success, -1 = fail
  msg: string,
  data: any,
  time: number     // timestamp
}
```

User context passed via `currentUserId` in request body/params.

---

## Notes for Agents

- Do NOT modify the `dist/` directory directly (it's build output)
- All data is stored locally - no cloud/backend persistence
- GPX tracks auto-convert from WGS84 to GCJ02 for Chinese map providers
- Images require EXIF GPS data for auto-location
- Use `npm run install:all` for fresh dependency installation
- **性能优化**: 遵循 `PERFORMANCE.md` 中的规范，避免同步阻塞、无限制并发、大文件无限制等问题
