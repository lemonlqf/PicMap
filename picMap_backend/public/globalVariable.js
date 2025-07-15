/*
 * @Author: Do not edit
 * @Date: 2025-01-25 20:00:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-14 20:42:33
 * @FilePath: \Code\picMap_backend\public\globalVariable.js
 * @Description:
 */

const { get } = require("lodash")

// 应用相关的全局变量
let archiveDirectory = 'D:/PicMap' // 存档路径

// 设置存档路径
function setArchiveDirectory(path) {
  archiveDirectory = path
}

const appInfoFileName = 'appSchema.json' // 应用信息文件名称
const appSchemaPath = `${archiveDirectory}/${appInfoFileName}` // 应用信息文件的完整路径

// 默认应用信息，为JSON格式
const defaultAppInfo = JSON.stringify({
  version: '1.0.0',
  // 用户名称
  userInfos: [
    {
      userId: 'user1',
      userName: '用户1',
      userAvatar: ''
    }
  ]
})

// ------------------------------

// schema相关的全局变量
let defaultUserName = 'user1'
const schemaReactivePath = 'images/schema' // schema文件的响应式路径
const imageReactivePath = 'images' // 图片文件的响应式路径
const schemaFileName = 'schema.json' // schema文件名称
const center = [30.2489634, 120.2052342] // 默认地图中心点坐标
let currentUserName = ''

const globalVariables = {
  schemaDirPath: `${archiveDirectory}/${getUserName()}/${schemaReactivePath}`, // schema文件所在的目录
  imageFilePath: `${archiveDirectory}/${getUserName()}/${imageReactivePath}`, // 图片文件所在的目录
  schemaPath: `${archiveDirectory}/${getUserName()}/${schemaReactivePath}/${schemaFileName}`, // schema文件所在的完整路径
  schemaFileName,
  archiveDirectory,
  defaultUserName,
  schemaReactivePath
}

function getUserName() {
  return currentUserName || defaultUserName
}

/**
 * @description: 更新当前用户
 * @param {*} name
 * @return {*}
 */
function setUserName(name) {
  currentUserName = name
  globalVariables.schemaDirPath = `${archiveDirectory}/${getUserName()}/${schemaReactivePath}`
  globalVariables.imageFilePath = `${archiveDirectory}/${getUserName()}/${imageReactivePath}`
  globalVariables.schemaPath = `${archiveDirectory}/${getUserName()}/${schemaReactivePath}/${schemaFileName}`
}

// 初始化schema，为JSON格式
const defaultSchema = JSON.stringify({
  version: '1.0.0',
  mapInfo: {
    center,
    // 默认瓦片的id,与前端defaultMapTile中的id对应
    activeTiles: [
      'tile_default1',
      'tile_default2',
      'tile_default3',
    ]
  },
  groupInfo: [],
  imageInfo: []
})

function getSchemaDirPath(userId) {
  return `${archiveDirectory}/${userId}/${schemaReactivePath}`
}

// 实际路径，需要根据userId来动态生成
function getSchemaJSONPath(userId) {
  return `${archiveDirectory}/${userId}/${schemaReactivePath}/${schemaFileName}`
}

function getImageFilePath(userId) {
  return `${archiveDirectory}/${userId}/${imageReactivePath}`
}


module.exports = {
  archiveDirectory,
  globalVariables,
  defaultSchema,
  appSchemaPath,
  defaultAppInfo,
  setUserName,
  getSchemaDirPath,
  getSchemaJSONPath,
  getImageFilePath,
  setArchiveDirectory,
}
