# Design: Leaflet → MapLibre GL JS 地图渲染迁移

## Context

PicMap 地图目前基于 Leaflet（纯 2D），无法实现俯仰角视角。迁移到 MapLibre GL JS 后支持 pitch 0-60°。现有功能（瓦片、标记、聚合、GPX、交互）约 90% 可直接对应，10%（聚合 + GPX 解析）需自实现。

约束：WebView2 环境 + 用户 UHD 630 集显，WebGL 渲染性能是最大未知数。

## Goals / Non-Goals

**Goals:**
- 地图渲染框架迁移到 MapLibre，支持俯仰角（可调节 0-60°）
- 保留全部现有功能（瓦片、标记、聚合、GPX、交互）
- 复用框架无关层（坐标转换、HTML 图标、图片缓存、业务组件）

**Non-Goals:**
- 不改变业务能力（上传、分组、轨迹统计、备份）的 spec 级行为
- 不改变数据模型与磁盘格式
- 不做 3D 地形/建筑等超出「俯仰角视角」的范围

## Decisions

### D1. 框架选型：MapLibre GL JS

- 原生支持 pitch（0-60°），免费无 token
- 备选 Mapbox GL 需 token（否决）；Cesium 过重且集显跑不动（否决）

### D2. 瓦片图层：raster source + 显式 tileSize 256

- 国内高德/腾讯瓦片是 256px，MapLibre raster source 默认 512px，不指定会错位
- 切换瓦片先移除旧 layer + source，避免叠加

### D3. 标记点：Marker + element，事件直接绑 element

- MapLibre `Marker` 的 `element` 是持久引用，移动靠 `transform` 不重建，事件不丢
- 兜底：事件委托到地图容器（`data-marker-id` 标识）

### D4. 标记聚合：supercluster 自实现

- 用户明确选择 supercluster（非 MapLibre 内置 cluster）
- 聚合点用 WebGL（circle/symbol 图层）渲染避免 DOM 卡顿；单点缩略图用 DOM Marker

### D5. 坐标顺序统一反转

- Leaflet `[lat, lng]` → MapLibre `[lng, lat]`
- 在 marker.ts/map.ts 入口封装 `toMapLibreLngLat(lat, lng)`，避免散落各处遗漏

### D6. 性能 spike 前置 gate

- 阶段 1 先验证 WebView2 + 集显跑 MapLibre pitch 60° 拖动的流畅度
- 验收：≥ 30fps 或肉眼无明显卡顿，未通过则调整方案（降 pitch、关 antialias、限制 maxZoom）

### D7. 俯仰角交互：可调节

- 用户选择可调节，加 UI 控件调节 0-60°

## Risks / Trade-offs

- [WebView2 + UHD 630 集显跑 WebGL 俯仰角卡顿] → D6 性能 spike 前置 gate，未通过不继续
- [WebView2 WebGL 上下文兼容性（硬件加速开关、ANGLE 后端）] → spike 阶段一并验证，必要时 `--enable-webgl`
- [坐标反转遗漏（marker/center/bounds/GPX 散落 [lat,lng]）] → D5 统一封装 + 回归覆盖
- [supercluster 聚合逻辑重写工作量大（200-300 行）] → 独立阶段 3 攻坚
- [marker 事件在 MapLibre 下丢失] → D3 事件绑 element + 事件委托兜底
- [单点缩略图 DOM 数量随图片量级增长] → 图片量级不确定（Open Question），先 DOM Marker，若上千张再 WebGL 化单点

## Migration Plan

- **阶段 1 验证**：MapLibre demo spike，接入高德瓦片 + 俯仰角 + 简单 marker，集显实测性能，达标才继续
- **阶段 2 核心迁移**：map.ts / marker.ts（先不聚合）/ track.ts，修正坐标顺序
- **阶段 3 聚合攻坚**：supercluster 实现聚合 + 点击展开 + 缩放重聚合
- **阶段 4 俯仰角 + 回归**：俯仰角交互 UI + 全功能回归
- **回滚**：依赖与代码均在 Git 内，可回退到 Leaflet 版本；渲染层与业务层解耦，回滚不影响数据

## Open Questions

- 图片量级：单用户图片数量量级不确定。若上千张，单点缩略图 DOM 需评估是否 WebGL 化（不阻塞本方案，留待 spike 后按实测数据决定）
