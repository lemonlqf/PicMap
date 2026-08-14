# Proposal: Leaflet → MapLibre GL JS 地图渲染迁移

## Why

当前地图使用 Leaflet（纯 2D），无法实现「倾斜视角看地图」（俯仰角 pitch）。用户需要 3D 俯仰视角以获得更直观的地形与空间关系展示，同时保留现有全部功能（瓦片、标记、聚合、GPX 轨迹、交互）。

## What Changes

- **地图渲染框架**：Leaflet → MapLibre GL JS（原生支持 pitch 0-60° 俯仰角、免费无 token、Vue 3 + TypeScript 生态成熟）
- **瓦片图层**：`L.tileLayer` → MapLibre `raster` source + layer，显式 `tileSize: 256`（国内高德/腾讯瓦片 256px，防偏移）
- **标记点**：`L.marker` + `L.divIcon` → MapLibre `Marker` + `element`（复用 `IconHTMLFactory`）
- **标记聚合**：`leaflet.markercluster` → `supercluster` 自实现（WebGL 渲染聚合点，单点缩略图用 DOM Marker）
- **GPX 轨迹**：`leaflet-gpx` → 自写解析 + GeoJSON `line` layer（统计逻辑保留）
- **俯仰角**：新增可调节俯仰角（0-60°）
- **依赖变更**：移除 `leaflet`/`leaflet.markercluster`/`leaflet-gpx`，新增 `maplibre-gl`（**BREAKING**）
- **坐标顺序**：Leaflet `[lat, lng]` → MapLibre `[lng, lat]`，数据层与渲染层边界统一反转

## Capabilities

### New Capabilities

- `map-rendering`: 地图渲染能力（瓦片、标记、聚合、GPX、俯仰角视角），覆盖从 Leaflet 到 MapLibre 的完整渲染迁移

### Modified Capabilities

<!-- 本次不改动业务能力（上传、分组、轨迹统计、备份），仅改渲染实现；spec 级行为不变。 -->

## Impact

- **前端核心服务层**：`services/map.ts`（~87 行重写）、`services/marker.ts`（~900 行重写）、`services/track.ts`（~709 行，渲染层重写）
- **视图组件**：`views/picMap/Map.vue`、`components/map/Map.vue`（`L.map` → `maplibregl.Map`）
- **依赖**：`package.json` 移除 leaflet 三件套，新增 `maplibre-gl`
- **框架无关层不变**：`utils/WGS84-GCJ02.ts`、`utils/iconHTML.ts`、`utils/Image.ts`、所有业务组件
- **性能风险**：WebView2 + UHD 630 集显跑 WebGL 俯仰角的流畅度需前置 spike 验证（未通过则方案调整）
