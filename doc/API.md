# PicMap API 接口文档

## 概述

PicMap 是一个图片标注与管理平台的后端 API 服务，提供用户管理、图片上传下载、数据备份等功能。

**Base URL**: `http://localhost:3000`

---

## 通用说明

### 响应格式

所有接口响应均采用统一 JSON 格式：

```json
{
  "code": 200,
  "msg": "成功",
  "data": {},
  "time": 1704067200000
}
```

### 状态码说明

| code  | 说明           |
|-------|----------------|
| 200   | 成功           |
| 400   | 参数校验失败   |
| 404   | 接口不存在     |
| 429   | 操作过于频繁   |
| 500   | 服务器内部错误 |

---

## 目录

- [用户管理接口](#用户管理接口)
- [图片接口](#图片接口)
- [Schema 接口](#schema-接口)
- [应用配置接口](#应用配置接口)
- [备份接口](#备份接口)

---

## 用户管理接口

### 创建用户目录

创建用户的目录和数据结构。

**请求地址**: `POST /user/createUser`

**请求参数**:

| 参数名   | 类型   | 必填 | 说明     |
|----------|--------|------|----------|
| userId   | string | 是   | 用户ID   |

**请求示例**:

```json
{
  "userId": "user123"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "创建成功",
  "time": 1704067200000
}
```

---

### 删除用户目录

删除指定用户的目录及所有数据。

**请求地址**: `POST /user/deleteUser`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明     |
|---------------|--------|------|----------|
| userId        | string | 否   | 用户ID   |
| currentUserId | string | 否   | 当前用户ID |

**请求示例**:

```json
{
  "userId": "user123",
  "currentUserId": "admin"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "删除成功",
  "time": 1704067200000
}
```

---

## 图片接口

### 上传图片

批量上传图片到服务器。

**请求地址**: `POST /image/uploadImages`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明         |
|---------------|--------|------|--------------|
| currentUserId | string | 是   | 当前用户ID   |
| images        | array  | 是   | 图片数组     |

**images 数组项结构**:

| 参数名         | 类型   | 说明           |
|----------------|--------|----------------|
| id             | string | 图片唯一标识   |
| name           | string | 图片名称       |
| url            | string | Base64 图片数据|
| thumbnailUrl   | string | 缩略图(Base64)|

**请求示例**:

```json
{
  "currentUserId": "user123",
  "images": [
    {
      "id": "img_001",
      "name": "photo1.jpg",
      "url": "data:image/jpeg;base64,...",
      "thumbnailUrl": "data:image/jpeg;base64,..."
    }
  ]
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "上传成功",
  "time": 1704067200000
}
```

---

### 获取缩略图

根据图片ID获取指定图片的缩略图。

**请求地址**: `POST /image/getSmallImage`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明     |
|---------------|--------|------|----------|
| imageId       | string | 是   | 图片ID   |
| currentUserId | string | 是   | 当前用户ID |

**请求示例**:

```json
{
  "imageId": "img_001",
  "currentUserId": "user123"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "file": "data:image/jpeg;base64,..."
  },
  "time": 1704067200000
}
```

---

### 批量获取缩略图

批量获取多张图片的缩略图。

**请求地址**: `POST /image/getSmallImages`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明       |
|---------------|--------|------|------------|
| imageIds      | array  | 是   | 图片ID数组 |
| currentUserId | string | 是   | 当前用户ID |

**请求示例**:

```json
{
  "imageIds": ["img_001", "img_002", "img_003"],
  "currentUserId": "user123"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "files": [
      "data:image/jpeg;base64,...",
      "data:image/jpeg;base64,...",
      "data:image/jpeg;base64,..."
    ]
  },
  "time": 1704067200000
}
```

---

### 获取原图

根据图片ID获取原始图片。

**请求地址**: `POST /image/getFullImage`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明     |
|---------------|--------|------|----------|
| imageId       | string | 是   | 图片ID   |
| currentUserId | string | 是   | 当前用户ID |

**请求示例**:

```json
{
  "imageId": "img_001",
  "currentUserId": "user123"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "file": "data:image/jpeg;base64,..."
  },
  "time": 1704067200000
}
```

---

### 删除图片

批量删除指定图片及其缩略图。

**请求地址**: `POST /image/deleteImages`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明         |
|---------------|--------|------|--------------|
| deleteImages  | array  | 是   | 要删除的图片ID数组 |
| currentUserId | string | 是   | 当前用户ID   |

**请求示例**:

```json
{
  "deleteImages": ["img_001", "img_002"],
  "currentUserId": "user123"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "图片删除成功！",
  "time": 1704067200000
}
```

---

### 更新图片信息

更新图片的元数据信息。

**请求地址**: `POST /image/updateImages`

> ⚠️ 接口开发中，暂不可用

---

### 下载图片

下载指定图片。

**请求地址**: `POST /image/downloadImage`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明     |
|---------------|--------|------|----------|
| imageId       | string | 是   | 图片ID   |
| currentUserId | string | 是   | 当前用户ID |

**请求示例**:

```json
{
  "imageId": "img_001",
  "currentUserId": "user123"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "file": "data:image/jpeg;base64,..."
  },
  "time": 1704067200000
}
```

---

## Schema 接口

### 获取 Schema

获取用户的所有图片标注数据（Marker、分组等信息）。

**请求地址**: `GET /schema/getSchema`

**Query 参数**:

| 参数名        | 类型   | 必填 | 说明     |
|---------------|--------|------|----------|
| currentUserId | string | 是   | 当前用户ID |

**请求示例**:

```
GET /schema/getSchema?currentUserId=user123
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "imageInfo": [
      {
        "id": "img_001",
        "name": "photo1.jpg",
        "GPSInfo": {
          "GPSLatitude": 39.9042,
          "GPSLongitude": 116.4074,
          "GPSAltitude": 50
        }
      }
    ],
    "groupInfo": [],
    "markerInfo": []
  },
  "time": 1704067200000
}
```

---

### 保存 Schema

保存用户的图片标注数据。

**请求地址**: `POST /schema/setSchema`

**请求参数**:

| 参数名        | 类型   | 必填 | 说明     |
|---------------|--------|------|----------|
| currentUserId | string | 是   | 当前用户ID |
| schema        | object | 是   | Schema 数据 |

**请求示例**:

```json
{
  "currentUserId": "user123",
  "schema": {
    "imageInfo": [...],
    "groupInfo": [...],
    "markerInfo": [...]
  }
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "schema数据更新成功！",
  "time": 1704067200000
}
```

---

## 应用配置接口

### 获取用户列表

获取所有用户的基本信息。

**请求地址**: `GET /appSchema/getUserInfos`

**请求示例**:

```
GET /appSchema/getUserInfos
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "userId": "user123",
      "userName": "张三",
      "createTime": "2025-01-01T00:00:00.000Z"
    }
  ],
  "time": 1704067200000
}
```

---

### 获取应用配置

获取应用的全局配置信息。

**请求地址**: `GET /appSchema/getSchema`

**请求示例**:

```
GET /appSchema/getSchema
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "userInfos": [...],
    "appSettings": {
      "theme": "light",
      "language": "zh-CN"
    }
  },
  "time": 1704067200000
}
```

---

### 保存应用配置

保存应用的全局配置信息。

**请求地址**: `POST /appSchema/setSchema`

**请求参数**:

| 参数名 | 类型   | 必填 | 说明           |
|--------|--------|------|----------------|
| schema | object | 是   | 应用配置数据   |

**请求示例**:

```json
{
  "schema": {
    "userInfos": [...],
    "appSettings": {
      "theme": "dark",
      "language": "en"
    }
  }
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "appSchema数据更新成功！",
  "time": 1704067200000
}
```

---

## 备份接口

### 创建备份

将所有用户数据打包成 ZIP 备份文件。

**请求地址**: `POST /backup/backup`

**请求参数**: 无

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": {
    "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
    "fileName": "PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
    "size": 10485760
  },
  "time": 1704067200000
}
```

**返回字段说明**:

| 字段名   | 类型   | 说明             |
|----------|--------|------------------|
| filePath | string | 备份文件完整路径 |
| fileName | string | 备份文件名       |
| size     | number | 文件大小(字节)   |

---

### 获取备份列表

获取所有已创建的备份文件列表。

**请求地址**: `GET /backup/backupList`

**请求示例**:

```
GET /backup/backupList
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": [
    {
      "fileName": "PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
      "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
      "size": 10485760,
      "createTime": "2025-01-15T10:30:00.000Z"
    }
  ],
  "time": 1704067200000
}
```

**返回字段说明**:

| 字段名     | 类型   | 说明           |
|------------|--------|----------------|
| fileName   | string | 备份文件名     |
| filePath   | string | 备份文件路径   |
| size       | number | 文件大小(字节) |
| createTime | string | 创建时间       |

---

### 导入备份

从备份文件恢复数据。

**请求地址**: `POST /backup/import`

**请求参数**:

| 参数名   | 类型   | 必填 | 说明                          |
|----------|--------|------|-------------------------------|
| filePath | string | 是   | 备份文件路径                  |
| mode     | string | 是   | 导入模式: `cover`(覆盖) 或 `merge`(合并) |

**请求示例**:

```json
{
  "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip",
  "mode": "merge"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "导入成功",
  "time": 1704067200000
}
```

**导入模式说明**:

- `cover`: 覆盖模式，先删除现有所有数据，再导入备份数据
- `merge`: 合并模式，保留现有数据，将备份中的新数据添加到现有数据中

---

### 删除备份

删除指定的备份文件。

**请求地址**: `POST /backup/deleteBackup`

**请求参数**:

| 参数名   | 类型   | 必填 | 说明         |
|----------|--------|------|--------------|
| filePath | string | 是   | 备份文件路径 |

**请求示例**:

```json
{
  "filePath": "D:/PicMap_Backup/PicMap_Backup_2025-01-15T10-30-00.000Z.zip"
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "成功",
  "data": "删除成功",
  "time": 1704067200000
}
```

---

## 错误码详细说明

| 错误码 | 描述                     | 可能原因                           |
|--------|--------------------------|------------------------------------|
| 200    | 成功                     | -                                  |
| 400    | 参数校验失败             | 缺少必填参数或参数格式不正确       |
| 404    | 接口不存在               | 请求路径错误                       |
| 429    | 操作过于频繁             | 请求频率超过限制                   |
| 500    | 失败                     | 服务器内部错误，查看 msg 获取详情   |

---

## 版本历史

| 版本   | 日期       | 说明           |
|--------|------------|----------------|
| 1.0.0  | 2025-01-15 | 初始版本       |

