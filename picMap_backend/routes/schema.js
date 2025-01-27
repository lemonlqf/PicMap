/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:30:32
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-26 14:49:34
 * @FilePath: \Code\picMap_backend\routes\schema.js
 * @Description:
 */
var express = require('express')
var router = express.Router()
const fs = require('node:fs')
const globalVariables = require('../public/globalVariable')
const Result = require('./resultCode/result.js')

/* GET schema. */
router.get('/getSchema', function (req, res, next) {
  const schema = fs.readFileSync(globalVariables.schemaPath, { encoding: 'utf-8' })
  res.send(Result.success(schema))
})

router.post('/setSchema', function (req, res, next) {
  const schema = req.body.schema
  fs.writeFileSync(globalVariables.schemaPath, schema)
  res.send(Result.success('保存schema成功'))
})

module.exports = router
