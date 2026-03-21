/*
 * @Author: Do not edit
 * @Date: 2026-03-21
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-21
 * @FilePath: \PicMap\picMap_backend\routes\track.js
 * @Description: 轨迹相关接口
 */
const express = require('express')
const router = express.Router()
const { IncomingForm } = require('formidable')
const { getTrackFilePath } = require('../public/globalVariable')
const Result = require('./resultCode/result.js')
const { getTrackId } = require('../utils/image/image.js')
const fs = require('node:fs')
const nodePath = require('node:path')

function ensureDir(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true })
  }
}

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

module.exports = router