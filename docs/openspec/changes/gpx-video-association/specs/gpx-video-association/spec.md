# GPX 轨迹与轨迹视频统一关联上传能力规格

## Purpose

GPX 轨迹与轨迹视频统一关联上传能力负责把「轨迹」与「轨迹视频」统一管理。用户在同一入口可上传 GPX 轨迹、内嵌 GPS 的轨迹视频、以及关联 GPX 的普通视频。普通视频（无 GPS）不能单独上传，必须先选中一条已有 GPX 轨迹并建立一对一关联，通过自动解析或手动指定初始时间戳，使视频帧与 GPX 轨迹坐标一一对应。视频在轨迹上生成节点，一个 GPX 轨迹可挂多个视频。

## ADDED Requirements

### Requirement: 统一轨迹/轨迹视频上传入口

系统 SHALL 将原「轨迹上传」入口扩展为「轨迹/轨迹视频上传」入口，支持上传 GPX 轨迹、内嵌 GPS 的轨迹视频、以及关联 GPX 的普通视频。

#### Scenario: 上传 GPX 轨迹

- **WHEN** 用户通过统一入口上传 GPX 轨迹文件
- **THEN** 系统按现有轨迹流程导入 GPX，行为与原有轨迹上传一致

#### Scenario: 上传内嵌 GPS 视频

- **WHEN** 用户通过统一入口上传内嵌 GPS 的轨迹视频
- **THEN** 系统识别其为可独立的轨迹视频，允许单独导入

#### Scenario: 上传无 GPS 普通视频被拒绝单独上传

- **WHEN** 用户尝试单独上传无 GPS 的普通视频（未关联 GPX）
- **THEN** 系统拒绝并提示需先选择一个已有 GPX 轨迹进行关联

### Requirement: 普通视频关联 GPX

系统 SHALL 允许普通视频（无 GPS）关联一条已有的 GPX 轨迹，关联关系为一对一；一个 GPX 轨迹 SHALL 允许关联多个普通视频。

#### Scenario: 关联视频到 GPX

- **WHEN** 用户先选中一条已有 GPX 轨迹，再上传普通视频
- **THEN** 系统建立该视频与该 GPX 的一对一关联

#### Scenario: 一个 GPX 关联多个视频

- **WHEN** 用户向同一条 GPX 轨迹关联第二个普通视频
- **THEN** 系统允许关联，GPX 记录多个视频的引用

### Requirement: 视频初始时间戳对齐

系统 SHALL 在普通视频关联 GPX 时确定视频的初始时间戳，优先自动解析（metadata `creationdate` → 文件名时间），解析失败时 SHALL 允许用户手动指定。

#### Scenario: 自动解析初始时间戳

- **WHEN** 视频 metadata 含标准 `creationdate`，或文件名包含可识别的时间（如 `20260820_171710`）
- **THEN** 系统自动解析出视频起点绝对时刻，用于后续帧时间映射

#### Scenario: 手动指定初始时间戳

- **WHEN** 自动解析失败（无 creationdate 且文件名非时间格式）
- **THEN** 系统允许用户手动输入或从 GPX 时间轴拾取视频起点绝对时刻

### Requirement: 视频节点生成

系统 SHALL 将关联后的视频按其时间轴生成节点：帧绝对时刻 = 起点 + 帧相对时间（线性、无变速），映射到 GPX 轨迹对应坐标；节点展示类型 SHALL 可区分。

#### Scenario: 按 GPX 时间生成视频节点

- **WHEN** 视频已关联 GPX 且初始时间戳确定
- **THEN** 系统按视频时间轴生成节点，每节点坐标来自 GPX 对应时刻的线性插值

#### Scenario: 短视频至少一个节点

- **WHEN** 视频对应的 GPX 距离不足 50 米（如短时或静止拍摄）
- **THEN** 系统仍保证至少生成 1 个节点（视频起点处），作为视频入口，不因距离不足而消失

#### Scenario: 长视频按距离生成多节点

- **WHEN** 视频对应的 GPX 距离达到采样阈值
- **THEN** 系统按距离（默认 50 米）生成多个节点

#### Scenario: 节点展示类型

- **WHEN** 视频节点被创建
- **THEN** 节点记录展示类型 `viewType`（本次为 `image`），为后续 `panorama`（360 全景）预留

### Requirement: 视频 schema 与存储

系统 SHALL 将视频信息以 `VideoInfo` 存入 schema，视频原文件 SHALL 保存到用户视频目录 `videos/PM<id>.<ext>`；`TrackInfo`（GPX）SHALL 记录其关联的视频引用。

#### Scenario: 视频信息存入 schema

- **WHEN** 视频导入成功
- **THEN** 系统在 schema 的 `videoInfo` 数组中记录 `VideoInfo`（含 id、name、path、durationMs、trackId、startTimeMs、viewType、size 等字段）

#### Scenario: 视频文件保存位置

- **WHEN** 视频导入
- **THEN** 视频原文件复制到用户目录 `videos/PM<id>.<ext>`，路径由配置提供

#### Scenario: GPX 记录关联视频

- **WHEN** 视频关联到一条 GPX
- **THEN** 该 GPX 的 `videos` 字段记录 `{ videoId, timeOffsetMs }` 引用，一个 GPX 可挂多个视频

### Requirement: 视频删除与缓存清理

系统 SHALL 支持删除视频，删除时 SHALL 同步清理 GPX 上对该视频的引用以及磁盘上的视频原文件。

#### Scenario: 删除视频

- **WHEN** 用户删除一个已关联的视频
- **THEN** 系统从 schema 移除 `VideoInfo` 及 GPX 上的视频引用，并删除视频原文件

### Requirement: 视频不纳入备份

系统 SHALL 在创建备份与计算数据大小时排除视频目录 `videos/`，避免超大视频文件卡死备份流程。

#### Scenario: 创建备份排除视频

- **WHEN** 用户创建备份
- **THEN** 备份内容不包含视频原文件，备份流程正常完成

#### Scenario: 数据大小统计排除视频

- **WHEN** 系统计算数据大小用于备份告警
- **THEN** 视频目录不计入，500MB 告警阈值仅针对图片数据
