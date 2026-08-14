# image-path-upload Specification

## Purpose
TBD - created by archiving change go-wails-migration. Update Purpose after archive.
## Requirements
### Requirement: 后端返回所选图片的本地路径

系统 SHALL 提供后端文件选择绑定，通过原生对话框让用户选择一张或多张图片，并返回所选文件的绝对路径数组。返回结果 SHALL 遵循统一的 `Result` 结构（`code`/`msg`/`data`/`time`）。

#### Scenario: 选择多张图片返回路径

- **WHEN** 用户触发图片选择并选择多张图片
- **THEN** 系统返回包含每张图片绝对路径的字符串数组，且 `code` 为 200

#### Scenario: 取消选择

- **WHEN** 用户在选择对话框中取消
- **THEN** 系统返回空数组或明确的取消结果，不抛出异常

### Requirement: 基于文件路径上传图片

系统 SHALL 接收图片的本地文件路径数组作为上传输入，按路径读取文件内容并写入用户图片目录，文件名以图片 ID 作为前缀、保留原扩展名。上传过程 SHALL 对并发数量做限制。

#### Scenario: 成功上传带 GPS 的图片

- **WHEN** 前端传入一张存在于磁盘的图片路径
- **THEN** 系统读取该文件并写入 `images/{id}.{ext}`，返回成功结果，且前端内存中不保留整图 base64

#### Scenario: 路径对应的文件不存在

- **WHEN** 传入的路径在磁盘上已不存在
- **THEN** 系统返回明确错误信息，不写入任何脏数据，不影响同批其他图片

#### Scenario: 批量上传多张图片

- **WHEN** 前端传入多张图片路径
- **THEN** 系统并发（受控）处理所有图片，逐张返回各自结果

### Requirement: 上传接口以路径替代 base64 载体

图片上传接口 SHALL 以本地文件路径作为传输载体，不再接收整图 base64 数据。此变更 SHALL 同步更新前端调用与后端模型定义，保持一致发布。

#### Scenario: 前端调用传路径

- **WHEN** 前端发起图片上传
- **THEN** 请求中携带的是文件路径数组，而非 base64 数据 URL

#### Scenario: 后端模型语义更新

- **WHEN** 后端解析上传请求
- **THEN** 图片的 URL 字段被解释为本地文件路径，用于读取文件

### Requirement: 图片分批解析与事件推送

系统 SHALL 将图片选择后的解析流程改为「立即返回路径列表 + 后台分批解析 + 逐批事件推送」，每批解析完成即通过 Wails 事件机制推送结果与进度，前端逐批渲染预览。

#### Scenario: 选择文件后秒回路径

- **WHEN** 用户在原生对话框中选择多张图片
- **THEN** `SelectImages` 立即返回文件路径数组与总数，解析在后台异步进行，不阻塞返回

#### Scenario: 逐批推送解析结果

- **WHEN** 后台每批（4 张）解析完成
- **THEN** 通过 `images-parsed` 事件推送该批 `SelectedImage[]` 与错误列表，前端逐批渲染预览图

#### Scenario: 解析进度与完成通知

- **WHEN** 解析过程中与全部完成时
- **THEN** 分别通过 `images-progress`（processed/total）与 `images-done` 事件通知前端，前端显示进度条

#### Scenario: 解析中防重入

- **WHEN** 用户在上一次解析完成前再次触发选择
- **THEN** 后端拒绝二次进入并返回「正在解析图片，请稍候」

