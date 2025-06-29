/*
 * @Author: Do not edit
 * @Date: 2025-06-29 14:14:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 14:26:43
 * @FilePath: \Code\picMap_backend\routes\appInfo.js
 * @Description: 
 */
var express = require('express')
var router = express.Router()
const { appInfoPath } = require('../public/globalVariable')

router.get('getUserInfos', function (req, res, next) {
  const appInfo = JSON.parse(fs.readFileSync(appInfoPath, { encoding: 'utf-8' }))
  const userInfos = appInfo.userInfos
  res.send(Result.success(userInfos))
})

module.exports = router