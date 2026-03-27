/*
 * @Author: Do not edit
 * @Date: 2026-03-21
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-27 14:34:35
 * @FilePath: \PicMap\picMap_backend\routes\track.js
 * @Description: 轨迹相关接口，包含上传、删除、获取轨迹文件等操作
 */
const express = require('express')
const router = express.Router()
const { IncomingForm } = require('formidable')
const { getTrackFilePath } = require('../public/globalVariable')
const Result = require('./resultCode/result.js')
const { getTrackId } = require('../utils/image/image.js')
const { ensureDir } = require('../utils/file/writeFile.js')
const fs = require('node:fs')
const nodePath = require('node:path')

const MAX_GPX_FILE_SIZE = 50 * 1024 * 1024 // 50MB


/**
 * @description: 上传轨迹文件接口
 * 接收GPX文件，保存到用户对应的轨迹目录
 */
router.post('/uploadTrack', async function (req, res, next) {
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

    if (uploadFile.size > MAX_GPX_FILE_SIZE) {
      res.send(Result.fail(`文件大小不能超过 50MB，当前文件大小为 ${(uploadFile.size / 1024 / 1024).toFixed(2)} MB`))
      return
    }

    // 获取原始文件名，生成带前缀的轨迹ID
    const originalFileName = uploadFile.originalFilename || 'track.gpx'
    const baseName = nodePath.basename(originalFileName, nodePath.extname(originalFileName))
    const fileName = `${getTrackId(baseName)}.gpx`
    const tempInputPath = uploadFile.filepath

    try {
      const currentUserId = fields.currentUserId?.[0] || fields.currentUserId
      const trackDir = getTrackFilePath(currentUserId)
      ensureDir(trackDir)

      const targetPath = nodePath.join(trackDir, fileName)
      fs.copyFileSync(tempInputPath, targetPath)

      console.log('轨迹文件上传成功:', targetPath)
      res.send(Result.success({ filePath: targetPath, fileName }))
    } catch (error) {
      console.error('文件保存失败:', error)
      res.send(Result.fail('文件保存失败'))
    }
  })
})

/**
 * @description: 删除轨迹文件接口
 * 根据文件名删除用户对应的轨迹文件
 */
router.delete('/deleteTrack', async function (req, res, next) {
  const { fileName } = req.query

  if (!fileName) {
    res.send(Result.fail('缺少文件名称参数'))
    return
  }

  try {
    const currentUserId = req.query.currentUserId || 'user1'
    const trackDir = getTrackFilePath(currentUserId)
    // 将原始文件名转换为带前缀的实际文件名（添加.gpx后缀）
    const actualFileName = `${getTrackId(fileName)}`
    const filePath = nodePath.join(trackDir, actualFileName)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log('轨迹文件删除成功:', filePath)
      res.send(Result.success({ message: '删除成功' }))
    } else {
      console.log('轨迹文件不存在:', filePath)
      res.send(Result.fail('文件不存在'))
    }
  } catch (error) {
    console.error('删除轨迹文件失败:', error)
    res.send(Result.fail('删除失败'))
  }
})

/**
 * @description: 获取轨迹文件接口
 * 根据文件名获取用户对应的轨迹文件内容
 */
router.get('/getTrack', async function (req, res, next) {
  const { fileName } = req.query

  if (!fileName) {
    res.send(Result.fail('缺少文件名称参数'))
    return
  }

  try {
    const currentUserId = req.query.currentUserId || 'user1'
    const trackDir = getTrackFilePath(currentUserId)
    // 将原始文件名转换为带前缀的实际文件名（添加.gpx后缀）
    const actualFileName = `${getTrackId(fileName)}`
    const filePath = nodePath.join(trackDir, actualFileName)

    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      console.log('轨迹文件获取成功:', filePath)
      res.send(Result.success({ fileContent }))
    } else {
      console.log('轨迹文件不存在:', filePath)
      res.send(Result.fail('文件不存在'))
    }
  } catch (error) {
    console.error('获取轨迹文件失败:', error)
    res.send(Result.fail('获取失败'))
  }
})

module.exports = router