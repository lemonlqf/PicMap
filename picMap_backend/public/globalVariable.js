/*
 * @Author: Do not edit
 * @Date: 2025-01-25 20:00:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-04-29 22:22:10
 * @FilePath: \Code\picMap_backend\public\globalVariable.js
 * @Description:
 */
const schemaDirPath = 'D:/PicMap/images/schema' // schema文件存放路径
const schemaFileName = 'schema.json' // schema文件名称
const imageFilePath = 'D:/PicMap/images/' // 图片文件存放路径
const center = [30.2489634, 120.2052342] // 默认地图中心点坐标

const globalVariables = {
  schemaPath: `${schemaDirPath}/${schemaFileName}`,
  imageFilePath,
  schemaDirPath,
  schemaFileName,
}

// 初始化schema，为JSON格式
const defaultSchema = JSON.stringify({
  version: '1.0.0',
  mapInfo: {
    center
  },
  groupInfo: [],
  imageInfo: []
})

module.exports = { globalVariables, defaultSchema }
