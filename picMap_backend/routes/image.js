/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-14 19:59:43
 * @FilePath: \picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
var express = require('express')
var router = express.Router()

router.post('/addImgs', function (req, res, next) {
  // console.log(JSON.parse(req.body))
  // console.log(req.body.data)
  const bodyData = req.body.data
  // console.log(Array.isArray(bodyData))
  bodyData.forEach(item => {
    writeBase64File(item.file.url, item.file.name)
  })
  res.send('上传成功！')
})

module.exports = router
