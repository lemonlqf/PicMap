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
const { Blob } = require('buffer')
const sharp = require('sharp')
const { getImageFilePath } = require('../../public/globalVariable')
const nodePath = require('node:path')

// 图片id前缀
const IMAGE_ID_PREFIX = 'PM'
// 缩略图文件名前缀,在id的后面
const THUMBNAIL_PREFIX = '_THUMBNAIL_'

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
  THUMBNAIL_PREFIX,
  getImageIdWithoutExtension
}
