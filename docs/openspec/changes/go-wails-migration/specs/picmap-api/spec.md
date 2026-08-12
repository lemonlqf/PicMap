# PicMap API 迁移规格

## 概述

将 PicMap 后端从 Node.js Express 迁移至 Go (Wails 绑定)，保持 API 功能完全兼容，数据格式不变。

## ADDED: Go 后端 API

### 图片管理 API

#### UploadImages
- **输入**: userId (string), images ([]UploadImage)，每项含 id/name/url(base64)/thumbnailUrl(base64)
- **输出**: []UploadResult，每项含 id/thumbnailBase64
- **行为**: 并发处理（信号量 max=4），解码 base64 写入文件系统，生成缩略图（如提供）
- **验收**:
  - 上传 10 张 JPEG 图片，全部成功写入磁盘
  - 上传包含 HEIC 的混合格式，HEIC 转换失败不影响 JPEG 上传
  - 部分失败时返回成功的结果 + 错误详情

#### GetThumbnail / GetThumbnails
- **输入**: userId, imageId(s)
- **输出**: base64 字符串（或数组）
- **行为**: 先查找 `_THUMBNAIL_*` 文件，resize 到 width 1000；无缩略图则用原图 resize 到 width 800
- **验收**:
  - 已生成缩略图的图片返回缩略图版本
  - 无缩略图的 HEIC/RAW 返回空字符串（不阻塞）
  - 批量获取 20 张缩略图，全部成功

#### DeleteImages
- **输入**: userId, imageIds
- **输出**: 成功/失败计数
- **行为**: glob 匹配原始文件和缩略图文件，并行删除
- **验收**:
  - 删除后文件系统中不存在原始文件和缩略图
  - 部分文件不存在时不报错

#### ConvertImage
- **输入**: 图片二进制数据 + 文件名
- **输出**: JPEG 二进制数据
- **行为**: HEIC→ImageMagick, RAW→dcraw_emu 三层降级
- **验收**:
  - HEIC 文件转换成功返回 JPEG
  - 不支持的格式返回明确错误

### Schema 管理 API

#### GetSchema / SetSchema
- **输入**: userId (, schemaJSON for Set)
- **输出**: Schema 结构体 / 成功确认
- **行为**: 读取/原子写入（.tmp → Rename）schema.json
- **验收**:
  - 模拟进程崩溃，schema.json 保持完整
  - 不存在的用户自动创建默认 schema
  - 保留 `verison` 字段拼写

### 备份 API

#### ImportBackup (merge 模式)
- **行为**: 合并 schema.json（按 id 去重 imageInfo/groupInfo），仅复制新图片文件
- **验收**:
  - 已存在的图片不被重复复制
  - 已存在的分组不被重复添加
  - 新图片和新分组正确合并

### 数据兼容性

- **验收**:
  - 用 Node.js 版创建的完整数据目录启动 Go 版
  - 所有图片在正确 GPS 位置显示
  - 分组、轨迹、地图位置正确恢复
  - 时间轴筛选正常工作
