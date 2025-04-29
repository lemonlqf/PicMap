/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:30:32
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-04-29 22:14:50
 * @FilePath: \Code\picMap_backend\routes\schema.js
 * @Description:
 */
var express = require('express')
var router = express.Router()
var defaultSchema = require('../public/globalVariable').defaultSchema
const fs = require('node:fs')
const globalVariables = require('../public/globalVariable').globalVariables
const Result = require('./resultCode/result.js')

/* GET schema. */
router.get('/getSchema', function (req, res, next) {
  let schema = null
  // 判断文件是否存在
  const fileExists = fs.existsSync(globalVariables.schemaPath)
  if (!fileExists) {
    // 创建schema保存的目录
    fs.mkdirSync(globalVariables.schemaDirPath, { recursive: true })
    // 在schema保存目录下创建一个空的 schema.json 文件
    fs.writeFileSync(globalVariables.schemaPath, JSON.stringify(defaultSchema), { encoding: 'utf-8' })
    schema = defaultSchema
  } else {
    schema = fs.readFileSync(globalVariables.schemaPath, { encoding: 'utf-8' })
  }

  res.send(Result.success(schema))
})

router.post('/setSchema', function (req, res, next) {
  const schema = req.body.schema
  fs.writeFileSync(globalVariables.schemaPath, schema)
  res.send(Result.success('schema数据更新成功！'))
})

module.exports = router
