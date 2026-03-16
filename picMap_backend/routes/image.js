/*
 * @Author: Do not edit
 * @Date: 2024-12-14 18:19:58
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-16 21:12:24
 * @FilePath: \PicMap\picMap_backend\routes\image.js
 * @Description: 图片相关接口
 * - 图片上传、获取、删除等操作
 * - 支持HEIC/HEIF格式图片的缩略图生成
 */
const { writeBase64File } = require('../utils/file/writeFile.js')
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const os = require('node:os')
const { execFile } = require('node:child_process')
const heicConvert = require('heic-convert')
const { IncomingForm } = require('formidable')
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const express = require('express')
const router = express.Router()
const { getImageFileById, getSmallImageFileById, THUMBNAIL_PREFIX, generateThumbnail } = require('../utils/image/image.js')
const { getImageId, getThumbnailId } = require('../utils/image/image.js')
const glob = require('glob')
const nodePath = require('node:path')

// HEIC/HEIF图片格式
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/x-heic']
const HEIC_EXTENSIONS = ['.heic', '.heif']

// RAW图片格式
const RAW_TYPES = ['image/x-raw', 'image/x-adobe-dng', 'image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-olympus-orf', 'image/x-panasonic-rw2']
const RAW_EXTENSIONS = ['.raw', '.dng', '.arw', '.cr2', '.nef', '.orf', '.rw2']
// heicConvert默认转换质量较高，文件较大，这里设置一个较低的质量，转换速度会更快，且用于缩略图展示足够了
const HEIC_CONVERT_QUALITY = 0.01
// imageMagick转换HEIC的质量参数，取值范围0-100，数值越大质量越好但文件越大，默认80是一个比较常见的选择
const IMAGE_MAGICK_JPEG_QUALITY = 25
const BACKEND_ROOT = nodePath.resolve(__dirname, '..')
// 项目内置 ImageMagick 路径（优先使用便携版，避免依赖系统安装）。
const EMBEDDED_MAGICK_WINDOWS = nodePath.join(BACKEND_ROOT, 'tools', 'imagemagick', 'magick.exe')
const EMBEDDED_MAGICK_UNIX = nodePath.join(BACKEND_ROOT, 'tools', 'imagemagick', 'bin', 'magick')


function execFileAsync(command, args, timeout = 20000) {
  return new Promise((resolve, reject) => {
    // 统一封装子进程调用，便于后续加超时、日志和错误处理。
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr
        reject(error)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function getImageMagickCommandCandidates() {
  const candidates = []

  if (process.env.IMAGEMAGICK_BIN) {
    // 允许通过环境变量强制指定 ImageMagick 可执行文件路径。
    candidates.push(process.env.IMAGEMAGICK_BIN)
  }

  if (process.platform === 'win32') {
    // Windows 优先读取项目内置便携版。
    candidates.push(EMBEDDED_MAGICK_WINDOWS)
  } else {
    // Linux / macOS 优先读取项目内置便携版。
    candidates.push(EMBEDDED_MAGICK_UNIX)
  }

  // 最后兜底：尝试系统 PATH 里的 magick 命令。
  candidates.push('magick')

  return candidates.filter(cmd => {
    if (cmd === 'magick') return true
    return fs.existsSync(cmd)
  })
}

/**
 * @description: 使用 ImageMagick 将 HEIC 转换为 JPEG
 * @param {*} inputPath
 * @return {*}
 */
async function convertHeicByImageMagick(inputPath) {
  // 使用临时输出文件承接 ImageMagick 转换结果，读回后立即清理。
  const outputPath = nodePath.join(os.tmpdir(), `picmap_${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`)
  const commands = getImageMagickCommandCandidates()
  console.log(commands.length > 1 ? 'ImageMagick 命令候选列表:' : '尝试使用 ImageMagick 转换 HEIC:', commands)
  let lastError
  try {
    for (const command of commands) {
      try {
        // 按顺序尝试：环境变量指定 -> 项目内置 -> 系统 PATH。
        // -auto-orient: 按 EXIF 方向自动旋转
        // -strip: 去除元数据，减小体积
        // -quality: 控制 JPEG 质量（0-100）
        await execFileAsync(command, [inputPath, '-auto-orient', '-strip', '-quality', IMAGE_MAGICK_JPEG_QUALITY, outputPath])
        // 转换成功，读取输出文件并返回。
        return await fs.promises.readFile(outputPath)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('ImageMagick not available')
  } finally {
    // 清理临时文件，避免磁盘空间泄漏。
    await fs.promises.rm(outputPath, { force: true }).catch(() => {})
  }
}

/**
 * @description: 判断是否为HEIC/HEIF格式
 * @param {string} fileName 文件名
 * @param {string} type 文件MIME类型
 * @return {boolean}
 */
function isHeicImage(fileName, type) {
  const ext = nodePath.extname(fileName).toLowerCase()
  return HEIC_EXTENSIONS.includes(ext) || HEIC_TYPES.includes(type)
}

/**
 * @description: 判断是否为RAW格式
 * @param {string} fileName 文件名
 * @param {string} type 文件MIME类型
 * @return {boolean}
 */
function isRawImage(fileName, type) {
  const ext = nodePath.extname(fileName).toLowerCase()
  return RAW_EXTENSIONS.includes(ext) || RAW_TYPES.includes(type)
}

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
          // 优先走较快的 ImageMagick 转换。
          const outputBuffer = await convertHeicByImageMagick(tempInputPath)
          res.type('image/jpeg').send(outputBuffer)
          const endTime = Date.now()
          console.log('使用 ImageMagick 转换 HEIC 成功:', fileName, '耗时:', endTime - startTime, 'ms')
          return
        } catch (imageMagickError) {
          // 若 ImageMagick 不可用或该文件转换失败，回退到 heic-convert。
          console.warn('ImageMagick转换失败，降级到heic-convert:', imageMagickError?.message || imageMagickError)
          // 兜底方案质量更低，优先保证可用性和返回速度。
          const fileBuffer = await fs.promises.readFile(tempInputPath)
          const outputBuffer = await heicConvert({
            buffer: fileBuffer,
            format: 'JPEG',
            quality: HEIC_CONVERT_QUALITY
          })
          res.type('image/jpeg').send(Buffer.from(outputBuffer))
          return
        }
      }

      const fileBuffer = await fs.promises.readFile(tempInputPath)

      if (isRawImage(fileName, mimeType)) {
        // RAW 暂不转换，直接回传原始二进制
        res.type('application/octet-stream').send(fileBuffer)
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
