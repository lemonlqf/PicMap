/*
 * @Author: Do not edit
 * @Date: 2025-01-26 13:17:04
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-26 13:48:18
 * @FilePath: \Code\picMap_backend\utils\image\image.js
 * @Description:
 */
const lodash = require('lodash')

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
 * @param {*} uid
 * @return {*}
 */
function getImageId(uid) {
  return `${IMAGE_ID_PREFIX}${uid}`
}

module.exports = {
  getNewImageId,
  getImageId
}
