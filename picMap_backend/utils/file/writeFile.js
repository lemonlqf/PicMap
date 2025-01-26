/*
 * @Author: Do not edit
 * @Date: 2024-12-14 19:37:46
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2025-01-25 20:02:26
 * @FilePath: \PicMap\picMap_backend\utils\file\writeFile.js
 * @Description:
 */
const { error } = require('node:console')
const fs = require('node:fs')
const path = require('path')
const globalVariables = require('../../public/globalVariable')
const { getNewImageId, getImageId } = require('../image/image.js')

/**
 * @description: 将base64写入本地
 * @param {*} baseUrl，文件字符串
 * @param {*} imageName，文件名称
 * @param {*} uid，图片id
 * @param {*} path，保存路径，基于public
 * @return {*}
 */
function writeBase64File(baseUrl, imageName = 'image.png', uid, path = globalVariables.imageFilePath) {
  //接收前台POST过来的base64
  var imgData = baseUrl
  //过滤data:URL
  var base64Data = imgData.replace(/^data:image\/\w+;base64,/, '')
  // var base64Data = imgData
  // 返回一个被 string 的值初始化的新的 Buffer 实例,原始二进制数据存储在 Buffer 类的实例中，        一个 Buffer 类似于一个整数数组，但它对应于 V8 堆内存之外的一块原始内存。
  var dataBuffer = Buffer.from(base64Data, 'base64')
  // 如果无目录先创建目录，否则会报没有目录的错误
  !fs.existsSync(path) && fs.mkdirSync(path)
  let filePath = ''
  if (uid) {
    // 所有文件名前都加上一个新的图片id
    filePath = `${path}${getImageId(uid)}_${imageName}`
  } else {
    filePath = `${path}${getNewImageId()}_${imageName}`
  }
  // 写入文件，w为覆盖，a为累加
  fs.writeFile(filePath, dataBuffer, { flag: 'w' }, function (err) {
    if (err) {
      console.error('writeFile failed', error)
    } else {
      console.log(imageName)
    }
  })
}

module.exports = { writeBase64File }
