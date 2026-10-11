---
comet_change: maplibre-migration
role: technical-design
canonical_spec: openspec
---

# 深度技术设计：Leaflet → MapLibre GL JS 地图渲染迁移

## 目标与非目标

**目标**：地图渲染框架从 Leaflet 迁移到 MapLibre GL JS，支持可调节俯仰角（0-60°），保留全部现有功能（瓦片、标记、聚合、GPX、交互）。

**非目标**：不改变业务能力 spec（上传、分组、轨迹统计、备份）、不改变数据模型与磁盘格式、不做 3D 地形/建筑。

## 架构与数据流

```
图片/分组数据 (schema)
  → marker.ts 渲染层（MapLibre Marker + element，IconHTMLFactory 复用）
  → 坐标转换层（toMapLibreLngLat: [lat,lng]→[lng,lat]）
  → 聚合层（supercluster 索引 GeoJSON）
  → map.ts（maplibregl.Map 生命周期、瓦片 source/layer、事件）

缩略图加载：getMarkerImageUrlById（120px 小图 + in-flight 去重 + 缓存）
瓦片：raster source（tileSize 256）+ layer
GPX：DOMParser 解析 → GeoJSON LineString → line layer（统计逻辑保留）
```

## 核心实现设计

### 1. 地图初始化

```typescript
const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] }, // 空样式
  center: [lng, lat],   // 注意 [lng, lat] 顺序
  zoom, minZoom: 3, maxZoom: 18,
  pitch: 45, bearing: 0,
  attributionControl: false,
})
```

### 2. 瓦片图层（tileSize 256 防偏移）

```typescript
function changeTile(url) {
  // 先移除旧 layer + source 避免叠加
  if (map.getLayer('tile-layer')) map.removeLayer('tile-layer')
  if (map.getSource('tile')) map.removeSource('tile')
  map.addSource('tile', { type: 'raster', tiles: [url], tileSize: 256 })
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })
}
```

关键：国内高德/腾讯瓦片 256px，MapLibre raster 默认 512px，必须显式 `tileSize: 256`。

### 3. 标记点（Marker + element，事件绑 element）

```typescript
const el = IconHTMLFactory.createIcon(IconType.SingleImage, imageUrl)
const marker = new Marker({ element: el, anchor: 'bottom' })
  .setLngLat([lng, lat]).addTo(map)
el.addEventListener('click', ...)      // element 持久引用，移动靠 transform 不重建
el.addEventListener('contextmenu', ...)
el.addEventListener('mouseover', ...)
```

兜底：事件委托到 `map.getContainer()`，用 `data-marker-id` 标识。

### 4. 聚合（supercluster 自实现）

- 数据流：图片点 → GeoJSON FeatureCollection（properties 带 id）→ `new Supercluster({ radius: 50, maxZoom: 14 })`
- 渲染：`moveend` 防抖 200ms → `index.getClusters(bbox, zoom)` → 聚合点 DOM Marker（数量徽标）+ 单点 DOM Marker（120px 缩略图）
- 聚合点点击 → `index.getClusterExpansionZoom(clusterId)` → `map.easeTo` 展开
- 复用：120px 小图 + in-flight 去重 + moveend 防抖（go-wails-migration 已实现）

### 5. GPX 轨迹

```typescript
const coords = parseGpx(gpxText)  // DOMParser 解析 trkpt → [lng, lat]（WGS84→GCJ02 后）
map.addSource('track-x', { type: 'geojson', data: { type: 'LineString', coordinates: coords } })
map.addLayer({ id: 'track-x', type: 'line', source: 'track-x', paint: { 'line-color': color, 'line-width': 3 } })
```

距离/配速/海拔/起终点统计逻辑全部保留，仅替换 leaflet-gpx 渲染部分。

### 6. 坐标反转（统一封装）

```typescript
function toMapLibreLngLat(lat: number, lng: number): [number, number] {
  return [lng, lat]
}
```

在 marker.ts / map.ts 入口统一封装，避免散落各处遗漏。schema 的 GPSInfo 和 DEFAULT_CENTER 是 [lat, lng]，在数据层→渲染层边界反转。

## 性能 spike 验证方法（前置 gate）

1. 临时在 Index.vue 挂载最小 maplibregl.Map（高德瓦片 + pitch 60° + 10 marker）
2. 检查 WebGL 上下文：`map.getCanvas().getContext('webgl2') || getContext('webgl')` 非 null
3. `requestAnimationFrame` 计数器测 pitch 拖动帧率，**验收 ≥ 30fps** 或肉眼无卡顿
4. WebGL 失败排查路径：WebView2 硬件加速 → `--disable-gpu` 检查 → ANGLE 后端（D3D11 vs 软件渲染）→ 降级（关 antialias / pitch 限 30° / maxZoom 16）

## 关键取舍与风险

| 风险 | 缓解 |
|------|------|
| WebView2 + UHD 630 集显 WebGL 俯仰角卡顿 | spike 前置 gate，未通过不继续 |
| WebView2 WebGL 上下文兼容性（硬件加速/ANGLE） | spike 一并验证，必要时 `--enable-webgl` |
| 坐标反转遗漏（marker/center/bounds/GPX） | 统一封装 + 回归覆盖 |
| supercluster 聚合重写工作量（200-300 行） | 独立阶段 3 攻坚 |
| marker 事件丢失 | 事件绑 element + 事件委托兜底 |
| 单点缩略图 DOM 数量随图片量级增长 | 先 DOM Marker，spike 后按实测决定是否 WebGL 化 |

## 测试策略

1. **spike gate**：帧率 ≥ 30fps + WebGL 上下文创建（Task 1.4 决策点）
2. **坐标反转回归**：marker 定位、center/setView、getBounds、GPX、fitBounds
3. **功能回归**：上传、分组、时间轴、GPX、备份、右键菜单、多用户（复用 go-wails-migration 遗留的 5 项 GUI 验证）
4. **数据兼容**：现有 D:\PicMap 数据启动，图片/分组/轨迹/地图位置正确恢复

## 实施阶段

- 阶段 1：性能 spike（依赖安装 + demo + WebView2 实测 + 决策 gate）
- 阶段 2：核心迁移（map.ts / 瓦片 / Map.vue / marker.ts / track.ts / 坐标反转）
- 阶段 3：聚合攻坚（supercluster + 展开 + 重聚合）
- 阶段 4：俯仰角 UI + 全功能回归
