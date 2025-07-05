/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:30:32
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 16:44:48
 * @FilePath: \Code\picMap_backend\routes\schema.js
 * @Description:
 */
var express = require('express')
var router = express.Router()
var defaultSchema = require('../public/globalVariable').defaultSchema
const fs = require('node:fs')
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const Result = require('./resultCode/result.js')

/* GET schema. */
router.get('/getSchema', function (req, res, next) {
  const { currentUserId } = req.query
  let schema = null
  // 判断文件是否存在
  const fileExists = fs.existsSync(getSchemaJSONPath(currentUserId))
  if (!fileExists) {
    // 创建schema保存的目录
    fs.mkdirSync(getSchemaDirPath(currentUserId), { recursive: true })
    // 在schema保存目录下创建一个初始化的 schema.json 文件
    fs.writeFileSync(getSchemaJSONPath(currentUserId), defaultSchema, { encoding: 'utf-8' })
    schema = defaultSchema
  } else {
    schema = fs.readFileSync(getSchemaJSONPath(currentUserId), { encoding: 'utf-8' })
  }

  res.send(Result.success(schema))
})

router.post('/setSchema', function (req, res, next) {
  const { currentUserId } = req.body
  const schema = req.body.schema
  fs.writeFileSync(getSchemaJSONPath(currentUserId), schema)
  res.send(Result.success('schema数据更新成功！'))
})

module.exports = router
