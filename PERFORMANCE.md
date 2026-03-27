# PERFORMANCE.md - PicMap 性能优化指南

## 已知性能风险点

以下是已识别的大数据量场景风险点，生成代码时需特别注意：

### 高风险

| 功能 | 接口 | 风险描述 |
|------|------|---------|
| 获取所有缩略图 | `POST /getSmallImages` | `Promise.all(imageIds.map(...))` 无并发限制，大数据量时耗尽资源 |
| 删除图片 | `POST /deleteImages` | `forEach` + `glob.sync` 同步阻塞，大量图片时冻结事件循环 |
| 备份导出 | `POST /backup` | 递归计算目录大小时同步遍历所有文件，无超时保护 |
| 备份导入 | `POST /import` | 批量文件复制用 `fs.copyFileSync` 循环，无分批处理 |
| Schema存储 | `POST /setSchema` | 直接 `writeFileSync` 覆盖，无原子性保护 |

### 中风险

| 功能 | 接口 | 风险描述 |
|------|------|---------|
| 上传图片 | `POST /uploadImages` | 每次写入都调用同步目录检查，批量上传时重复阻塞 |
| 获取轨迹 | `GET /getTrack` | `readFileSync` 同步读取整个GPX文件到内存，大文件OOM |
| 轨迹上传 | `POST /uploadTrack` | 文件先完整缓存再复制，无流式处理 |

---

## 性能优化原则

### 1. 避免同步阻塞

- 禁止使用 `fs.readFileSync`、`fs.writeFileSync`、`fs.copyFileSync` 等同步方法
- 禁止使用 `glob.sync`，使用异步版本 `glob()` 替代
- 禁止在循环中调用同步操作

```javascript
// Bad - 循环中同步阻塞
imageIds.forEach(id => {
  const files = glob.sync(`${basePath}/${id}*`)  // 每次循环都阻塞
  // ...
})

// Good - 异步+分批处理
const batchSize = 100
for (let i = 0; i < imageIds.length; i += batchSize) {
  const batch = imageIds.slice(i, i + batchSize)
  await Promise.all(batch.map(id => glob(`${basePath}/${id}*`)))
}
```

### 2. 限制并发数量

- 使用 `Promise.all` 时确保并发数可控
- 大批量操作使用分批处理（每批 50-100 个）
- 使用 `p-limit` 或手写队列控制并发

```javascript
// Bad - 无限制并发
await Promise.all(imageIds.map(id => getSmallImageFileById(id)))

// Good - 限制并发数为 50
const CONCURRENCY = 50
for (let i = 0; i < imageIds.length; i += CONCURRENCY) {
  const batch = imageIds.slice(i, i + CONCURRENCY)
  await Promise.all(batch.map(id => getSmallImageFileById(id)))
}
```

### 3. 文件大小限制

- GPX 文件限制：50MB（已实现）
- 上传文件应有大小校验，放在前端和后端双重校验

### 4. 原子性保护

- 写入配置文件（如 schema.json）使用"写临时文件 + 原子重命名"策略

```javascript
// 原子写入 - 防止数据损坏
function atomicWriteFile(filePath, data) {
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, data, { encoding: 'utf-8' })  // 写临时文件
  fs.renameSync(tmpPath, filePath)  // 原子替换
}
```

### 5. 添加必要注释

- 性能相关代码必须添加中文注释说明
- 标注可能的性能瓶颈和优化方向
- 说明并发限制数值的依据

```javascript
// 限制并发数为 50，防止同时打开过多文件描述符
const CONCURRENCY = 50
```

---

## 文件大小限制参考

| 文件类型 | 建议限制 | 说明 |
|---------|---------|------|
| GPX 轨迹 | 50MB | 约100万个轨迹点，超出通常为异常数据 |
| 单张图片 | 50MB | 避免处理过大的原始格式 |
| 备份存档 | 无硬性限制 | 但超过500MB会显示警告 |

---

## 内存风险说明

| 操作 | 风险 | 说明 |
|------|------|------|
| `fs.readFileSync` 大文件 | OOM | 一次性加载整个文件到内存 |
| `Promise.all` 大量并发 | 内存飙升 | 大量 Promise 同时执行，内存压力大 |
| 递归遍历大目录 | 内存泄漏 | `readdirSync` + `statSync` 累积内存 |

---

**重要提醒：生成代码时必须考虑性能问题，遵循上述优化原则，并在关键代码处添加中文注释说明。**
