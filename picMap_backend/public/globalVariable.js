/*
 * @Author: Do not edit
 * @Date: 2025-01-25 20:00:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-31 16:15:05
 * @FilePath: \Code\picMap_backend\public\globalVariable.js
 * @Description:
 */
const globalVariables = {
  imageFilePath: 'D:/PicMap/images/',
  schemaPath: 'D:/PicMap/images/schema/schema.json'
}

// 初始化schema，为JSON格式
const defaultSchema = JSON.stringify({
  version: '1.0.0',
  groupInfo: [],
  imageInfo: []
})

module.exports = { globalVariables, defaultSchema }
