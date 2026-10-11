---
change: maplibre-migration
design-doc: docs/superpowers/specs/2026-08-14-maplibre-migration-design.md
base-ref: 66a526d7d532b1035c00a18996beea782a43fd74
---

# Leaflet → MapLibre GL JS 地图渲染迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐个实现。步骤用 checkbox（`- [ ]`）语法跟踪。

**Goal:** 将地图渲染框架从 Leaflet 迁移到 MapLibre GL JS，支持 0-60° 俯仰角，保留全部现有功能（瓦片、标记、聚合、GPX、交互、多用户、备份）。

**Architecture:** 保留 marker/map/track 三个 service 的公开 API 不变，仅替换内部实现。引入 `toMapLibreLngLat` 统一处理 `[lat,lng]→[lng,lat]` 反转；引入 `MapMarkerAdapter` 让 `getMarkerById` 返回的对象对上层组件保持 Leaflet 风格接口（`options.id/type`、`getLatLng()`、`setIcon()`、`dragging`、`on('moveend')`），从而把 ~45 处组件调用点的影响降到最小。聚合用 supercluster 自实现。首个任务是性能 spike（前置 gate，需用户手动实测）。

**Tech Stack:** Vue 3 + TypeScript + Vite + Pinia，maplibre-gl（v4+，自带类型），supercluster（v8+，自带类型），Wails v2 + WebView2，Go 后端不变。

## Global Constraints

- 公开 service API 不能变：`mapService.{getMapInstance,initMapInstance,observeMapChangeToUpgradeMarker,setViewByLatLng}`、`markerService.{getMarkerById,getMarkerClusters,getGPSInfoByMarkerInstance,getPermanentType,getTemporaryType,addImageMarkerToMap,addGroupMarkerToMap,addExistImageMarkerToMapById,addManualLocateImageMarkerToMap,addManualLocateGroupMarkerToMap,deleteMarkerInMap,deleteMarkerById,hiddenMarkerById,showMarkerById,observeClisterClick,setViewByMarkerId,addVisibleMarkerById,isMarkerInCluster,updateVisibleMarkers,filterMarkersByTimeRange,resetIconGroupMarker,getGPSInfoById,scaleMarkerByMap,initMapInstance}`、`trackService.{activeTrack,hideTrack,hideAllTracks,showTrack,deleteTrack,deleteAllTracks,updateTrackColor,deleteTracksInMap,uploadTrack,getInstances,getTrackInstanceById}`。
- 每个任务结束都要保证 `npm run typecheck` 通过、`npm run build` 通过（这是本仓库唯一的静态验证手段，仓库无单元测试框架，勿新增测试框架）。
- 业务能力 spec（上传、分组、轨迹统计、备份）与数据模型、磁盘格式（`D:\PicMap` 目录结构）一律不变。
- 坐标规则：schema 的 `GPSInfo`、`DEFAULT_CENTER` 是 `[lat, lng]`；MapLibre 的 `center`/`setLngLat`/GeoJSON 坐标是 `[lng, lat]`。所有反转只能发生在数据层→渲染层边界，统一走 `toMapLibreLngLat`，禁止散落各处手写反转。
- 瓦片：高德/腾讯瓦片是 256px，MapLibre raster 默认 512px，必须显式 `tileSize: 256`。
- 依赖版本下限：`maplibre-gl@^4`、`supercluster@^8`。
- 所有坐标点按既有逻辑做 WGS84→GCJ02 转换（`wgs84ToGcj02`）后再交给渲染层；GPX 转换逻辑保留。
- 不要在 spike 通过前删除 `leaflet` 依赖（否则现有代码立即无法编译，破坏「每个任务可独立验证」原则）。

---

## 文件结构

| 文件 | 职责 | 变更 |
|------|------|------|
| `frontend/src/utils/mapLibre.ts` | 坐标转换封装 `toMapLibreLngLat` / `toLatLng` | 新建 |
| `frontend/src/services/markerAdapter.ts` | `MarkerIcon` 工厂（`createImageMarkerIcon`/`createGroupMarkerIcon`/`createGroupMarkerElement`）+ `MapMarkerAdapter` 类 | 新建 |
| `frontend/src/services/map.ts` | MapLibre 地图生命周期、瓦片 source/layer、事件（moveend 防抖） | 重写内部 |
| `frontend/src/services/marker.ts` | marker 渲染 + 聚合（supercluster）+ 隐藏/显示/筛选 | 重写内部 |
| `frontend/src/services/track.ts` | GPX 解析 + 统计计算 + GeoJSON line layer | 重写内部 |
| `frontend/src/views/picMap/Map.vue` | 主地图初始化 | 迁移 |
| `frontend/src/components/map/Map.vue` | 分组详情小地图 | 迁移 |
| `frontend/src/components/mapTileEditor/components/MapTileCard.vue` | 瓦片预览迷你地图 | 迁移 |
| `frontend/src/utils/group.ts` | `updateGroupMarkerImage` 用 `L.divIcon` → `createGroupMarkerElement` | 修改 |
| `frontend/src/style/marker.scss` | `.leaflet-*` 选择器 → 新类名 | 修改 |
| `frontend/src/components/__spike__/MapLibreSpike.vue` | 性能 spike 临时 demo（gate 后删除） | 新建后删除 |

---

## 阶段 1：性能 spike（前置 gate）

### Task 1: 性能 spike 验证（前置 gate）

**Files:**
- Create: `frontend/src/components/__spike__/MapLibreSpike.vue`
- Modify: `frontend/src/views/picMap/Index.vue`（临时挂载 spike 组件，gate 通过后移除）

**Interfaces:**
- Consumes: 无（纯新增）
- Produces: 决策结论「是否继续迁移」；通过后为后续任务安装好的 `maplibre-gl`、`supercluster` 依赖

- [ ] **Step 1: 安装依赖**

```powershell
cd frontend
npm install maplibre-gl supercluster
```

- [ ] **Step 2: 引入 MapLibre CSS**

在 `frontend/src/main.ts` 顶部（或 `Index.vue`）加入：

```typescript
import 'maplibre-gl/dist/maplibre-gl.css'
```

（先只加 CSS，spike 阶段不动 `leaflet` 依赖，保证现有代码仍可编译。）

- [ ] **Step 3: 编写最小 demo 组件**

创建 `frontend/src/components/__spike__/MapLibreSpike.vue`：

```vue
<template>
  <div class="spike-wrap">
    <div id="spike-map"></div>
    <div class="spike-panel">
      <span>FPS: {{ fps }}</span>
      <span>WebGL: {{ webglOk ? 'OK' : 'FAIL' }}</span>
      <input type="range" min="0" max="60" v-model.number="pitch" @input="setPitch" />
      <span>pitch={{ pitch }}°</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import maplibregl from 'maplibre-gl'

const AMAP_URL = 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'

let map: maplibregl.Map | null = null
const fps = ref(0)
const webglOk = ref(false)
const pitch = ref(45)

let frames = 0
let rafId = 0

function setPitch() {
  map?.setPitch(pitch.value)
}

function loop() {
  frames++
  rafId = requestAnimationFrame(loop)
}

onMounted(() => {
  map = new maplibregl.Map({
    container: 'spike-map',
    style: { version: 8, sources: {}, layers: [] },
    center: [120.2052342, 30.2489634],
    zoom: 10,
    minZoom: 3,
    maxZoom: 18,
    pitch: 45,
    bearing: 0,
    dragRotate: true,
    pitchWithRotate: true,
    attributionControl: false,
  })
  map.addSource('tile', { type: 'raster', tiles: [AMAP_URL], tileSize: 256 })
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })

  const canvas = map.getCanvas()
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  webglOk.value = !!gl

  for (let i = 0; i < 10; i++) {
    const el = document.createElement('div')
    el.style.cssText = 'width:40px;height:40px;background:#e74c3c;border-radius:50%;border:2px solid #fff'
    new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([120.2052342 + i * 0.01, 30.2489634 + i * 0.008])
      .addTo(map)
  }

  loop()
  setInterval(() => {
    fps.value = frames
    frames = 0
  }, 1000)
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  map?.remove()
  map = null
})
</script>

<style scoped>
.spike-wrap { position: relative; width: 100%; height: 100%; }
#spike-map { position: absolute; inset: 0; }
.spike-panel {
  position: absolute; top: 10px; left: 10px; z-index: 999;
  background: rgba(0,0,0,.75); color: #fff; padding: 8px 12px;
  border-radius: 6px; display: flex; flex-direction: column; gap: 6px;
  font-size: 14px;
}
</style>
```

- [ ] **Step 4: 临时挂载到主页面**

在 `frontend/src/views/picMap/Index.vue` 的 `<template>` 顶部（地图容器内）临时加入：

```vue
<MapLibreSpike />
```

并在 `<script setup>` 顶部 `import MapLibreSpike from '@/components/__spike__/MapLibreSpike.vue'`。

> 说明：与 `tasks.md 1.1`「移除 leaflet 依赖」的差异——此任务**不**删除 leaflet 依赖，只在 spike 通过后的最终清理任务（Task 8）统一删除，保证每个提交可编译。

- [ ] **Step 5: 类型检查 + 构建通过**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过（spike 组件为纯新增，不影响既有 leaflet 代码）。

- [ ] **Step 6: 在 wails dev 的 WebView2 里实测（需用户手动参与）**

```powershell
wails dev
```

用户手动验证清单（本步骤是 gate，必须由用户实测并记录结论）：

1. 高德瓦片正常加载，无白屏。
2. 面板 `WebGL` 显示 `OK`（`getContext('webgl2')` 或 `getContext('webgl')` 非 null）。
3. 拖动俯仰角滑块到 60°、来回拖动地图（右键/Ctrl+拖动旋转俯仰），观察 `FPS` 读数与肉眼流畅度。
4. **验收标准：FPS ≥ 30 或肉眼无卡顿**，且 WebGL 上下文创建成功。

- [ ] **Step 7: 决策点（gate）**

- 若达标 → 记录结论到 `docs/superpowers/specs/2026-08-14-maplibre-migration-design.md` 顶部追加一行「spike 结论」，继续 Task 2。
- 若 WebGL 上下文创建失败 → 按设计文档排查：WebView2 硬件加速开关 → `--disable-gpu` 交叉验证 → ANGLE 后端（D3D11 vs 软件渲染）→ 尝试 `--enable-webgl`。
- 若帧率不达标 → 依次尝试降级：`new maplibregl.Map({ antialias: false })` → 俯仰角限制 30° → `maxZoom: 16`，每改一项重新实测。
- **未通过不得进入阶段 2。**

- [ ] **Step 8: 提交**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/components/__spike__ frontend/src/views/picMap/Index.vue frontend/src/main.ts
git commit -m "feat(map): MapLibre 性能 spike demo（WebGL + 俯仰角帧率验证）"
```

---

## 阶段 2：核心迁移

### Task 2: 坐标转换封装 `utils/mapLibre.ts`

**Files:**
- Create: `frontend/src/utils/mapLibre.ts`

**Interfaces:**
- Consumes: `wgs84ToGcj02`（`@/utils/WGS84-GCJ02`，已存在）
- Produces:
  - `toMapLibreLngLat(lat: number, lng: number): [number, number]` —— 返回 `[lng, lat]`
  - `toLatLng(lngLat: [number, number]): { lat: number; lng: number }` —— 反向，用于 `getLatLng()` 适配

- [ ] **Step 1: 写文件**

```typescript
export function toMapLibreLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat]
}

export function toLatLng(lngLat: [number, number]): { lat: number; lng: number } {
  return { lat: lngLat[1], lng: lngLat[0] }
}
```

- [ ] **Step 2: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过。

- [ ] **Step 3: 提交**

```powershell
git add frontend/src/utils/mapLibre.ts
git commit -m "feat(map): 新增 MapLibre 坐标转换封装"
```

---

### Task 3: 重写 `services/map.ts`（地图生命周期）

**Files:**
- Modify: `frontend/src/services/map.ts`

**Interfaces:**
- Consumes: `toMapLibreLngLat`（Task 2）、`markerService.initMapInstance`（既有签名不变）
- Produces: `mapService` 公开方法不变，但 `MAP_INSTANCE` 类型由 `L.Map` 变为 `maplibregl.Map`；`initMapInstance(mapInstance: maplibregl.Map)`

- [ ] **Step 1: 重写 map.ts 内部实现**

```typescript
import maplibregl from 'maplibre-gl'

import markerService from '@/services/marker'
import eventBus from '@/utils/eventBus'
import { toMapLibreLngLat } from '@/utils/mapLibre'

class MapService {
  private MAP_INSTANCE: maplibregl.Map | null = null

  getMapInstance() {
    return this.MAP_INSTANCE
  }

  initMapInstance(mapInstance: maplibregl.Map) {
    if (!mapInstance) {
      throw new Error('地图实例不能为空')
    }
    this.MAP_INSTANCE = mapInstance
    markerService.initMapInstance(mapInstance)
  }

  observeMapChangeToUpgradeMarker() {
    setTimeout(() => {
      markerService.updateVisibleMarkers()
    }, 100)
    const map = this.MAP_INSTANCE
    let moveendTimer: ReturnType<typeof setTimeout> | null = null
    map?.on('moveend', () => {
      if (moveendTimer) {
        clearTimeout(moveendTimer)
      }
      moveendTimer = setTimeout(() => {
        moveendTimer = null
        markerService.updateVisibleMarkers()
      }, 200)
    })
    map?.on('movestart', () => {
      eventBus.emit('hidden-content-menu')
    })
  }

  setViewByLatLng(lat: number, lng: number) {
    const map = this.MAP_INSTANCE
    if (lat && lng) {
      map?.flyTo({
        center: toMapLibreLngLat(lat, lng),
        zoom: map.getZoom() ?? 10,
        duration: 500,
      })
    }
  }
}

const mapService = new MapService()

export default mapService
```

> 说明：`setView`（Leaflet）→ `flyTo`（MapLibre，等价动画效果）。`zoomend` 分支为空实现，已删除。

- [ ] **Step 2: 处理下游类型引用**

`marker.ts` 中的 `initMapInstance(mapInstance: L.Map)` 将在 Task 5 一并改为 `maplibregl.Map`。本任务提交前 `marker.ts` 尚未迁移，`markerService.initMapInstance` 仍声明为 `L.Map`，会产生类型不匹配。

**处理方式（本任务内先做类型桥接，保证可编译）**：在 `marker.ts` 的 `initMapInstance` 参数改为接受 `maplibregl.Map`（其内部 `this.MAP_INSTANCE` 类型暂用 `any` 过渡，Task 5 再彻底重写）：

```typescript
// marker.ts 临时改（Task 5 会重写整个文件）
initMapInstance(mapInstance: any) {
  if (!mapInstance) {
    throw new Error('地图实例不能为空')
  }
  this.MAP_INSTANCE = mapInstance
}
```

同时把 `marker.ts` 顶部 `private MAP_INSTANCE: L.Map | null;` 暂改为 `private MAP_INSTANCE: any;`。`markerClusters` 字段与其余方法本任务不动，仍用 Leaflet 实现（MapLibre 与 Leaflet 并存过渡期，map.ts 只负责主地图实例）。

> 关键：本任务结束时，主地图仍是 Leaflet 创建（`views/picMap/Map.vue` 未迁移），但 `mapService` 已面向 MapLibre API 编写。为避免双份维护，**Task 3 与 Task 4 必须合并提交**——Task 3 只改写代码，Task 4 迁移 `Map.vue` 创建 MapLibre 实例后一起验证。详见 Task 4 末尾的合并提交说明。

- [ ] **Step 3: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：Task 3 单独 typecheck 可能因 `views/picMap/Map.vue` 仍 `L.map` 传入 `initMapInstance` 而报错；与 Task 4 合并后应全部通过。**执行时按 Task 4 的合并提交要求统一验证。**

- [ ] **Step 4: 提交（与 Task 4 合并）**

见 Task 4 Step 3。

---

### Task 4: 迁移 `views/picMap/Map.vue` + 瓦片 raster layer

**Files:**
- Modify: `frontend/src/views/picMap/Map.vue`

**Interfaces:**
- Consumes: `mapService`（Task 3 新签名）、`toMapLibreLngLat`、`markerService`（既有）
- Produces: `Map.vue` 的 `defineExpose({ init, initTile, getMapInstance })` 不变；内部 `map` 为 `maplibregl.Map`

- [ ] **Step 1: 重写 Map.vue**

```vue
<template>
  <div id="map"></div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import maplibregl from 'maplibre-gl'
import mapService from '@/services/map'
import { useMapStore } from '../../store/map'
import markerService from '@/services/marker'
import { getGroupAndImageList } from '@/utils/schema'
import { hiddenImageInfoDrawerMapClick } from '@/utils/map'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constant'
import { toMapLibreLngLat } from '@/utils/mapLibre'

let map: maplibregl.Map | null = null

const props = defineProps({
  tileLayer: { type: Object, default: null },
  idList: { type: Array, default: () => [] },
  mapZoom: { type: Number, default: DEFAULT_ZOOM },
  mapCenter: { type: Array, default: () => DEFAULT_CENTER },
})

function initMap() {
  if (!map) {
    map = new maplibregl.Map({
      container: 'map',
      style: { version: 8, sources: {}, layers: [] },
      center: toMapLibreLngLat(props.mapCenter[0], props.mapCenter[1]),
      zoom: props.mapZoom,
      minZoom: 3,
      maxZoom: 18,
      pitch: 45,
      bearing: 0,
      zoomControl: false,
      attributionControl: false,
    })
    mapService.initMapInstance(map)
  } else {
    map.jumpTo({
      center: toMapLibreLngLat(props.mapCenter[0], props.mapCenter[1]),
      zoom: props.mapZoom,
    })
  }
}

let currentTileUrl: string | null = null

function initTile() {
  if (!map) return
  const url = props.tileLayer?.url
  if (!url) return
  if (currentTileUrl === url) return
  if (map.getLayer('tile-layer')) map.removeLayer('tile-layer')
  if (map.getSource('tile')) map.removeSource('tile')
  map.addSource('tile', { type: 'raster', tiles: [url], tileSize: 256 })
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })
  currentTileUrl = url
}

async function initMarker() {
  removeAllMarkers()
  const groupAndImageList = getGroupAndImageList()
  if (groupAndImageList?.length) {
    groupAndImageList.forEach((item) => {
      if (item.showType === 'group') {
        markerService.addGroupMarkerToMap(item)
      } else if (item.showType === 'image') {
        markerService.addImageMarkerToMap(item)
      }
    })
  }
}

function removeAllMarkers() {
  const mapStore = useMapStore()
  const markerClusters = markerService.getMarkerClusters()
  markerClusters && markerClusters.clearLayers()
  mapStore.init()
}

function getMapInstance() {
  return map
}

async function init() {
  initMap()
  initTile()
  initMarker()
  mapService.observeMapChangeToUpgradeMarker()
  hiddenImageInfoDrawerMapClick()
  markerService.observeClisterClick()
}

defineExpose({
  init,
  initTile,
  getMapInstance,
})
</script>

<style scoped>
#map {
  height: 100vh;
  width: 100vw;
}
</style>
```

> 说明：`props.mapCenter` 是 `[lat, lng]`（`DEFAULT_CENTER = [30.2489634, 120.2052342]`），初始化/跳转前统一走 `toMapLibreLngLat`。瓦片切换采用「先删旧 layer+source 再 add」避免叠加；`tileSize: 256` 显式声明。

- [ ] **Step 2: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过。若 `hiddenImageInfoDrawerMapClick`（`utils/map.ts`）仍调用 `map.on('click')`，MapLibre 同样支持，无需改动。

- [ ] **Step 3: 提交（合并 Task 3 + Task 4）**

```powershell
git add frontend/src/services/map.ts frontend/src/services/marker.ts frontend/src/views/picMap/Map.vue
git commit -m "feat(map): mapService 与主地图 Map.vue 迁移到 MapLibre（raster 瓦片 + tileSize 256）"
```

---

### Task 5: markerAdapter + 重写 `services/marker.ts`（先不做聚合）

**Files:**
- Create: `frontend/src/services/markerAdapter.ts`
- Modify: `frontend/src/services/marker.ts`

**Interfaces:**
- Consumes: `toMapLibreLngLat`、`IconHTMLFactory`（`@/utils/iconHTML`）、`MARKER_CONSTANT`/`imageMarkerTranslateY`/`groupMarkerTranslateY`（`@/utils/constant`）、`getImageUrl`/`getMarkerImageUrlById`/`getMarkerImageUrlByIds`（`@/utils/Image`）、`mapService`
- Produces（供上层 ~45 处调用点，签名不变）:
  - `markerService.getMarkerById(id)` 返回 `MapMarkerAdapter | undefined`
  - `MapMarkerAdapter` 暴露：`options: { id: string; type: string; draggable?: boolean; iconUrl?: string }`（`type`/`draggable` 可写）、`getLatLng(): { lat; lng; alt }`、`setLatLng(lat, lng)`、`setIcon(icon: MarkerIcon)`、`getElement(): HTMLElement`、`setZIndexOffset(n: number)`、`dragging: { enable(); disable() }`、`on(event, cb)`
  - `MarkerIcon = { element: HTMLElement; iconUrl?: string; imageUrls?: string[] }`
  - `createImageMarkerIcon(imageInfo): MarkerIcon`、`createGroupMarkerIcon(groupInfo): Promise<MarkerIcon>`、`createGroupMarkerElement(groupNumbers, imageUrls, name): MarkerIcon`
  - `getMarkerClusters()` 返回一个「直通」簇组 shim（本阶段不聚合，见 Step 2）

- [ ] **Step 1: 写 `markerAdapter.ts`**

```typescript
import maplibregl from 'maplibre-gl'

import IconHTMLFactory, { IconType } from '@/utils/iconHTML'
import {
  MARKER_CONSTANT,
  GROUP_CONSTANT,
  imageMarkerTranslateY,
  groupMarkerTranslateY,
} from '@/utils/constant'
import { getMarkerImageUrlByIds } from '@/utils/Image'
import type { IImageInfo, INewGroupFormData } from '@/type/schema'

export interface MarkerIcon {
  element: HTMLElement
  iconUrl?: string
  imageUrls?: string[]
}

export interface MarkerOptions {
  id: string
  type: string
  draggable?: boolean
  iconUrl?: string
}

export class MapMarkerAdapter {
  readonly options: MarkerOptions
  readonly mlMarker: maplibregl.Marker
  private icon: MarkerIcon
  dragging: { enable: () => void; disable: () => void }

  constructor(icon: MarkerIcon, lngLat: [number, number], options: MarkerOptions) {
    this.options = options
    this.icon = icon
    this.mlMarker = new maplibregl.Marker({
      element: icon.element,
      anchor: 'bottom',
      draggable: !!options.draggable,
    }).setLngLat(lngLat)
    this.dragging = {
      enable: () => this.mlMarker.setDraggable(true),
      disable: () => this.mlMarker.setDraggable(false),
    }
  }

  addTo(map: maplibregl.Map) {
    this.mlMarker.addTo(map)
    return this
  }

  remove() {
    this.mlMarker.remove()
  }

  getLatLng(): { lat: number; lng: number; alt: number } {
    const ll = this.mlMarker.getLngLat()
    return { lat: ll.lat, lng: ll.lng, alt: 0 }
  }

  setLatLng(lat: number, lng: number) {
    this.mlMarker.setLngLat([lng, lat])
  }

  setIcon(icon: MarkerIcon) {
    this.icon = icon
    this.mlMarker.setElement(icon.element)
  }

  getElement(): HTMLElement {
    return this.mlMarker.getElement()
  }

  setZIndexOffset(offset: number) {
    this.mlMarker.getElement().style.zIndex = String(offset)
  }

  on(event: string, cb: (...args: any[]) => void) {
    const el = this.mlMarker.getElement()
    if (event === 'moveend' || event === 'dragend') {
      this.mlMarker.on('dragend', () => cb())
    } else if (event === 'click') {
      el.addEventListener('click', (e) => cb(e))
    } else if (event === 'contextmenu') {
      el.addEventListener('contextmenu', (e) => cb(e))
    } else if (event === 'mouseover') {
      el.addEventListener('mouseover', (e) => cb(e))
    } else if (event === 'mouseout') {
      el.addEventListener('mouseout', (e) => cb(e))
    }
  }
}

export function createImageMarkerIcon(imageInfo: IImageInfo, imageUrl?: string): MarkerIcon {
  const url = imageUrl ?? imageInfo.url ?? ''
  if (!url) {
    return {
      element: IconHTMLFactory.createIcon(IconType.NoImage, imageInfo.name),
    }
  }
  return {
    element: IconHTMLFactory.createIcon(IconType.SingleImage, url),
    iconUrl: url,
  }
}

export async function createGroupMarkerIcon(groupInfo: INewGroupFormData): Promise<MarkerIcon> {
  const groupNumbers = groupInfo.groupNumbers
  if (groupNumbers && groupNumbers.length > 0) {
    const resImageUrls = await getMarkerImageUrlByIds(
      groupNumbers.slice(0, GROUP_CONSTANT.GROUP_COVER_NUMBER)
    )
    if (!resImageUrls || resImageUrls.length === 0) {
      return { element: IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name) }
    }
    const imageUrls = resImageUrls.map((item) => item)
    return {
      element: IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls, groupNumbers?.length ?? 0),
      imageUrls,
    }
  }
  return {
    element: IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name),
  }
}

export function createGroupMarkerElement(
  groupNumbers: string[],
  imageUrls: string[],
  name: string
): MarkerIcon {
  if (groupNumbers && groupNumbers.length > 0 && imageUrls && imageUrls.length > 0) {
    return {
      element: IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls, groupNumbers.length),
      imageUrls,
    }
  }
  return { element: IconHTMLFactory.createIcon(IconType.NoImageGroup, name) }
}
```

> 说明：`imageMarkerTranslateY`/`groupMarkerTranslateY` 由 `IconHTMLFactory` 内部使用（已 import 到 `iconHTML.ts`），`markerAdapter.ts` 无需再引；`MARKER_CONSTANT` 尺寸已由 `iconHTML.ts` 消费。上方 import 中仅保留实际用到的常量，避免未使用告警——按 typecheck 结果调整 import。

- [ ] **Step 2: 重写 `marker.ts`**

保持全部公开方法名与语义，内部改为：

- `private MAP_INSTANCE: maplibregl.Map | null`
- `private markers: Map<string, MapMarkerAdapter> = new Map()`（所有已创建 marker，含隐藏的）
- `private hiddenMarkerIds: Set<string> = new Set()`（替换 `hiddenMarkers: Map<string, L.Marker>`）
- `private clusterGroup`：直通 shim（阶段 2 不聚合），实现 `addLayer/removeLayer/getLayers/clearLayers/on`：

```typescript
import maplibregl from 'maplibre-gl'
import { ElMessage } from 'element-plus'

import mapService from '@/services/map'
import { useMapStore } from '@/store/map'
import { useSchemaStore } from '@/store/schema'
import {
  MapMarkerAdapter,
  createImageMarkerIcon,
  createGroupMarkerIcon,
  type MarkerIcon,
} from '@/services/markerAdapter'
import { getImageUrl, getMarkerImageUrlById } from '@/utils/Image'
import { judgeHadUploadImage } from '@/utils/schema'
import { getGroupIdsByImageId, getGroupInfoByGroupId } from '@/utils/group'
import eventBus from '@/utils/eventBus'
import { GPSInfoLegality } from '@/utils/map'
import { toMapLibreLngLat } from '@/utils/mapLibre'
import { MAP_CONSTANT, MARKER_CONSTANT } from '@/utils/constant'
import type { IImageInfo, INewGroupFormData, IGroupInfo, IGPSInfo } from '@/type/schema'

class ClusterGroupShim {
  private clusterMembers: Set<MapMarkerAdapter> = new Set()
  private map: maplibregl.Map | null = null

  constructor(map: maplibregl.Map | null) {
    this.map = map
  }

  addLayer(marker: MapMarkerAdapter) {
    this.clusterMembers.add(marker)
    if (this.map && !this.isOnMap(marker)) {
      marker.addTo(this.map)
    }
  }

  removeLayer(marker: MapMarkerAdapter) {
    this.clusterMembers.delete(marker)
    marker.remove()
  }

  getLayers(): MapMarkerAdapter[] {
    return Array.from(this.clusterMembers)
  }

  clearLayers() {
    this.clusterMembers.forEach((m) => m.remove())
    this.clusterMembers.clear()
  }

  on(_event: string, _cb: (...args: any[]) => void) {
    // 阶段 2 无聚合，无 clusterclick 事件；阶段 3 重写
  }

  isOnMap(marker: MapMarkerAdapter): boolean {
    const el = marker.getElement()
    return !!el && !!el.parentNode
  }
}

class MarkerService {
  private MAP_INSTANCE: maplibregl.Map | null = null
  private markers: Map<string, MapMarkerAdapter> = new Map()
  private hiddenMarkerIds: Set<string> = new Set()
  private clusterGroup: ClusterGroupShim = new ClusterGroupShim(null)

  getMarkerClusters() {
    return this.clusterGroup
  }

  initMapInstance(mapInstance: maplibregl.Map) {
    if (!mapInstance) {
      throw new Error('地图实例不能为空')
    }
    this.MAP_INSTANCE = mapInstance
    this.clusterGroup = new ClusterGroupShim(mapInstance)
  }

  getMarkerById(markerId: string): MapMarkerAdapter | undefined {
    return this.markers.get(markerId)
  }

  getGPSInfoByMarkerInstance(marker: MapMarkerAdapter): IGPSInfo {
    if (!marker) {
      ElMessage.error('没有传入marker实例')
      return { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 }
    }
    const { lat, lng } = marker.getLatLng()
    return { GPSLatitude: lat, GPSLongitude: lng, GPSAltitude: 0 }
  }

  addImageMarkerToMap(imageInfo: IImageInfo) {
    const mapStore = useMapStore()
    if (!imageInfo.GPSInfo.GPSLatitude || !imageInfo.GPSInfo.GPSLongitude) return
    const existing = this.markers.get(imageInfo.id)
    if (existing) {
      existing.setIcon(createImageMarkerIcon(imageInfo, getImageUrl(imageInfo.id) ?? imageInfo.url))
      return
    }
    const icon = createImageMarkerIcon(imageInfo, getImageUrl(imageInfo.id) ?? imageInfo.url)
    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude),
      { id: imageInfo.id, type: 'image', iconUrl: icon.iconUrl }
    )
    this.markers.set(imageInfo.id, marker)
    this.clusterGroup.addLayer(marker)
    this.markerMouseListener(marker)
    mapStore.addMarkerId(imageInfo.id)
  }

  async addGroupMarkerToMap(groupInfo: IGroupInfo) {
    if (!GPSInfoLegality(groupInfo.GPSInfo)) return
    const mapStore = useMapStore()
    const icon = await createGroupMarkerIcon(groupInfo)
    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(groupInfo.GPSInfo.GPSLatitude, groupInfo.GPSInfo.GPSLongitude),
      { id: groupInfo.id, type: 'group' }
    )
    this.markers.set(groupInfo.id, marker)
    if (groupInfo.visible === false) {
      this.hiddenMarkerIds.add(groupInfo.id)
    } else {
      marker.addTo(this.MAP_INSTANCE!)
    }
    this.markerMouseListener(marker)
    mapStore.addMarkerId(groupInfo.id)
  }

  addExistImageMarkerToMapById(imageId: string) {
    const schemaStore = useSchemaStore()
    const mapStore = useMapStore()
    if (!mapStore.visibleMarkerIdList.includes(imageId)) {
      const imageInfo = schemaStore.getSchema.imageInfo?.filter((item: IImageInfo) => item.id === imageId)[0]
      if (imageInfo) {
        this.addImageMarkerToMap(imageInfo)
      }
      this.addVisibleMarkerById(imageId)
    } else {
      this.showMarkerById(imageId)
    }
  }

  addManualLocateImageMarkerToMap(imageInfo: IImageInfo, lat?: number, lng?: number) {
    const existing = this.getMarkerById(imageInfo.id)
    if (existing) {
      this.setViewByMarkerId(imageInfo.id)
      ElMessage.warning('节点已存在！，请编辑已有节点')
      return
    }
    const map = this.MAP_INSTANCE!
    const icon = createImageMarkerIcon(imageInfo, getImageUrl(imageInfo.id) ?? imageInfo.url)
    const center = map.getCenter()
    const markerLatLng: [number, number] = lat && lng
      ? toMapLibreLngLat(lat, lng)
      : [center.lng, center.lat]
    const marker = new MapMarkerAdapter(icon, markerLatLng, {
      id: imageInfo.id,
      type: 'temporary-image',
      draggable: true,
    })
    this.markers.set(imageInfo.id, marker)
    marker.addTo(map)
    this.markerMouseListener(marker)
    return marker
  }

  async addManualLocateGroupMarkerToMap(groupInfo: INewGroupFormData, lat?: number, lng?: number) {
    const existing = this.getMarkerById(groupInfo.id)
    if (existing) {
      this.setViewByMarkerId(groupInfo.id)
      ElMessage.warning('节点已存在！，请编辑已有节点')
      return
    }
    const map = this.MAP_INSTANCE!
    const icon = await createGroupMarkerIcon(groupInfo)
    const center = map.getCenter()
    const markerLatLng: [number, number] = lat && lng
      ? toMapLibreLngLat(lat, lng)
      : [center.lng, center.lat]
    const marker = new MapMarkerAdapter(icon, markerLatLng, {
      id: groupInfo.id,
      type: 'temporary-group',
      draggable: true,
    })
    this.markers.set(groupInfo.id, marker)
    marker.addTo(map)
    this.markerMouseListener(marker)
    return marker
  }

  deleteMarkerInMap(marker: MapMarkerAdapter) {
    const mapStore = useMapStore()
    if (!marker) return
    const id = marker.options.id
    this.clusterGroup.removeLayer(marker)
    marker.remove()
    this.markers.delete(id)
    this.hiddenMarkerIds.delete(id)
    mapStore.deleteMarker(id)
  }

  deleteMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId)
    if (marker) this.deleteMarkerInMap(marker)
  }

  hiddenMarkerById(markerId: string, hiddenGroupMarker: boolean = true) {
    const marker = this.getMarkerById(markerId)
    if (!marker) {
      console.warn('Marker not found when hiding:', markerId)
      return
    }
    const markerType = marker.options.type
    const isImage = markerType === 'image' || markerType === 'temporary-image'
    const isGroup = markerType === 'group' || markerType === 'temporary-group'
    if (isImage) {
      this.clusterGroup.removeLayer(marker)
      this.hiddenMarkerIds.add(markerId)
    } else if (isGroup && hiddenGroupMarker) {
      marker.remove()
      this.hiddenMarkerIds.add(markerId)
    }
  }

  showMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId)
    if (marker) {
      const markerType = marker.options.type
      const isImage = markerType === 'image' || markerType === 'temporary-image'
      const isGroup = markerType === 'group' || markerType === 'temporary-group'
      if (isImage) {
        const layers = this.clusterGroup.getLayers()
        if (!layers.includes(marker)) {
          this.clusterGroup.addLayer(marker)
          this.hiddenMarkerIds.delete(markerId)
        }
      } else if (isGroup) {
        if (!this.hiddenMarkerIds.has(markerId)) {
          marker.addTo(this.MAP_INSTANCE!)
        }
      }
    }
  }

  observeClisterClick() {
    // 阶段 2 无聚合；阶段 3 重写为 cluster click → expansion zoom
  }

  setViewByMarkerId(id: string) {
    if (!id) return
    let marker = this.getMarkerById(id)
    if (!marker) {
      const groupId = getGroupIdsByImageId(id)?.[0]
      groupId && (marker = this.getMarkerById(groupId))
    }
    if (!marker) return
    const { lat, lng } = marker.getLatLng()
    mapService.setViewByLatLng(lat, lng)
  }

  addVisibleMarkerById(markerId: string) {
    const mapStore = useMapStore()
    mapStore.addVisibleMarkerId(markerId)
    const marker = this.getMarkerById(markerId)
    this.markerMouseListener(marker)
  }

  isMarkerInCluster(marker: MapMarkerAdapter): boolean {
    const layers = this.clusterGroup.getLayers()
    return layers.includes(marker) && this.hiddenMarkerIds.has(marker.options.id)
  }

  updateVisibleMarkers() {
    const mapStore = useMapStore()
    const visibleMarkerIdList = mapStore.getVisibleMarkerIdList
    mapStore.getMarkerIdList.forEach((markerId: string) => {
      const marker = this.getMarkerById(markerId)
      if (marker && this.isMarkerInView(marker)) {
        if (!visibleMarkerIdList.includes(markerId)) {
          if (marker.options.type === 'image') {
            this.updateImageMarker(marker)
          }
          if (marker.options.type === 'group') {
            this.updateGroupMarker(marker)
          }
          this.addVisibleMarkerById(markerId)
        }
      }
    })
  }

  async updateImageMarker(marker: MapMarkerAdapter) {
    const mapStore = useMapStore()
    const index = mapStore.getVisibleMarkerIdList.findIndex(
      (markerId: string) => markerId === marker.options.id
    )
    const isInSchema = judgeHadUploadImage(marker.options.id)
    if (index === -1 && marker.options.iconUrl) return
    if (index === -1 && isInSchema) {
      const fileUrl = await getMarkerImageUrlById(marker.options.id)
      if (!fileUrl || fileUrl === '') {
        mapStore.deleteVisbleMarkerId(marker.options.id)
        return
      }
      marker.setIcon({
        element: (await import('@/utils/iconHTML')).default.createIcon(
          (await import('@/utils/iconHTML')).IconType.SingleImage,
          fileUrl
        ),
        iconUrl: fileUrl,
      })
    }
  }

  updateGroupMarker(_marker: MapMarkerAdapter) {
    // 分组封面更新逻辑保持惰性，阶段 4 回归时确认
  }

  isMarkerInView(marker: MapMarkerAdapter) {
    if (!marker || !this.MAP_INSTANCE) return false
    const bounds = this.MAP_INSTANCE.getBounds()
    const { lat, lng } = marker.getLatLng()
    return bounds.contains([lng, lat])
  }

  markerMouseListener(marker: MapMarkerAdapter) {
    if (!marker) return
    marker.on('click', (event: MouseEvent) => {
      eventBus.emit('show-image-data', event)
    })
    marker.on('contextmenu', (event: MouseEvent) => {
      eventBus.emit('show-content-menu', event)
    })
    marker.on('mouseover', () => {
      this.highlightMarker(marker)
    })
    marker.on('mouseout', () => {
      this.resetMarker(marker)
    })
  }

  highlightMarker(marker: MapMarkerAdapter) {
    const el = marker.getElement()
    if (el) {
      const old = el.style.transform
      const next = old.includes('scale')
        ? old.replace(/scale\([^)]*\)/, `scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`).trim()
        : `${old} scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`
      el.style.transform = next
    }
  }

  resetMarker(marker: MapMarkerAdapter) {
    const el = marker.getElement()
    if (el) {
      el.style.transform = el.style.transform
        .replace(/scale\([^)]*\)/, `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`)
        .trim()
    }
  }

  async resetIconGroupMarker(groupId: string) {
    const groupMarker = this.getMarkerById(groupId)
    const groupInfo = getGroupInfoByGroupId(groupId)
    const newIcon = await createGroupMarkerIcon(groupInfo)
    groupMarker && groupMarker.setIcon(newIcon)
  }

  filterMarkersByTimeRange(timeRange: { min: number; max: number }) {
    const schemaStore = useSchemaStore()
    this.markers.forEach((marker) => {
      const markerId = marker.options.id
      const markerType = marker.options.type
      const isImage = markerType === 'image' || markerType === 'temporary-image'
      if (isImage) {
        const imageInfo = schemaStore.getSchema.imageInfo?.find((img) => img.id === markerId)
        const imageTime = imageInfo?.authorInfo?.DateTime
        if (imageTime && typeof imageTime === 'number' && !isNaN(imageTime)) {
          if (imageTime >= timeRange.min && imageTime <= timeRange.max) {
            this.showMarkerById(markerId)
          } else {
            this.hiddenMarkerById(markerId, false)
          }
        } else {
          this.showMarkerById(markerId)
        }
      }
    })
  }

  getPermanentType(markerType: string) {
    return markerType.replace('temporary-', '')
  }

  getTemporaryType(markerType: string) {
    if (markerType.includes('temporary-')) return markerType
    return `temporary-${markerType}`
  }

  getGPSInfoById(markerId: string) {
    const marker = this.getMarkerById(markerId)
    return marker ? this.getGPSInfoByMarkerInstance(marker) : { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 }
  }

  scaleMarkerByMap() {
    // MapLibre marker 缩放动效由 hover 的 transform 处理，保留空实现
  }
}

const markerService = new MarkerService()

export default markerService
```

> 实现要点：
> 1. `isMarkerInCluster` 语义由「是否暂存在聚合组且被隐藏」承载；阶段 2 直通 shim 下，隐藏即从 map 移除并记入 `hiddenMarkerIds`。
> 2. `updateImageMarker` 用 `IconHTMLFactory` 重新构建 element 后 `setIcon`，与旧的 `marker.setIcon(divIcon)` 等价；120px 小图 + in-flight 去重由 `getMarkerImageUrlById` 保证（无需改动 `utils/Image.ts`）。
> 3. 删除 `import 'leaflet.markercluster'` 及两个 MarkerCluster CSS、`import L from 'leaflet'`、`import 'leaflet.markercluster/dist/...'`。
> 4. `updateImageMarker` 中为避免动态 import 的笨拙写法，直接在文件顶部 `import IconHTMLFactory, { IconType } from '@/utils/iconHTML'` 后使用 `IconHTMLFactory.createIcon(IconType.SingleImage, fileUrl)`。

- [ ] **Step 3: 修正 `TemporaryMarkerContentMenu.vue` 与 `markerOperate.ts` 对簇组的调用**

`TemporaryMarkerContentMenu.vue` 第 58-59 行 `markerClusters.addLayer(marker)` 在阶段 2 仍可用（shim 支持 `addLayer`），无需改动。`markerOperate.ts` 的 `marker.dragging.enable()` 由 adapter 支持，无需改动。

- [ ] **Step 4: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过。`npm run build` 会因 `utils/group.ts` 与 `components/map/Map.vue` 仍引用 leaflet 而失败——这两个文件分别在 Task 6/Task 7 迁移。**本任务通过 `vue-tsc` 单独验证后，leaflet 依赖仍在，`vite build` 仍可过**（leaflet 尚未删除）。若 build 因某处类型报错，逐条修复后再提交。

- [ ] **Step 5: 提交**

```powershell
git add frontend/src/services/markerAdapter.ts frontend/src/services/marker.ts
git commit -m "feat(map): markerService 迁移到 MapLibre Marker + adapter（直通簇组，暂不聚合）"
```

---

### Task 6: 重写 `services/track.ts`（GPX 解析 + 统计 + GeoJSON line layer）

**Files:**
- Modify: `frontend/src/services/track.ts`

**Interfaces:**
- Consumes: `wgs84ToGcj02`、`toMapLibreLngLat`、`useSchemaStore`、`API`
- Produces: `trackService` 公开方法不变；`TrackInstance` 公开方法不变（`addMap`、`removeMap`、`getMapInstances`、`getTrackId`、`getTrackLayer`、`getTrackInfo`、`getLineColor`、`setLineColor`、`setHoverCallback`、`setClickCallback`、`highlight`、`unhighlight`、`onTrackInfoReady`、`initTrackInfo`）；内部 `L.GPX` → MapLibre GeoJSON source + line layer

- [ ] **Step 1: 删除旧依赖引入**

移除 `import '@/assets/leaflet-gpx/leaflet-gpx.js'` 与 `import L from 'leaflet'`；起终点图标改用 MapLibre Marker element：

```typescript
import maplibregl from 'maplibre-gl'
import { wgs84ToGcj02 } from '@/utils/WGS84-GCJ02'
import API from '@/wails/api'
import { getDefaultLineColor } from '@/utils/track'
import { useSchemaStore } from '@/store/schema'
import { toMapLibreLngLat } from '@/utils/mapLibre'

const startIconUrl = new URL('../assets/icon/起点.png', import.meta.url).href
const endIconUrl = new URL('../assets/icon/终点.png', import.meta.url).href

function createEdgeMarkerElement(url: string, className: string): HTMLElement {
  const el = document.createElement('div')
  el.className = `track-marker-icon ${className}`
  const img = document.createElement('img')
  img.src = url
  img.width = 25
  img.height = 41
  el.appendChild(img)
  return el
}
```

- [ ] **Step 2: 新增 GPX 解析 + 统计纯函数**

```typescript
interface GpxPoint {
  lat: number
  lng: number
  ele: number | null
  time: number | null
  hr: number | null
  cadence: number | null
  temp: number | null
}

function parseGpxPoints(gpxText: string): GpxPoint[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(gpxText, 'text/xml')
  const points: GpxPoint[] = []
  doc.querySelectorAll('trkpt').forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '0')
    const lon = parseFloat(pt.getAttribute('lon') || '0')
    const [gcjLng, gcjLat] = wgs84ToGcj02(lon, lat)
    const ele = pt.getElementsByTagName('ele')[0]?.textContent
    const time = pt.getElementsByTagName('time')[0]?.textContent
    const hr = pt.getElementsByTagName('hr')[0]?.textContent
    const cad = pt.getElementsByTagName('cad')[0]?.textContent
    const temp = pt.getElementsByTagName('atemp')[0]?.textContent
    points.push({
      lat: Number(gcjLat),
      lng: Number(gcjLng),
      ele: ele ? parseFloat(ele) : null,
      time: time ? new Date(time).getTime() : null,
      hr: hr ? parseFloat(hr) : null,
      cadence: cad ? parseFloat(cad) : null,
      temp: temp ? parseFloat(temp) : null,
    })
  })
  return points
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function computeTrackInfo(points: GpxPoint[]): Partial<TrackInfo> {
  let distance = 0
  let movingTime = 0
  let elevationGain = 0
  let elevationLoss = 0
  let elevationMin = Infinity
  let elevationMax = -Infinity
  let speedMax = 0
  let startTime: number | null = null
  let endTime: number | null = null
  let hrSum = 0
  let hrCount = 0
  let cadSum = 0
  let cadCount = 0
  let tempSum = 0
  let tempCount = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const seg = haversine(prev.lat, prev.lng, cur.lat, cur.lng)
    distance += seg
    if (cur.ele != null) {
      const delta = cur.ele - (prev.ele ?? cur.ele)
      if (delta > 0) elevationGain += delta
      if (delta < 0) elevationLoss += -delta
      elevationMin = Math.min(elevationMin, cur.ele)
      elevationMax = Math.max(elevationMax, cur.ele)
    }
    if (prev.time != null && cur.time != null) {
      const dt = (cur.time - prev.time) / 1000
      const totalTime = dt
      const speed = seg / Math.max(totalTime, 0.001)
      if (speed < 3) movingTime += dt
      if (speed > speedMax) speedMax = speed
    }
    if (cur.hr != null) { hrSum += cur.hr; hrCount++ }
    if (cur.cadence != null) { cadSum += cur.cadence; cadCount++ }
    if (cur.temp != null) { tempSum += cur.temp; tempCount++ }
  }

  if (points.length > 0) {
    startTime = points[0].time
    endTime = points[points.length - 1].time
    if (points[0].ele != null) {
      elevationMin = Math.min(elevationMin, points[0].ele)
      elevationMax = Math.max(elevationMax, points[0].ele)
    }
  }

  const totalTime = startTime != null && endTime != null ? (endTime - startTime) / 1000 : 0
  const movingPace = movingTime > 0 ? (movingTime * 1000) / Math.max(distance, 0.001) : 0
  const movingSpeed = movingTime > 0 ? (distance / 1000) / (movingTime / 3600) : 0
  const totalSpeed = totalTime > 0 ? (distance / 1000) / (totalTime / 3600) : 0

  return {
    distance,
    startTime: startTime != null ? new Date(startTime) : undefined,
    endTime: endTime != null ? new Date(endTime) : undefined,
    movingTime: movingTime * 1000,
    totalTime: totalTime * 1000,
    movingPace,
    movingSpeed,
    totalSpeed,
    elevationMin: elevationMin === Infinity ? 0 : elevationMin,
    elevationMax: elevationMax === -Infinity ? 0 : elevationMax,
    elevationGain,
    elevationLoss,
    speedMax,
    averageHr: hrCount > 0 ? hrSum / hrCount : null,
    averageCadence: cadCount > 0 ? cadSum / cadCount : null,
    averageTemp: tempCount > 0 ? tempSum / tempCount : null,
  }
}
```

> 说明：`speed < 3`（m/s，约 10.8km/h）作为「移动中」阈值近似 leaflet-gpx 的 moving 判定；若需与旧行为完全一致，可在阶段 4 回归时校准阈值。名称字段 `name` 保留由 `initTrackInfo` 从 schema 注入。

- [ ] **Step 3: 重写 `TrackInstance` 渲染为 MapLibre source + layer**

关键改动：

```typescript
class TrackInstance {
  private trackId: string
  private layerByMap: WeakMap<maplibregl.Map, { sourceId: string; layerId: string }> = new WeakMap()
  private trackInfo: Partial<TrackInfo> = {}
  private mapInstances: maplibregl.Map[] = []
  private pendingCallbacks: ((trackInfo: any) => void)[] = []
  private options: any
  private points: GpxPoint[] = []
  private coordinates: [number, number][] = []
  private lineColor: string | undefined = getDefaultLineColor(true)
  private hoverCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>, event: 'enter' | 'leave') => void> = new Map()
  private clickCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>) => void> = new Map()
  private highlightedMapId: string | null = null
  private edgeMarkers: Map<maplibregl.Map, maplibregl.Marker[]> = new Map()

  private hashTrackId(seed: string) {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  setLineColor(color: string | undefined) {
    this.lineColor = color
    this.mapInstances.forEach((map) => {
      const layerId = this.layerByMap.get(map)?.layerId
      if (layerId && map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', color ?? getDefaultLineColor(true))
      }
    })
  }

  constructor(file: File, maps: maplibregl.Map[] = [], options: any = defaultOptions, schemaTrackInfo?: any) {
    this.trackId = file.name
    this.options = options
    this.mapInstances.push(...maps.filter((m): m is maplibregl.Map => !!m))
    if (schemaTrackInfo) {
      this.initTrackInfo(schemaTrackInfo)
    }
    this.readFileAsText(file).then((fileContent) => {
      this.points = parseGpxPoints(fileContent)
      this.coordinates = this.points.map((p) => toMapLibreLngLat(p.lat, p.lng))
      this.mapInstances.forEach((map) => {
        if (map) this.addMap(map)
      })
    })
  }

  private createLayerForMap(map: maplibregl.Map) {
    const hash = this.hashTrackId(this.trackId)
    const sourceId = `track-src-${hash}`
    const layerId = `track-layer-${hash}`
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: this.coordinates } },
      })
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': this.lineColor ?? getDefaultLineColor(true),
          'line-width': 3,
          'line-opacity': 0.8,
        },
      })
    }
    map.on('mouseenter', layerId, () => {
      const cb = this.hoverCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), 'enter')
    })
    map.on('mouseleave', layerId, () => {
      const cb = this.hoverCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), 'leave')
    })
    map.on('click', layerId, () => {
      const cb = this.clickCallbacks.get(map)
      if (cb) cb(this.getTrackInfo())
    })
    this.addEdgeMarkers(map)
    if (!this.trackInfo.name) {
      this.trackInfo = { ...this.trackInfo, ...computeTrackInfo(this.points) }
      this.pendingCallbacks.forEach((cb) => cb(this.trackInfo))
      this.pendingCallbacks = []
    }
    return { sourceId, layerId }
  }

  private addEdgeMarkers(map: maplibregl.Map) {
    if (this.points.length === 0) return
    const start = this.points[0]
    const end = this.points[this.points.length - 1]
    const startEl = createEdgeMarkerElement(startIconUrl, 'track-marker-start')
    const endEl = createEdgeMarkerElement(endIconUrl, 'track-marker-end')
    const startMarker = new maplibregl.Marker({ element: startEl, anchor: 'bottom' })
      .setLngLat(toMapLibreLngLat(start.lat, start.lng))
      .addTo(map)
    const endMarker = new maplibregl.Marker({ element: endEl, anchor: 'bottom' })
      .setLngLat(toMapLibreLngLat(end.lat, end.lng))
      .addTo(map)
    this.edgeMarkers.set(map, [startMarker, endMarker])
  }

  addMap(map: maplibregl.Map) {
    if (!map) return
    if (!this.mapInstances.includes(map)) this.mapInstances.push(map)
    if (this.coordinates.length === 0) return
    let ref = this.layerByMap.get(map)
    if (!ref) {
      ref = this.createLayerForMap(map)
      this.layerByMap.set(map, ref)
    }
  }

  getTrackLayer(map?: maplibregl.Map) {
    if (map) return this.layerByMap.get(map)
    return this.layerByMap.values().next().value
  }

  removeMap(map: maplibregl.Map) {
    const ref = this.layerByMap.get(map)
    if (ref) {
      if (map.getLayer(ref.layerId)) map.removeLayer(ref.layerId)
      if (map.getSource(ref.sourceId)) map.removeSource(ref.sourceId)
    }
    const markers = this.edgeMarkers.get(map)
    if (markers) {
      markers.forEach((m) => m.remove())
      this.edgeMarkers.delete(map)
    }
    this.layerByMap.delete(map)
    this.hoverCallbacks.delete(map)
    this.clickCallbacks.delete(map)
    const index = this.mapInstances.indexOf(map)
    if (index !== -1) this.mapInstances.splice(index, 1)
  }

  highlight(map: maplibregl.Map, mapId: string) {
    if (this.highlightedMapId === mapId) return
    this.unhighlight()
    this.highlightedMapId = mapId
    const layerId = this.layerByMap.get(map)?.layerId
    if (layerId && map.getLayer(layerId)) {
      map.setPaintProperty(layerId, 'line-color', '#409eff')
      map.setPaintProperty(layerId, 'line-width', 6)
      map.setPaintProperty(layerId, 'line-opacity', 1)
    }
  }

  unhighlight() {
    if (!this.highlightedMapId) return
    this.mapInstances.forEach((map) => {
      const layerId = this.layerByMap.get(map)?.layerId
      if (layerId && map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'line-color', this.lineColor ?? getDefaultLineColor(true))
        map.setPaintProperty(layerId, 'line-width', 3)
        map.setPaintProperty(layerId, 'line-opacity', 0.8)
      }
    })
    this.highlightedMapId = null
  }

  // getMapInstances / getTrackId / getTrackInfo / getLineColor / setHoverCallback / setClickCallback / onTrackInfoReady / initTrackInfo / readFileAsText 保持不变
}
```

> 说明：`TrackInfo` 接口与 `TrackService` 类的其余部分（`activeTrack`/`hideTrack`/`hideAllTracks`/`showTrack`/`deleteTrack`/`deleteAllTracks`/`updateTrackColor`/`deleteTracksInMap`/`uploadTrack`/`getInstances`/`getTrackInstanceById`）保持不变，仅类型 `L.Map` → `maplibregl.Map`。`convertGpxCoordinates`/`convertDocCoordinates` 已删除（坐标转换内联进 `parseGpxPoints`）。

- [ ] **Step 4: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：`track.ts` 无 leaflet 引用；`components/map/Map.vue` 仍用 leaflet（Task 7 迁移），故 `vite build` 仍可过（leaflet 未删）。若有类型报错逐条修复。

- [ ] **Step 5: 提交**

```powershell
git add frontend/src/services/track.ts
git commit -m "feat(map): trackService 迁移到 MapLibre GeoJSON line layer（自实现 GPX 解析 + 统计）"
```

---

### Task 7: 迁移 `components/map/Map.vue`（分组详情小地图）

**Files:**
- Modify: `frontend/src/components/map/Map.vue`

**Interfaces:**
- Consumes: `toMapLibreLngLat`、`trackService`（Task 6 新签名）、`getMarkerImageUrlById`、`IconHTMLFactory`、`MARKER_CONSTANT`/`imageMarkerTranslateY`
- Produces: `defineExpose({ invalidateMapSize, getMapInstance, fitAllBounds })` 不变；内部 `map` 为 `maplibregl.Map`，`markers` 数组为 `maplibregl.Marker[]`

- [ ] **Step 1: 替换地图初始化**

```typescript
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// ... 移除 import L from 'leaflet' 与 import 'leaflet/dist/leaflet.css'
```

`initMap()` 改为：

```typescript
async function initMap() {
  if (!mapContainer.value) return
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: { version: 8, sources: {}, layers: [] },
    center: toMapLibreLngLat(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
    zoom: DEFAULT_ZOOM,
    minZoom: 3,
    maxZoom: 18,
    zoomControl: false,
    attributionControl: false,
  })
  mapInstanceIdMap.set(map, String(++mapIdCounter))
  const tileUrl = getCurrentTileUrl()
  map.addSource('tile', { type: 'raster', tiles: [tileUrl], tileSize: 256 })
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })
  await updateMarkers()
  await updateTracks()
  invalidateMapSize()
}
```

`invalidateMapSize` 改为调用 `map.resize()`：

```typescript
function invalidateMapSize() {
  setTimeout(() => {
    map?.resize()
  }, 100)
}
```

- [ ] **Step 2: 迁移 `fitAllBounds` 与 marker 渲染**

`fitAllBounds` 用 `L.latLngBounds` → `maplibregl.LngLatBounds`：

```typescript
function fitAllBounds() {
  if (!map) return
  map.resize()
  const bounds = new maplibregl.LngLatBounds()
  markers.forEach((marker) => {
    bounds.extend(marker.getLngLat())
  })
  trackService.getInstances().forEach((instance) => {
    const trackLayer = instance.getTrackLayer(map)
    if (trackLayer && map.getLayer(trackLayer.layerId)) {
      // 轨迹边界由坐标数组计算
      const coords = (map.getSource(trackLayer.sourceId) as any)?.serialize?.()?.data?.geometry?.coordinates ?? []
      coords.forEach((c: [number, number]) => bounds.extend(c))
    }
  })
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 20 })
  } else {
    map.jumpTo({ center: toMapLibreLngLat(DEFAULT_CENTER[0], DEFAULT_CENTER[1]), zoom: DEFAULT_ZOOM })
  }
}
```

`updateMarkers` 中 `L.marker` → `maplibregl.Marker`（element 由 `IconHTMLFactory` 构建，`anchor: 'bottom'`）；`clearMarkers` 用 `marker.remove()`。hover 用 `marker.getElement()` 直接改 `style.transform`（与 `marker.ts` 的 `highlightMarker` 一致），`setZIndexOffset` 改 `marker.getElement().style.zIndex`。

- [ ] **Step 3: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过。至此主地图、小地图、track 均已迁移，仅剩 `MapTileCard.vue` 与 `utils/group.ts` 仍引用 leaflet（Task 8）。

- [ ] **Step 4: 提交**

```powershell
git add frontend/src/components/map/Map.vue
git commit -m "feat(map): 分组详情小地图迁移到 MapLibre"
```

---

### Task 8: 清理剩余 Leaflet 引用 + 删除依赖

**Files:**
- Modify: `frontend/src/components/mapTileEditor/components/MapTileCard.vue`
- Modify: `frontend/src/utils/group.ts`
- Modify: `frontend/src/style/marker.scss`
- Modify: `frontend/src/views/picMap/Index.vue`（移除 `import 'leaflet/dist/leaflet.css'`）
- Delete: `frontend/src/assets/leaflet-gpx/leaflet-gpx.js`（若目录为空则一并删除）
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `createGroupMarkerElement`（Task 5）、`toMapLibreLngLat`
- Produces: 移除 leaflet / leaflet-gpx / leaflet.markercluster 依赖后，`npm run build` 通过

- [ ] **Step 1: 迁移 `MapTileCard.vue`（瓦片预览迷你地图）**

`initMap`/`initTile` 改为 MapLibre：

```typescript
import maplibregl from 'maplibre-gl'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constant'
import { toMapLibreLngLat } from '@/utils/mapLibre'

let map: maplibregl.Map | null = null
function initMap() {
  if (!map) {
    map = new maplibregl.Map({
      container: mapRef.value,
      style: { version: 8, sources: {}, layers: [] },
      center: toMapLibreLngLat(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
      zoom: DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
    })
  }
}

function initTile() {
  if (!map) return
  if (map.getLayer('tile-layer')) map.removeLayer('tile-layer')
  if (map.getSource('tile')) map.removeSource('tile')
  map.addSource('tile', { type: 'raster', tiles: [props.url], tileSize: 256 })
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })
}
```

移除 `import L from 'leaflet'`。

- [ ] **Step 2: 迁移 `utils/group.ts` 的 `updateGroupMarkerImage`**

移除 `import L from 'leaflet'`，将 `L.divIcon(...)` 替换为：

```typescript
import { createGroupMarkerElement } from '@/services/markerAdapter'

export async function updateGroupMarkerImage(groupInfo: IGroupInfo) {
  if (!isGroupIdExist(groupInfo.id)) {
    console.error('分组不存在')
    return
  }
  const groupMark = markerService.getMarkerById(groupInfo.id)
  const resImageUrls = await getMarkerImageUrlByIds(groupInfo.groupNumbers.slice(0, GROUP_CONSTANT.GROUP_COVER_NUMBER))
  if (!resImageUrls || resImageUrls.length === 0) {
    ElMessage.error('获取图片失败')
    return
  }
  const icon = createGroupMarkerElement(groupInfo.groupNumbers, resImageUrls, groupInfo.name)
  groupMark?.setIcon?.(icon)
}
```

> 注意：`createGroupMarkerElement` 在 `markerAdapter.ts` 中未 import `markerService`，避免与 `marker.ts` 的循环依赖恶化；`group.ts` 本身已 import `markerService`，此处新增 import 无循环风险。

- [ ] **Step 3: 迁移 `style/marker.scss` 的 `.leaflet-*` 选择器**

将 `.leaflet-div-icon`、`.leaflet-marker-icon`、`.leaflet-marker-draggable` 等选择器替换为 `.maplibregl-marker .image-icon`、`.maplibregl-marker` 及自定义类名：

```scss
// 隐藏 div 元素外边框
.maplibregl-marker .image-icon {
  border: unset;
}

.maplibregl-marker {
  .image-icon {
    border-radius: 3px;
    object-fit: cover;
    border: 2px solid $border-color;
  }
}
```

保留 `.image-icon`、`.location`、`.group-location`、`.group-count-badge`、`.track-marker-*` 等自定义类（MapLibre Marker 的 DOM 结构不含 `.leaflet-*`，自定义类继续生效）。

- [ ] **Step 4: 移除 Index.vue 的 leaflet CSS**

删除 `frontend/src/views/picMap/Index.vue` 第 54 行 `import 'leaflet/dist/leaflet.css'`，替换为 `import 'maplibre-gl/dist/maplibre-gl.css'`（若 Task 1 已在 main.ts 引入，则此处直接删除该行）。

- [ ] **Step 5: 删除依赖**

```powershell
cd frontend
npm uninstall leaflet leaflet-gpx leaflet.markercluster
```

删除 `frontend/src/assets/leaflet-gpx/`（含 `leaflet-gpx.js`）。

- [ ] **Step 6: 全量搜索确认无残留引用**

```powershell
cd frontend
rg "leaflet" src --stats
```

预期：`src` 下无 `leaflet` 引用（`maplibre-gl` 之外的残留）。若仍有，逐一清理。

- [ ] **Step 7: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过。

- [ ] **Step 8: wails dev 冒烟验证（阶段 2 完成检查点）**

```powershell
wails dev
```

手动验证：主地图瓦片加载、图片/分组 marker 显示、点击/右键菜单、GPX 轨迹显示与 hover 卡片、分组详情小地图、设置页瓦片预览。

- [ ] **Step 9: 提交**

```powershell
git add frontend/src/components/mapTileEditor/components/MapTileCard.vue frontend/src/utils/group.ts frontend/src/style/marker.scss frontend/src/views/picMap/Index.vue frontend/package.json frontend/package-lock.json
git rm -r frontend/src/assets/leaflet-gpx
git commit -m "feat(map): 清理全部 Leaflet 引用与依赖"
```

---

## 阶段 3：标记聚合攻坚

### Task 9: supercluster 聚合 + 展开

**Files:**
- Modify: `frontend/src/services/marker.ts`
- Modify: `frontend/src/services/markerAdapter.ts`（如需要新增 `createClusterMarkerElement`）

**Interfaces:**
- Consumes: `supercluster`（Task 1 已安装）、`toMapLibreLngLat`、`getMarkerImageUrlById`
- Produces: `markerService.getMarkerClusters()` 返回真正的聚合层对象（对外方法 `addLayer/removeLayer/getLayers/clearLayers/on('clusterclick')` 不变）；`observeClisterClick` 实现展开逻辑

- [ ] **Step 1: 引入 supercluster 并建立图片点索引**

在 `marker.ts` 顶部：

```typescript
import Supercluster from 'supercluster'
```

新增字段与索引构建：

```typescript
interface ClusterProps { id: string }

class MarkerService {
  private imagePoints: Array<GeoJSON.Feature<GeoJSON.Point, ClusterProps>> = []
  private clusterIndex: Supercluster<ClusterProps, Supercluster.AnyProps> | null = null
  private clusterMarkers: maplibregl.Marker[] = []
  private singleMarkersOnMap: Set<string> = new Set()
  // ...

  private rebuildIndex() {
    this.imagePoints = []
    this.markers.forEach((marker) => {
      const type = marker.options.type
      if (type === 'image' || type === 'temporary-image') {
        const { lat, lng } = marker.getLatLng()
        this.imagePoints.push({
          type: 'Feature',
          properties: { id: marker.options.id },
          geometry: { type: 'Point', coordinates: [lng, lat] },
        })
      }
    })
    this.clusterIndex = new Supercluster({ radius: 50, maxZoom: 14, minZoom: 0 })
    this.clusterIndex.load(this.imagePoints)
  }

  private renderClusters() {
    if (!this.MAP_INSTANCE || !this.clusterIndex) return
    const map = this.MAP_INSTANCE
    const bounds = map.getBounds()
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]
    const zoom = Math.floor(map.getZoom())
    const clusters = this.clusterIndex.getClusters(bbox, zoom)

    this.clusterMarkers.forEach((m) => m.remove())
    this.clusterMarkers = []
    this.singleMarkersOnMap.forEach((id) => {
      const marker = this.markers.get(id)
      marker?.remove()
    })
    this.singleMarkersOnMap.clear()

    clusters.forEach((cluster) => {
      const count = cluster.properties?.point_count ?? 1
      if (count > 1) {
        const el = this.createClusterElement(count)
        const m = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(cluster.geometry.coordinates as [number, number])
          .addTo(map)
        el.addEventListener('click', () => {
          const expansionZoom = this.clusterIndex!.getClusterExpansionZoom(cluster.id as number)
          map.easeTo({ center: cluster.geometry.coordinates as [number, number], zoom: expansionZoom })
        })
        this.clusterMarkers.push(m)
      } else {
        const id = (cluster as any).properties.id
        const marker = this.markers.get(id)
        if (marker && !this.hiddenMarkerIds.has(id)) {
          marker.addTo(map)
          this.singleMarkersOnMap.add(id)
        }
      }
    })
  }

  private createClusterElement(count: number): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cluster-marker'
    el.innerHTML = `<div class="cluster-badge">${count > 99 ? '99+' : count}</div>`
    return el
  }
}
```

- [ ] **Step 2: 接入 moveend 防抖重渲染**

`ClusterGroupShim` 替换为真聚合层（保留 `addLayer/removeLayer/getLayers/clearLayers/on` 签名，`on('clusterclick')` 注册回调）：

```typescript
class ClusterGroup {
  private map: maplibregl.Map | null = null
  private members: Set<string> = new Set()
  private clusterClickHandler: ((id: string) => void) | null = null

  constructor(map: maplibregl.Map | null) { this.map = map }

  addLayer(marker: MapMarkerAdapter) {
    this.members.add(marker.options.id)
  }
  removeLayer(marker: MapMarkerAdapter) {
    this.members.delete(marker.options.id)
  }
  getLayers(): MapMarkerAdapter[] {
    return Array.from(this.members)
      .map((id) => markerService.getMarkerById(id))
      .filter((m): m is MapMarkerAdapter => !!m)
  }
  clearLayers() {
    this.members.clear()
  }
  on(event: string, cb: (id: string) => void) {
    if (event === 'clusterclick') this.clusterClickHandler = cb
  }
  emitClusterClick(id: string) {
    this.clusterClickHandler?.(id)
  }
  getMembers() { return this.members }
}
```

在 `observeMapChangeToUpgradeMarker`（`map.ts`）的 moveend 防抖回调里，除了 `updateVisibleMarkers()`，追加 `markerService.renderClusters()`；或在 `markerService.updateVisibleMarkers()` 末尾直接调用 `this.rebuildIndex(); this.renderClusters()`（聚合与缩略图加载统一触发）。**选择后者**：`updateVisibleMarkers()` 末尾追加：

```typescript
this.rebuildIndex()
this.renderClusters()
```

- [ ] **Step 3: `observeClisterClick` 实现展开**

```typescript
observeClisterClick() {
  // 展开逻辑已内联到 renderClusters 的 cluster element click 中
}
```

即展开逻辑在 `renderClusters` 的聚合点 element click 里完成（`getClusterExpansionZoom` + `easeTo`），`observeClisterClick` 保留空实现（`views/picMap/Map.vue` 仍在调用它，签名不变）。

- [ ] **Step 4: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

预期：通过。

- [ ] **Step 5: wails dev 验证聚合**

```powershell
wails dev
```

手动验证：缩小地图（低 zoom）出现数量徽标聚合点；点击聚合点平滑展开（easeTo）；放大到高 zoom 出现 120px 单点缩略图；缩放/拖动时聚合点与单点随 moveend 防抖重算。

- [ ] **Step 6: 提交**

```powershell
git add frontend/src/services/marker.ts frontend/src/services/markerAdapter.ts
git commit -m "feat(map): supercluster 图片点聚合 + 点击展开"
```

---

## 阶段 4：俯仰角 UI + 全功能回归

### Task 10: 俯仰角调节 UI + 全功能回归

**Files:**
- Modify: `frontend/src/views/picMap/Index.vue`（或独立控件组件）
- Modify: `frontend/src/services/map.ts`（新增 `setPitch` 透传，可选）

**Interfaces:**
- Consumes: `mapService.getMapInstance()`、`maplibregl.Map.setPitch`
- Produces: 俯仰角调节控件（0-60°），不改动既有 service 签名

- [ ] **Step 1: 新增俯仰角控件**

在 `Index.vue` 添加滑块（或新建 `components/map/PitchControl.vue`）：

```vue
<template>
  <div class="pitch-control">
    <span>俯仰角</span>
    <el-slider v-model="pitch" :min="0" :max="60" :step="5" @input="onPitchChange" />
    <span>{{ pitch }}°</span>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import mapService from '@/services/map'

const pitch = ref(45)
function onPitchChange(v: number) {
  mapService.getMapInstance()?.setPitch(v)
}
</script>
```

- [ ] **Step 2: 类型检查 + 构建**

```powershell
cd frontend
npm run typecheck
npm run build
```

- [ ] **Step 3: 全功能回归（复用 go-wails-migration 遗留的 GUI 验证 + 设计文档测试策略）**

在 `wails dev` 下逐项验证并记录：

1. 图片上传（含 HEIC/RAW 缩略图、EXIF GPS 解析、手动定位）。
2. 分组创建/解散/编辑/配色、分组可见性开关。
3. 时间轴筛选（`filterMarkersByTimeRange`）。
4. GPX 上传、显示、hover 卡片、详情面板、轨迹配色、起终点标记。
5. 备份/恢复（覆盖 + 合并模式）。
6. 右键菜单（删除、设置分组、定位、固定位置 `marker.dragging`）。
7. 多用户切换数据隔离。
8. 地图位置保存/恢复、瓦片切换（高德/百度/OSM/自定义）。
9. 坐标反转回归：marker 定位、center/setView、fitBounds、GPX、`setViewByLatLng` 均落在正确位置（重点核对 GCJ02 与 `[lng,lat]` 顺序）。
10. 俯仰角拖动 0-60° 流畅、无 marker 事件丢失（点击/右键/hover）。
11. marker 120px 小图 + in-flight 去重仍生效（快速缩放时 DevTools 网络面板无重复请求）。

- [ ] **Step 4: 数据兼容验证**

用现有 `D:\PicMap` 数据启动，确认图片/分组/轨迹/地图位置正确恢复，schema 无需迁移。

- [ ] **Step 5: 提交**

```powershell
git add frontend/src/views/picMap/Index.vue frontend/src/services/map.ts
git commit -m "feat(map): 接入俯仰角调节控件（0-60°）"
```

---

## Self-Review

**1. Spec coverage（对照设计文档与 tasks.md）：**
- 设计 §1 地图初始化（`maplibregl.Map` + pitch）→ Task 4 ✓
- 设计 §2 瓦片 tileSize 256 → Task 4 + Task 7 + Task 8（MapTileCard）✓
- 设计 §3 Marker + element 事件 → Task 5 ✓
- 设计 §4 supercluster → Task 9 ✓
- 设计 §5 GPX → Task 6 ✓
- 设计 §6 坐标反转 → Task 2 ✓
- 性能 spike gate → Task 1 ✓（对应 tasks.md 1.1-1.4）
- 俯仰角 UI → Task 10 ✓（对应 tasks.md 4.1）
- 全功能回归 → Task 10 ✓（对应 tasks.md 4.2）
- 120px 小图 + in-flight 去重验证 → Task 10 Step 3.11 ✓（对应 tasks.md 4.3）

**2. Placeholder scan:** 无 TBD/TODO；所有代码步骤均有完整实现代码。

**3. Type consistency:**
- `toMapLibreLngLat(lat, lng)` / `toLatLng(lngLat)` 签名在 Task 2 定义，Task 3/4/5/6/7/8 引用一致 ✓
- `MapMarkerAdapter` 方法名 `setIcon/getLatLng/getElement/setZIndexOffset/dragging/on` 与 marker.ts、group.ts、contentMenu 调用点一致 ✓
- `getMarkerClusters()` 返回值在阶段 2 为 `ClusterGroupShim`、阶段 3 为 `ClusterGroup`，两者均暴露 `addLayer/removeLayer/getLayers/clearLayers/on`，上层调用不受影响 ✓
- `trackService` / `TrackInstance` 公开方法名不变，`getTrackLayer(map)` 返回对象由 `L.GPX` 变为 `{ sourceId, layerId }`，Task 7 的 `fitAllBounds` 已适配新结构 ✓
- `mapService.setViewByLatLng` 参数 `(lat, lng)` 语义不变（仍传入 `[lat,lng]` 语义的两个参数），内部走 `toMapLibreLngLat` ✓

**遗留校准项（阶段 4 回归时确认，不影响编译）：**
- GPX `movingTime` 的「移动中」速度阈值（`speed < 3`）可能与 leaflet-gpx 原实现存在细微差异，回归阶段 4 校准。
- supercluster 聚合点样式（circle + 数量文字）当前用 DOM 徽标实现，若阶段 4 帧率仍不达标，再按设计文档评估 WebGL circle layer 化。
