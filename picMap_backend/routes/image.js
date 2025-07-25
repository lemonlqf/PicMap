/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-19 23:13:07
 * @FilePath: \Code\picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const express = require('express')
const router = express.Router()
const { getImageFileById, getSmallImageFileById } = require('../utils/image/image.js')
const { getImageId } = require('../utils/image/image.js')
const glob = require('glob')

router.post('/uploadImages', async function (req, res, next) {
  const bodyData = req.body.images
  const { currentUserId } = req.body
  bodyData?.forEach?.(item => {
    writeBase64File(item.url, item.name, item.id, getImageFilePath(currentUserId))
  })
  // const res1 = await executeQuery('select * from test')
  res.send(Result.success('上传成功'))
})

// 获取缩略图
router.post('/getSmallImage', async function (req, res, next) {
  let { imageId, currentUserId } = req.body
  const file = await getSmallImageFileById(imageId, currentUserId)
  // const file = getImageFileById(imageId)

  if (file) {
    res.send(Result.success({ file }))
  } else {
    res.send(Result.fail('调整图片分辨率失败'))
  }
})

// 获取缩略图
router.post('/getSmallImages', async function (req, res, next) {
  let files = []
  let { imageIds, currentUserId } = req.body
  for (let i = 0; i < imageIds.length; i++) {
    const url = await getSmallImageFileById(imageIds[i], currentUserId)
    files.push(url)
  }
  if (files.length > 0) {
    res.send(Result.success({ files }))
  } else {
    res.send(Result.fail('获取图片失败'))
  }
})

// 获取原图
router.post('/getFullImage', async function (req, res, next) {
  let { imageId, currentUserId } = req.body
  const file = getImageFileById(imageId, currentUserId)
  if (file) {
    res.send(Result.success({ file }))
  } else {
    res.send(Result.fail('图片不存在'))
  }
})

router.post('/deleteImages', function (req, res, next) {
  const { deleteImages, currentUserId } = req.body
  // 删除图片库中的图片
  if (deleteImages?.length) {
    deleteImages.forEach(imageId => {
      const filesPath = glob.sync(`${getImageFilePath(currentUserId)}/${getImageId(imageId)}*`)
      if (filesPath.length === 0) {
        res.send(Result.fail('图片还未上传！'))
      } else {
        fs.unlink(filesPath[0], () => {
          res.send(Result.success('图片删除成功！'))
        })
      }
    })
  } else {
    res.send(Result.success('没有需要删除的图片！'))
  }
})

router.post('/updateImages', function (req, res, next) {
  // TODO:图片更新的逻辑
  res.send('接口还在开发完善中....')
})

router.post('/downloadImage', function (req, res, next) {
  const { imageId, currentUserId } = req.body
  const file = getImageFileById(imageId, currentUserId)
  if (file) {
    res.send(Result.success({ file }))
  } else {
    res.send(Result.fail('文件不存在'))
  }
})

module.exports = router
