/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-02 19:51:58
 * @FilePath: \Code\picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const globalVariables = require('../public/globalVariable').globalVariables
const express = require('express')
const router = express.Router()
const getImageFileById = require('../utils/image/image.js').getImageFileById
const { getImageId } = require('../utils/image/image.js')
const glob = require('glob')

router.post('/uploadImages', async function (req, res, next) {
  const bodyData = req.body.images
  bodyData?.forEach?.(item => {
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

router.post('/deleteImages', function (req, res, next) {
  const { deleteImages } = req.body
  // 删除图片库中的图片
  if (deleteImages?.length) {
    deleteImages.forEach(imageId => {
      const filesPath = glob.sync(`${globalVariables.imageFilePath}${getImageId(imageId)}*`)
      if (filesPath.length === 0) {
        res.send(Result.fail('图片还未上传！'))
      } else {
        fs.unlink(filesPath[0], () => {
          res.send(Result.success('图片删除成功！'))
        })
      }
    })
  }
})

router.post('/updateImages', function (req, res, next) {
  // TODO:图片更新的逻辑
  res.send('接口还在开发完善中....')
})

module.exports = router
