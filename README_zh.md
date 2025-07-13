# PicMap

[English](README.md)

PicMap 是一个基于 Vue3 前端和 Express 后端的图片地图应用，你可以在地图上展示和管理你的图片。

本应用除了地图瓦片需要在线获取外，其他的所有功能都无需联网，您的所有信息和图片都**保存在本地**，无个人信息泄露风险。

图片和数据的保存目录：`D:\PicMap`

适配系统：`windows`

# 主要功能
- 图片位置展示
![alt text](doc/image/image.png)

- 图片分组

- 用户管理

  允许添加用户、删除用户以及编辑部分用户信息

- 地图管理

  允许对管理地图瓦片

## 技术栈

- 前端：Vue 3 + Vite + TypeScript + Leaflet
- 后端：Node.js + Express
- 构建/打包：Vite、webpack、electron-builder

---

## 快速开始

### 1. 依赖安装

前端：

进入`picMap_fontend`目录下

```bash
npm install
```
后端：

进入`picMap_backend`目录下

```bash
npm install
```

### 2. 启动开发环境

前端：

进入`picMap_fontend`目录下

```bash
npm run dev
```
后端：

进入`picMap_backend`目录下

```bash
npm run start
```

## 构建Electron应用

先分别对前后端项目进行打包，打包命令如下：

```bash
npm run build
```

得到前后端产物后，执行下一步,

回到根目录下进行应用构建，构建命令如下：

```bash
npm run build
```

打包成功后会在根目录下生成`dist`目录中产物

