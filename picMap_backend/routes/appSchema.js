/*
 * @Author: Do not edit
 * @Date: 2025-06-29 14:14:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-05 15:04:56
 * @FilePath: \Code\picMap_backend\routes\appSchema.js
 * @Description: 
 */
var express = require('express')
var router = express.Router()
const { appSchemaPath } = require('../public/globalVariable.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')

router.get('/getUserInfos', function (req, res, next) {
  const appInfoJSON = fs.readFileSync(appSchemaPath, { encoding: 'utf-8' })
  const appInfo = JSON.parse(appInfoJSON)
  const userInfos = appInfo.userInfos
  res.send(Result.success(userInfos))
})

router.get('/getSchema', function (req, res, next) {
  const appSchemaJSON = fs.readFileSync(appSchemaPath, { encoding: 'utf-8' })
  const appSchema = JSON.parse(appSchemaJSON)
  res.send(Result.success(appSchema))
})

router.post('/setSchema', function (req, res, next) {
  const schema = req.body.schema
  fs.writeFileSync(appSchemaPath, schema)
  res.send(Result.success('appSchema数据更新成功！'))
})

module.exports = router