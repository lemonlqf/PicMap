# Tasks: Leaflet → MapLibre GL JS 地图渲染迁移

## 1. 性能 spike 验证（前置 gate）

- [ ] **1.1** 安装 `maplibre-gl` 依赖，移除 leaflet/leaflet.markercluster/leaflet-gpx
- [ ] **1.2** 搭建最小 MapLibre demo（高德瓦片 raster source + pitch 60° + 简单 marker）
- [ ] **1.3** 在 wails dev 的 WebView2 里实测俯仰角 + 拖动流畅度，确认 WebGL 上下文正常创建
- [ ] **1.4** 决策点：性能达标（≥30fps 或肉眼无卡顿）才继续，否则调整方案（降 pitch/关 antialias/限 maxZoom）

## 2. 核心迁移

- [ ] **2.1** 重写 `services/map.ts`：`L.Map` → `maplibregl.Map`，保留 initMapInstance/observeMapChangeToUpgradeMarker/setViewByLatLng 接口
- [ ] **2.2** 迁移瓦片图层：raster source + layer，显式 tileSize 256，切换先移除旧 layer+source
- [ ] **2.3** 迁移 `views/picMap/Map.vue` 与 `components/map/Map.vue`：`L.map` → `maplibregl.Map`，加 pitch
- [ ] **2.4** 迁移 `services/marker.ts` marker 渲染（先不做聚合）：`L.marker` → `Marker` + element，事件绑 element
- [ ] **2.5** 迁移 `services/track.ts` GPX 渲染：自写 GPX 解析 + GeoJSON line layer（统计逻辑保留）
- [ ] **2.6** 统一坐标反转：封装 toMapLibreLngLat，修正所有 [lat,lng] → [lng,lat]

## 3. 标记聚合攻坚

- [ ] **3.1** 引入 supercluster，实现图片点聚合（clusterRadius 50）
- [ ] **3.2** 聚合点 WebGL 渲染（circle + 数量文字），单点缩略图 DOM Marker
- [ ] **3.3** 聚合点点击展开、缩放重新聚合

## 4. 俯仰角 + 回归

- [ ] **4.1** 接入俯仰角调节 UI 控件（0-60°）
- [ ] **4.2** 全功能回归（上传、分组、时间轴、GPX、备份、右键菜单、多用户）
- [ ] **4.3** 验证 marker 120px 小图 + in-flight 去重在 MapLibre 下仍生效
