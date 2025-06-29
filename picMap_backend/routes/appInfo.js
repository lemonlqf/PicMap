/*
 * @Author: Do not edit
 * @Date: 2025-06-29 14:14:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 16:44:04
 * @FilePath: \Code\picMap_backend\routes\appInfo.js
 * @Description: 
 */
var express = require('express')
var router = express.Router()
const { appInfoPath } = require('../public/globalVariable')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')

router.get('/getUserInfos', function (req, res, next) {
  const appInfoJSON = fs.readFileSync(appInfoPath, { encoding: 'utf-8' })
  const appInfo = JSON.parse(appInfoJSON)
  const userInfos = appInfo.userInfos
  res.send(Result.success(userInfos))
})

module.exports = router