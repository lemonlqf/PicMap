/*
 * @Author: Do not edit
 * @Date: 2024-12-14 19:37:46
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-05 20:33:38
 * @FilePath: \PicMap\picMap_backend\utils\file\writeFile.js
 * @Description:
 */
const fs = require('node:fs')
const nodePath = require('node:path')
const globalVariables = require('../../public/globalVariable').globalVariables
const { getNewImageId, getImageId, getImageIdWithoutExtension } = require('../image/image.js')


/**
 * 从 Data URL 或纯 base64 字符串中提取可用于 Buffer 解码的 payload。
 * 兼容格式：
 * 1) data:image/png;base64,xxxxx
 * 2) data:image/heic;base64,xxxxx
 * 3) xxxxx（纯 base64）
 *
 * @param {string} dataUrl - 前端上传的 Data URL 或纯 base64 字符串
 * @returns {string} 提取后的 base64 payload；无效输入时返回空字符串
 */
function getBase64Payload(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
    return ''
  }
  const commaIndex = dataUrl.indexOf(',')
  // 如果存在逗号，取逗号后的部分；否则假设整个字符串是纯 base64
  return (commaIndex > -1 ? dataUrl.slice(commaIndex + 1) : dataUrl).trim()
}

/**
 * 解析最终落盘文件名。
 * - 有 id 时：使用 getImageId(id) 作为主文件名
 * - 无 id 时：使用 getNewImageId() 生成文件名
 * - 若主文件名不含后缀，则尝试从 imageName 补充后缀
 *
 * @param {string | undefined} id - 图片业务 id
 * @returns {string} 最终文件名（不含目录）
 */
function resolveFileName(id, extension) {
  const imageId = id ? getImageId(id) : getNewImageId()
  // 将id的后缀替换为extension，如果本来没有后缀的话就直接加上
  const baseName = getImageIdWithoutExtension(imageId)
  return `${baseName}${extension}`
}

/**
 * @description: 改变文件名的后缀为.jpg，适用于生成缩略图文件名
 * @param {*} id
 * @return {*}
 */
function changeExtensionToJpg(id) {
  const imageId = id ? getImageId(id) : getNewImageId()
  const baseName = getImageIdWithoutExtension(imageId)
  return `${baseName}.jpg`
}

/**
 * 确保目录存在，不存在则递归创建。
 *
 * @param {string} path - 目标目录
 * @returns {void}
 */
function ensureDir(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true })
  }
}

/**
 * 将 base64 字符串写入本地磁盘文件。
 *
 * @param {string} baseUrl - Data URL 或纯 base64 字符串
 * @param {string} [imageName='image.png'] - 原始文件名（用于后缀推断）
 * @param {string | undefined} id - 图片业务 id（用于生成稳定文件名）
 * @param {string} [savePath=globalVariables.imageFilePath] - 保存目录
 * @param {string} [prefix=''] - 文件名前缀（如缩略图前缀）
 * @returns {void}
 */
function writeBase64File(baseUrl, id, extension, savePath = globalVariables.imageFilePath, prefix = '') {
  const base64Payload = getBase64Payload(baseUrl)
  if (!base64Payload) {
    return
  }
  const dataBuffer = Buffer.from(base64Payload, 'base64')
  ensureDir(savePath)
  const fileName = prefix + resolveFileName(id, extension)
  const filePath = nodePath.join(savePath, fileName)

  // 写入文件，w为覆盖，a为累加
  fs.writeFile(filePath, dataBuffer, { flag: 'w' }, function (err) {
    if (err) {
      console.error('writeFile failed', err)
    } else {
      console.log(fileName)
    }
  })
}

module.exports = { writeBase64File, changeExtensionToJpg }
