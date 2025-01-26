/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-26 14:28:33
 * @FilePath: \Code\picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
var express = require('express')
const { executeQuery } = require('../public/dbconfig.js')
var router = express.Router()

router.post('/uploadImages', async function (req, res, next) {
  const bodyData = req.body.images
  bodyData.forEach(item => {
    writeBase64File(item.file.url, item.file.name, item.file.uid)
  })
  // const res1 = await executeQuery('select * from test')
  res.send(Result.success('上传成功'))
})

module.exports = router
