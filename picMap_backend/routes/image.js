/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2025-01-25 21:16:13
 * @FilePath: \Code\picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
var express = require('express')
var router = express.Router()

router.post('/uploadImages', function (req, res, next) {
  // console.log(JSON.parse(req.body))
  // console.log(req.body.data)
  const bodyData = req.body.images
  // console.log(Array.isArray(bodyData))
  bodyData.forEach(item => {
    writeBase64File(item.file.url, item.file.name)
  })
  res.send(Result.success('上传成功'))
})

module.exports = router
