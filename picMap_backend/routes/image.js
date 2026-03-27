/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-16 22:06:18
 * @FilePath: \PicMap\picMap_backend\routes\image.js
 * @Description: 图片相关接口
 * - 图片上传、获取、删除等操作
 * - 支持HEIC/HEIF格式图片的缩略图生成
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const { IncomingForm } = require('formidable')
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const express = require('express')
const router = express.Router()
const { getImageFileById, getSmallImageFileById, THUMBNAIL_PREFIX, generateThumbnail, getImageId, getThumbnailId, isHeicImage, isRawImage, convertHeicToJpegBuffer, convertRawToJpegBuffer } = require('../utils/image/image.js')
const glob = require('glob')
const nodePath = require('node:path')

router.post('/getJPGImage', async function (req, res, next) {
  const form = new IncomingForm({ multiples: false })

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('解析上传文件失败:', err)
      res.send(Result.fail('解析上传文件失败'))
      return
    }

    const fileField = files.file
    const uploadFile = Array.isArray(fileField) ? fileField[0] : fileField

    if (!uploadFile) {
      res.send(Result.fail('未接收到文件，请检查 FormData 字段是否为 file'))
      return
    }

    const fileName = uploadFile.originalFilename || ''
    const mimeType = uploadFile.mimetype || ''
    const tempInputPath = uploadFile.filepath

    try {
      if (isHeicImage(fileName, mimeType)) {
        try {
          // 转换时间
          const startTime = Date.now()
          const outputBuffer = await convertHeicToJpegBuffer(tempInputPath)
          res.type('image/jpeg').send(outputBuffer)
          const endTime = Date.now()
          console.log('使用 ImageMagick 转换 HEIC 成功:', fileName, '耗时:', endTime - startTime, 'ms')
          return
        } catch (imageMagickError) {
          console.error('HEIC转换失败:', imageMagickError)
          res.send(Result.fail('HEIC转换失败'))
          return
        }
      }

      if (isRawImage(fileName, mimeType)) {
        const outputBuffer = await convertRawToJpegBuffer(tempInputPath, fileName)
        res.type('image/jpeg').send(outputBuffer)
        return
      }

      res.send(Result.fail('仅支持 HEIC/HEIF 或 RAW 格式'))
    } catch (error) {
      console.error('文件处理失败:', error)
      res.send(Result.fail('文件处理失败'))
    }
  })
})


router.post('/uploadImages', async function (req, res, next) {
  const bodyData = req.body.images
  const { currentUserId } = req.body
  const uploadedImages = []
  for (const item of bodyData || []) {
    let extension = item.name ? nodePath.extname(item.name) : '.jpg'
    // 写入本地图片文件
    writeBase64File(item.url, item.id, extension, getImageFilePath(currentUserId))

    // 如果有缩略图的话，也写入本地文件，要单独保存一份缩略图，缩略图的名称：_THUMBNAIL_PM+id.jpg
    if (item.thumbnailUrl) {
      extension = '.jpg' // 缩略图统一使用jpg格式
      writeBase64File(item.thumbnailUrl, item.id, extension, getImageFilePath(currentUserId), THUMBNAIL_PREFIX)
    }
    // 获取缩略图内容用于返回
    const thumbnailBase64 = await getSmallImageFileById(item.id, currentUserId)
    uploadedImages.push({
      id: item.id,
      thumbnailBase64
    })
  }
  res.send(Result.success({ images: uploadedImages }))
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
