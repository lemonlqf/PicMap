# Brainstorm Summary

- Change: maplibre-migration
- Date: 2026-08-14

## 确认的技术方案

Leaflet → MapLibre GL JS 地图渲染迁移，支持可调节俯仰角（0-60°）。核心：raster source + tileSize 256 防瓦片偏移；Marker + element 事件绑 element；supercluster 自实现聚合；坐标 [lat,lng]→[lng,lat] 统一封装；性能 spike 前置 gate。

## 关键取舍与风险

- WebView2 + UHD 630 集显 WebGL 俯仰角性能是最大风险 → spike 前置 gate（≥30fps）
- 图片量级不确定 → 先 DOM Marker，spike 后按实测决定是否 WebGL 化单点
- 聚合点用 DOM Marker（数量徽标）而非 WebGL 图层，复用 IconHTMLFactory
- 坐标反转是最大 bug 源 → 统一封装 toMapLibreLngLat

## 测试策略

1. spike gate：帧率 ≥ 30fps + WebGL 上下文创建验证
2. 坐标反转回归：marker/center/bounds/GPX/fitBounds
3. 全功能回归：上传、分组、时间轴、GPX、备份、右键、多用户

## Spec Patch

无（delta spec 已在 open 阶段创建完整，无需回写）
