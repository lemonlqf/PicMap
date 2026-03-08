/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-08 22:29:00
 * @FilePath: \PicMap\picMap_backend\routes\image.js
 * @Description:
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const express = require('express')
const router = express.Router()
const { getImageFileById, getSmallImageFileById, THUMBNAIL_PREFIX } = require('../utils/image/image.js')
const { getImageId, getThumbnailId } = require('../utils/image/image.js')
const glob = require('glob')
const nodePath = require('node:path')

router.post('/uploadImages', async function (req, res, next) {
  const bodyData = req.body.images
  const { currentUserId } = req.body
  // console.log('bodyData', bodyData)
  bodyData?.forEach?.(item => {
    let extension = item.name ? nodePath.extname(item.name) : '.jpg'
    // 写入本地图片文件
    writeBase64File(item.url, item.id, extension, getImageFilePath(currentUserId))

    // 如果有缩略图的话，也写入本地文件，要单独保存一份缩略图，缩略图的名称：_THUMBNAIL_PM+id.jpg
    if (item.thumbnailUrl) {
      extension = '.jpg' // 缩略图统一使用jpg格式
      writeBase64File(item.thumbnailUrl, item.id, extension, getImageFilePath(currentUserId), THUMBNAIL_PREFIX)
    }
  })
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

  Promise.all(imageIds.map(async (id) => {
    const url = await getSmallImageFileById(id, currentUserId)
    return url
  })).then(files => {
    if (files.length > 0) {
      res.send(Result.success({ files }))
    } else {
      res.send(Result.fail('获取图片失败'))
    }
  })
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

router.post('/deleteImages', async function (req, res, next) {
  const { deleteImages, currentUserId } = req.body
  // 删除图片库中的图片
  if (deleteImages?.length) {
    const basePath = getImageFilePath(currentUserId)
    const allFiles = []

    deleteImages.forEach(imageId => {
      const imageFilesPath = glob.sync(`${basePath}/${getImageId(imageId)}*`)
      // 如果有缩略图的话，也要删除缩略图
      const thumbnailFilesPath = glob.sync(`${basePath}/${getThumbnailId(imageId)}*`)
      allFiles.push(...imageFilesPath, ...thumbnailFilesPath)
    })

    const uniqueFiles = [...new Set(allFiles)]
    if (uniqueFiles.length === 0) {
      res.send(Result.fail('图片还未上传！'))
      return
    }

    const deleteResults = await Promise.allSettled(uniqueFiles.map(filePath => fs.promises.unlink(filePath)))
    const failCount = deleteResults.filter(item => item.status === 'rejected').length

    if (failCount > 0) {
      res.send(Result.fail(`删除完成，但有 ${failCount} 个文件删除失败`))
    } else {
      res.send(Result.success('图片删除成功！'))
    }
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
