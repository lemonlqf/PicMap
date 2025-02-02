/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:30:32
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-02 19:08:23
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
