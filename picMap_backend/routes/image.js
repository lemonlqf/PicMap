/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-31 18:31:26
 * @FilePath: \Code\picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const globalVariables = require('../public/globalVariable').globalVariables
var express = require('express')
const { executeQuery } = require('../public/dbconfig.js')
var router = express.Router()
const getImageFileById = require('../utils/image/image.js').getImageFileById

router.post('/uploadImages', async function (req, res, next) {
  const bodyData = req.body.images
  bodyData.forEach(item => {
    writeBase64File(item.url, item.name, item.id)
  })
  // const res1 = await executeQuery('select * from test')
  res.send(Result.success('上传成功'))
})

router.post('/getImage', async function (req, res, next) {
  let { imageId } = req.body
  const file = getImageFileById(imageId)
  if (file) {
    res.send(Result.success({ file }))
  } else {
    res.send(Result.fail('图片不存在'))
  }
})

module.exports = router
