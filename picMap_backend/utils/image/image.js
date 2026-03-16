/*
 * @Author: Do not edit
 * @Date: 2025-01-26 13:17:04
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-05 20:54:00
 * @FilePath: \PicMap\picMap_backend\utils\image\image.js
 * @Description:
 */
const lodash = require('lodash')
const glob = require('glob')
const fs = require('node:fs')
const os = require('node:os')
const { execFile } = require('node:child_process')
const { Blob } = require('buffer')
const sharp = require('sharp')
const heicConvert = require('heic-convert')
const { getImageFilePath } = require('../../public/globalVariable')
const nodePath = require('node:path')

// 图片id前缀
const IMAGE_ID_PREFIX = 'PM'
// 缩略图文件名前缀,在id的后面
const THUMBNAIL_PREFIX = '_THUMBNAIL_'
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
const BACKEND_ROOT = nodePath.resolve(__dirname, '..', '..')
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

async function convertHeicToJpegBuffer(tempInputPath) {
  try {
    return await convertHeicByImageMagick(tempInputPath)
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
    return Buffer.from(outputBuffer)
  }
}

/**
 * @description: 生成新的图片id
 * @return {*}
 */
function getNewImageId() {
  return `${IMAGE_ID_PREFIX}${lodash.uniqueId(IMAGE_ID_PREFIX)}`
}

/**
 * @description: 通过uid生成图片id，优先使用uid生产图片id
 * @param {*} id
 * @return {*}
 */
function getImageId(id) {
  return `${IMAGE_ID_PREFIX}${id}`
}

/**
 * @description: 通过id获取缩略图id
 * @param {*} id
 * @return {*}
 */
function getThumbnailId(id) {
  // 缩略图的id在原id的基础上加上_THUMBNAIL_前缀，后缀统一改为.jpg
  const baseName = getImageIdWithoutExtension(id)
  const imageId = getImageId(baseName) + '.jpg'
  return `${THUMBNAIL_PREFIX}${imageId}`
}

/**
 * @description: 根据id获取缩略图文件
 * @param {*} id
 * @return {*}
 */
async function getSmallImageFileById(id, userId) {
  // 缩略图
  const thumbnailFilesPath = glob.sync(`${getImageFilePath(userId)}/${getThumbnailId(id)}*`)
  // 原图
  const filesPath = glob.sync(`${getImageFilePath(userId)}/${getImageId(id)}*`)
  // 如果缩略图和原图都不存在的话就返回null
  if (thumbnailFilesPath.length === 0 && filesPath.length === 0) {
    return null
  } else {
    try {
      let path = filesPath[0]
      let quality = 800
      // 如果有缩略图的话就使用缩略图，否则使用原图生成缩略图
      if (thumbnailFilesPath.length > 0) {
        quality = 1000
        path = thumbnailFilesPath[0]
      }
      // 生成缩略图
      const data = await sharp(path)
        .resize(quality)
        .rotate() // 调整图片宽度，保持纵横比
        .toBuffer()
      const baseUrl = data.toString('base64')
      return baseUrl
    } catch (error) {
      // 获取缩略图失败直接返回原图
      // 读取文件
      const file = fs.readFileSync(filesPath[0])
      const baseUrl = file.toString('base64')
      return baseUrl
    }
  }
}

/**
 * @description: 根据id获取图片文件
 * @param {*} id
 * @return {*}
 */
function getImageFileById(id, userId) {
  const filesPath = glob.sync(`${getImageFilePath(userId)}/${getImageId(id)}*`)
  if (filesPath.length === 0) {
    return null
  } else {
    // 读取文件
    const file = fs.readFileSync(filesPath[0])
    const baseUrl = file.toString('base64')
    return baseUrl
  }
}

function getImageIdWithoutExtension(id) {
  return nodePath.basename(id, nodePath.extname(id))
}

module.exports = {
  getNewImageId,
  getImageId,
  getThumbnailId,
  getImageFileById,
  getSmallImageFileById,
  isHeicImage,
  isRawImage,
  convertHeicToJpegBuffer,
  THUMBNAIL_PREFIX,
  getImageIdWithoutExtension
}
