# PicMap

PicMap 是一个基于 Vue3 前端和 Express 后端的图片地图应用。你可以在地图上展示和管理你的图片。

# 主要功能
- 图片位置展示（Leaflet）
![alt text](./doc/gif/地图.gif)
- 分组管理

- 图片详情展示

## 技术栈

- 前端：Vue 3 + Vite + TypeScript + SCSS + Leaflet
- 后端：Node.js + Express
- 构建/打包：Vite、webpack、electron-builder

---

## 快速开始

### 1. 依赖安装

前端：

进入picMap_fontend目录下

```bash
npm install
```
后端：

进入picMap_backend目录下

```bash
npm install
```

### 2. 启动开发环境

前端：

进入picMap_fontend目录下

```bash
npm run dev
```
后端：

进入picMap_backend目录下

```bash
npm run start
```

前端默认运行在 http://localhost:5173，后端默认运行在 http://localhost:5001。

## 构建Electron应用

首先分别对前后端项目进行打包，打包命令如下：

```bash
npm run build
```

然后回到根目录下进行应用构建，构建命令如下：

```bash
npm run build
```

打包成功后会在根目录下生成dist目录中产物

