/*
 * @Author: Do not edit
 * @Date: 2025-01-26 13:17:04
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 14:02:48
 * @FilePath: \Code\picMap_backend\utils\image\image.js
 * @Description:
 */
const lodash = require('lodash')
const glob = require('glob')
const fs = require('node:fs')
const { Blob } = require('buffer')
const sharp = require('sharp')
const globalVariables = require('../../public/globalVariable').globalVariables
// 图片id前缀
const IMAGE_ID_PREFIX = 'PM'

/**
 * @description: 生成新的图片id
 * @return {*}
 */
function getNewImageId() {
  return `${lodash.uniqueId(IMAGE_ID_PREFIX)}`
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
 * @description: 根据id获取缩略图文件
 * @param {*} id
 * @return {*}
 */
async function getSmallImageFileById(id) {
  const filesPath = glob.sync(`${globalVariables.imageFilePath}/${getImageId(id)}*`)
  if (filesPath.length === 0) {
    return null
  } else {
    try {
      const data = await sharp(filesPath[0])
        .resize(800)
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
function getImageFileById(id) {
  const filesPath = glob.sync(`${globalVariables.imageFilePath}${getImageId(id)}*`)
  if (filesPath.length === 0) {
    return null
  } else {
    // 读取文件
    const file = fs.readFileSync(filesPath[0])
    const baseUrl = file.toString('base64')
    return baseUrl
  }
}

module.exports = {
  getNewImageId,
  getImageId,
  getImageFileById,
  getSmallImageFileById,
}
