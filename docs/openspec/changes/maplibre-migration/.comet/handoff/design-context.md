# Comet Design Handoff

- Change: maplibre-migration
- Phase: design
- Mode: compact
- Context hash: dad15f2b455041e3405720149b4b404eaee8be6857cd03396614e66c894bb962

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## docs/openspec/changes/maplibre-migration/proposal.md

- Source: docs/openspec/changes/maplibre-migration/proposal.md
- Lines: 1-34
- SHA256: 78d0460891ae159d710aa31ce57288e2f326d9ad1e4767302bff934be6861b32

```md
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

```

## docs/openspec/changes/maplibre-migration/design.md

- Source: docs/openspec/changes/maplibre-migration/design.md
- Lines: 1-76
- SHA256: 4ba252bab10addce874f5dea736b55c5af5f5242b1a6888ce7c0eb53413e2eca

```md
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

```

## docs/openspec/changes/maplibre-migration/tasks.md

- Source: docs/openspec/changes/maplibre-migration/tasks.md
- Lines: 1-29
- SHA256: 6d3d35ef6a9f2c102dd72c773d27ac73c9a98ab84d4f87519b50baf78af648b5

```md
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

```

## docs/openspec/changes/maplibre-migration/specs/map-rendering/spec.md

- Source: docs/openspec/changes/maplibre-migration/specs/map-rendering/spec.md
- Lines: 1-96
- SHA256: c1a1f6513504d26e8f27bb7dce88e7a05be1f3121250c2ede0c790eff63c011f

[TRUNCATED]

```md
# 地图渲染能力规格

## Purpose

地图渲染能力负责在桌面应用内展示交互式地图，包括瓦片图层、图片与分组标记、标记聚合、GPX 轨迹以及可调节的倾斜俯仰视角。

## ADDED Requirements

### Requirement: 俯仰角视角

系统 SHALL 支持地图俯仰角（pitch）调节，范围为 0-60°，用户可倾斜视角查看地图。

#### Scenario: 调节俯仰角

- **WHEN** 用户调节俯仰角（0-60°）
- **THEN** 地图以对应倾斜角度渲染，视角发生变化且地图可用

#### Scenario: 俯仰角为 0 时

- **WHEN** 俯仰角设为 0°
- **THEN** 地图以正上方视角渲染（等价于传统 2D 视图）

### Requirement: 瓦片图层显示

系统 SHALL 正确渲染地图瓦片（高德、腾讯、OpenStreetMap、自定义瓦片），瓦片位置准确无偏移。

#### Scenario: 切换瓦片源

- **WHEN** 用户切换瓦片源（高德矢量/高德卫星/腾讯/OSM/自定义）
- **THEN** 新瓦片源正确渲染，无残留旧图层叠加

#### Scenario: 国内瓦片尺寸正确

- **WHEN** 渲染国内 256px 瓦片
- **THEN** 瓦片无错位、无模糊偏移

### Requirement: 图片与分组标记

系统 SHALL 在图片/分组的 GPS 坐标位置显示对应标记，标记使用缩略图或分组拼贴封面。

#### Scenario: 显示图片标记

- **WHEN** 图片有 GPS 坐标
- **THEN** 标记显示在该坐标位置，图标为该图片缩略图

#### Scenario: 显示分组标记

- **WHEN** 分组有 GPS 坐标且包含图片
- **THEN** 标记显示在坐标位置，图标为前若干张图片的拼贴封面

### Requirement: 标记聚合

系统 SHALL 在低缩放级别时聚合附近标记，聚合点显示数量，点击聚合点展开到该区域。

#### Scenario: 低缩放级别聚合

- **WHEN** 地图处于低缩放级别且多个标记位置接近
- **THEN** 附近标记聚合为一个聚合点，显示聚合数量

#### Scenario: 点击聚合点展开

- **WHEN** 用户点击聚合点
- **THEN** 地图缩放到该区域，聚合点展开为多个标记

### Requirement: GPX 轨迹显示

系统 SHALL 在地图上显示 GPX 轨迹线，含起终点标记，轨迹线颜色可自定义。

#### Scenario: 显示轨迹

- **WHEN** 用户导入 GPX 轨迹
- **THEN** 轨迹线显示在地图上，起终点标记正确

#### Scenario: 轨迹配色

- **WHEN** 用户修改轨迹线颜色
- **THEN** 轨迹线颜色更新为设定值

### Requirement: 标记交互


```

Full source: docs/openspec/changes/maplibre-migration/specs/map-rendering/spec.md
