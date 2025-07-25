/*
 * @Author: Do not edit
 * @Date: 2024-12-14 19:37:46
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-19 23:05:26
 * @FilePath: \Code\picMap_backend\utils\file\writeFile.js
 * @Description:
 */
const { error } = require('node:console')
const fs = require('node:fs')
const globalVariables = require('../../public/globalVariable').globalVariables
const { getNewImageId, getImageId } = require('../image/image.js')

/**
 * @description: 将base64写入本地
 * @param {*} baseUrl，文件字符串
 * @param {*} imageName，文件名称
 * @param {*} id，图片id
 * @param {*} path，保存路径，基于public
 * @return {*}
 */
function writeBase64File(baseUrl, imageName = 'image.png', id, path = globalVariables.imageFilePath) {
  //接收前台POST过来的base64
  var imgData = baseUrl
  //过滤data:URL
  var base64Data = imgData.replace(/^data:image\/\w+;base64,/, '')
  // var base64Data = imgData
  // 返回一个被 string 的值初始化的新的 Buffer 实例,原始二进制数据存储在 Buffer 类的实例中，        一个 Buffer 类似于一个整数数组，但它对应于 V8 堆内存之外的一块原始内存。
  var dataBuffer = Buffer.from(base64Data, 'base64')
  // 如果无目录先创建目录，否则会报没有目录的错误
  !fs.existsSync(path) && fs.mkdirSync(path, { recursive: true })
  let filePath = ''
  if (id) {
    filePath = `${path}/${getImageId(id)}`
  } else {
    filePath = `${path}/${getNewImageId()}`
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
