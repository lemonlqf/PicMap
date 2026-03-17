/*
 * @Author: Do not edit
 * @Date: 2025-01-26 13:17:04
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-17 17:16:01
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
const RAW_TYPES = [
  'image/x-raw',
  'image/x-adobe-dng',
  'image/x-canon-cr2',
  'image/x-nikon-nef',
  'image/x-olympus-orf',
  'image/x-panasonic-rw2',
  'image/x-sony-arw',
  'image/x-fuji-raf',
  'image/x-canon-cr3',
  'image/erf',
  'image/x-gopro-gpr'
]
const RAW_EXTENSIONS = [
  '.raw',
  '.dng',
  '.arw',
  '.cr2',
  '.nef',
  '.orf',
  '.rw2',
  '.cr3',
  '.raf',
  '.erf',
  '.gpr'
]
// heicConvert默认转换质量较高，文件较大，这里设置一个较低的质量，转换速度会更快，且用于缩略图展示足够了
const HEIC_CONVERT_QUALITY = 0.01
// imageMagick转换HEIC的质量参数，取值范围0-100，数值越大质量越好但文件越大，默认80是一个比较常见的选择
const IMAGE_MAGICK_JPEG_QUALITY = 25
// dcraw转换raw的质量参数，取值范围0-100，数值越大质量越好但文件越大，默认60是一个比较常见的选择
const RAW_CONVERT_JPEG_QUALITY = 20
function resolveBackendRoot() {
  const candidates = [
    process.env.PICMAP_BACKEND_ROOT,
    nodePath.resolve(__dirname, '..', '..'),
    nodePath.resolve(__dirname, '..'),
    process.resourcesPath ? nodePath.join(process.resourcesPath, 'app', 'picMap_backend') : '',
    process.resourcesPath ? nodePath.join(process.resourcesPath, 'picMap_backend') : '',
    nodePath.join(process.cwd(), 'picMap_backend')
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(nodePath.join(candidate, 'tools'))) {
      return candidate
    }
  }

  return candidates[0]
}

const BACKEND_ROOT = resolveBackendRoot()
// 项目内置 ImageMagick 路径（优先使用便携版，避免依赖系统安装）。
const EMBEDDED_MAGICK_WINDOWS = nodePath.join(BACKEND_ROOT, 'tools', 'imagemagick', 'magick.exe')
const EMBEDDED_MAGICK_UNIX = nodePath.join(BACKEND_ROOT, 'tools', 'imagemagick', 'bin', 'magick')
const EMBEDDED_DCRAW_WINDOWS = nodePath.join(BACKEND_ROOT, 'tools', 'dcraw', 'dcraw.exe')
const EMBEDDED_DCRAW_UNIX = nodePath.join(BACKEND_ROOT, 'tools', 'dcraw', 'dcraw')
const EMBEDDED_DCRAW_EMU_WINDOWS = nodePath.join(BACKEND_ROOT, 'tools', 'libraw', 'dcraw_emu.exe')

function execFileAsync(command, args, timeout = 20000, cwd = undefined) {
  return new Promise((resolve, reject) => {
    // 统一封装子进程调用，便于后续加超时、日志和错误处理。
    execFile(command, args, { timeout, cwd }, (error, stdout, stderr) => {
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
 * @description: 获取 dcraw 命令的候选列表，优先级为：环境变量指定 > 项目内置 > 系统 PATH
 * @return {*}
 */
function getDcrawCommandCandidates() {
  const candidates = []

  if (process.env.DCRAW_BIN) {
    candidates.push(process.env.DCRAW_BIN)
  }

  if (process.platform === 'win32') {
    candidates.push(EMBEDDED_DCRAW_WINDOWS)
    candidates.push('dcraw.exe')
  } else {
    candidates.push(EMBEDDED_DCRAW_UNIX)
  }

  candidates.push('dcraw')

  // 去重后仅保留可执行项，避免重复重试同一命令。
  return [...new Set(candidates)].filter(cmd => {
    if (cmd === 'dcraw' || cmd === 'dcraw.exe') return true
    return fs.existsSync(cmd)
  })
}

/**
 * @description: 获取 dcraw_emu 命令的候选列表，优先级为：环境变量指定 > 项目内置
 * @return {*}
 */
function getDcrawEmuCommandCandidates() {
  const candidates = []

  if (process.env.DCRAW_EMU_BIN) {
    candidates.push(process.env.DCRAW_EMU_BIN)
  }

  if (process.platform === 'win32') {
    candidates.push(EMBEDDED_DCRAW_EMU_WINDOWS)
  }

  return candidates.filter(cmd => {
    return fs.existsSync(cmd)
  })
}

function isEnoentError(error) {
  return error && (error.code === 'ENOENT' || error.errno === -4058)
}

function isWindowsDcrawCrash(error) {
  return process.platform === 'win32' && Number(error?.code) === 3221225781
}

async function prepareTempInputWithExtension(inputPath, originalFileName) {
  if (!originalFileName) {
    return { path: inputPath, cleanup: async () => { } }
  }

  const safeOriginalName = nodePath.basename(originalFileName)
  const originalExt = nodePath.extname(safeOriginalName).toLowerCase()
  if (!originalExt) {
    return { path: inputPath, cleanup: async () => { } }
  }

  // 为每次转换创建独立临时目录，防止同名文件并发冲突。
  const inputWorkDir = await fs.promises.mkdtemp(nodePath.join(os.tmpdir(), 'picmap_input_'))
  const copiedPath = nodePath.join(inputWorkDir, safeOriginalName)
  // 使用“原始文件名+扩展名”复制输入，提升 dcraw 对格式的识别成功率。
  await fs.promises.copyFile(inputPath, copiedPath)

  return {
    path: copiedPath,
    cleanup: async () => {
      await fs.promises.rm(inputWorkDir, { recursive: true, force: true }).catch(() => { })
    }
  }
}

/**
 * @description: 使用 dcraw 提取缩略图到缓冲区
 * @param {*} command
 * @param {*} inputPath
 * @return {*}
 */
async function runDcrawExtractThumbnailToBuffer(command, inputPath) {
  const workDir = nodePath.dirname(inputPath)
  const inputName = nodePath.basename(inputPath)
  const baseName = nodePath.basename(inputName, nodePath.extname(inputName))

  try {
    // 关键：在输入文件所在目录执行，dcraw 使用相对文件名时才能命中目标文件。
    await execFileAsync(command, ['-e', inputName], 30000, workDir)

    const thumbJpgPath = nodePath.join(workDir, `${baseName}.thumb.jpg`)
    const thumbPpmPath = nodePath.join(workDir, `${baseName}.thumb.ppm`)

    if (fs.existsSync(thumbJpgPath)) {
      return await fs.promises.readFile(thumbJpgPath)
    }

    if (fs.existsSync(thumbPpmPath)) {
      const ppmBuffer = await fs.promises.readFile(thumbPpmPath)
      return await sharp(ppmBuffer)
        .jpeg({ quality: RAW_CONVERT_JPEG_QUALITY })
        .toBuffer()
    }

    // 不同机型输出后缀可能不同，兜底扫描 .thumb.*。
    const outputCandidates = glob.sync(`${workDir}/${baseName}.thumb.*`)
    if (outputCandidates.length === 0) {
      throw new Error('dcraw -e succeeded but no thumbnail file generated')
    }

    const outputPath = outputCandidates[0]
    const ext = nodePath.extname(outputPath).toLowerCase()
    const outputBuffer = await fs.promises.readFile(outputPath)
    // 如果是 PPM 格式，需额外转换为 JPEG；如果已经是 JPEG 了，直接返回。
    if (ext === '.ppm') {
      return await sharp(outputBuffer)
        .jpeg({ quality: RAW_CONVERT_JPEG_QUALITY })
        .toBuffer()
    }
    return outputBuffer
  } finally {
    const generatedFiles = glob.sync(`${workDir}/${baseName}.thumb.*`)
    await Promise.allSettled(generatedFiles.map(file => fs.promises.rm(file, { force: true })))
  }
}

/**
 * @description: 完整解码 RAW 到 JPEG，适用于没有内嵌缩略图或缩略图提取失败的情况，处理时间较长。
 * @param {*} command
 * @param {*} inputPath
 * @return {*}
 */
async function runDcrawDecodeToJpegBuffer(command, inputPath) {
  const workDir = nodePath.dirname(inputPath)
  const inputName = nodePath.basename(inputPath)
  const baseName = nodePath.basename(inputName, nodePath.extname(inputName))

  try {
    // 提取缩略图失败时，走完整解码路径输出 PPM/PGM。
    await execFileAsync(command, ['-w', '-q', '3', '-6', inputName], 120000, workDir)

    const outputCandidates = [
      ...glob.sync(`${workDir}/${baseName}.ppm`),
      ...glob.sync(`${workDir}/${baseName}.pgm`),
    ]

    const outputPath = outputCandidates[0]
    if (!outputPath) {
      throw new Error('dcraw decode succeeded but no PPM/PGM file generated')
    }

    const outputBuffer = await fs.promises.readFile(outputPath)
    return await sharp(outputBuffer)
      .jpeg({ quality: RAW_CONVERT_JPEG_QUALITY })
      .toBuffer()
  } finally {
    const generatedFiles = [
      ...glob.sync(`${workDir}/${baseName}.ppm`),
      ...glob.sync(`${workDir}/${baseName}.pgm`),
    ]
    await Promise.allSettled(generatedFiles.map(file => fs.promises.rm(file, { force: true })))
  }
}

async function runDcrawEmuToJpegBuffer(dcrawEmuCommand, magickCommand, inputPath) {
  const workDir = nodePath.dirname(inputPath)
  const inputName = nodePath.basename(inputPath)
  const baseName = nodePath.basename(inputName, nodePath.extname(inputName))

  try {
    // 使用 dcraw_emu 将 RAW 转换为 TIFF
    await execFileAsync(dcrawEmuCommand, ['-T', inputName], 120000, workDir)

    const tiffCandidates = glob.sync(`${workDir}/${baseName}*.tiff`)
    const tiffFile = tiffCandidates.find(f => fs.existsSync(f))
    if (!tiffFile) {
      throw new Error('dcraw_emu succeeded but no TIFF file generated')
    }

    // 使用 ImageMagick 将 TIFF 转换为 JPEG
    const tiffBuffer = await fs.promises.readFile(tiffFile)
    return await sharp(tiffBuffer)
      .jpeg({ quality: RAW_CONVERT_JPEG_QUALITY })
      .toBuffer()
  } finally {
    const generatedFiles = glob.sync(`${workDir}/${baseName}*.tiff`)
    await Promise.allSettled(generatedFiles.map(file => fs.promises.rm(file, { force: true })))
  }
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
    await fs.promises.rm(outputPath, { force: true }).catch(() => { })
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

async function convertRawToJpegBuffer(tempInputPath, originalFileName = '') {
  // 将 formidable 的临时文件转换为"带原始扩展名"的输入，避免 dcraw 识别失败。
  const preparedInput = await prepareTempInputWithExtension(tempInputPath, originalFileName)
  const inputPath = preparedInput.path

  // 尝试 dcraw 提取缩略图的命令
  const commands = getDcrawCommandCandidates()

  // 尝试 dcraw_emu 将raw转换为tiff
  const dcrawEmuCommands = getDcrawEmuCommandCandidates()
  // 尝试 ImageMagick 转换的命令列表（仅在使用 dcraw_emu 时需要）。
  const magickCommands = getImageMagickCommandCandidates()

  let lastError
  let firstNonEnoentError

  if (commands.length === 0) {
    throw new Error(`dcraw not found, expected at ${EMBEDDED_DCRAW_WINDOWS} or ${EMBEDDED_DCRAW_UNIX}`)
  }

  try {
    // 第一优先级：尝试使用 dcraw 提取内嵌缩略图（速度最快）。
    for (const command of commands) {
      try {
        return await runDcrawExtractThumbnailToBuffer(command, inputPath)
      } catch (error) {
        lastError = error
        if (isWindowsDcrawCrash(error)) {
          console.warn('dcraw.exe 进程异常退出(3221225781)，可能是缺少运行库或二进制不兼容，将继续尝试其它 dcraw 候选。')
        }
        if (!isEnoentError(error) && !firstNonEnoentError) {
          firstNonEnoentError = error
        }
      }
    }

    // 第二优先级：使用 dcraw_emu 转换为 TIFF，再使用 ImageMagick 转换为 JPEG。
    for (const dcrawEmuCommand of dcrawEmuCommands) {
      for (const magickCommand of magickCommands) {
        try {
          console.log(`尝试使用 dcraw_emu 转换: ${dcrawEmuCommand}`)
          return await runDcrawEmuToJpegBuffer(dcrawEmuCommand, magickCommand, inputPath)
        } catch (error) {
          lastError = error
          console.warn(`dcraw_emu 转换失败: ${error.message}`)
          if (!isEnoentError(error) && !firstNonEnoentError) {
            firstNonEnoentError = error
          }
        }
      }
    }

    // 优先抛出最有诊断价值的错误，附带候选命令与环境提示。
    const baseError = firstNonEnoentError || lastError || new Error('dcraw failed')
    const detail = [
      'RAW convert failed',
      `input=${inputPath}`,
      `backendRoot=${BACKEND_ROOT}`,
      `dcrawCandidates=${commands.join(', ')}`,
      `dcrawEmuCandidates=${dcrawEmuCommands.join(', ')}`,
      'hint=你可以设置环境变量 DCRAW_BIN 指向可用的 dcraw.exe',
      'hint=你可以设置环境变量 DCRAW_EMU_BIN 指向可用的 dcraw_emu.exe',
      'hint=你也可以设置环境变量 PICMAP_BACKEND_ROOT 指向 picMap_backend 目录',
      'hint=Windows 3221225781 常见于运行库缺失或二进制架构不匹配'
    ].join('; ')
    baseError.message = `${baseError.message}; ${detail}`
    throw baseError
  } finally {
    await preparedInput.cleanup()
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
  convertRawToJpegBuffer,
  THUMBNAIL_PREFIX,
  getImageIdWithoutExtension
}
