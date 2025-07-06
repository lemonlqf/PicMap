/*
 * @Author: Do not edit
 * @Date: 2025-06-15 12:59:59
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-06 14:52:31
 * @FilePath: \Code\picMap_backend\routes\users.js
 * @Description: 
 */
var express = require('express')
var router = express.Router()
const Result = require('./resultCode/result.js')
var defaultSchema = require('../public/globalVariable').defaultSchema
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const { archiveDirectory } = require('../public/globalVariable')
const fs = require('node:fs')

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource')
})

// 初始化用户的目录和图片相关的schema
router.post('/createUser', function (req, res, next) {
  const { userId } = req.body
  const userDirectory = `${archiveDirectory}/${userId}`
  // 如果用户目录不存在，则创建
  if (!fs.existsSync(userDirectory)) {
    fs.mkdirSync(userDirectory, { recursive: true })
  }
  // 初始化schema
  const fileExists = fs.existsSync(getSchemaJSONPath(userId))
  if (!fileExists) {
    // 创建schema保存的目录
    fs.mkdirSync(getSchemaDirPath(userId), { recursive: true })
    // 在schema保存目录下创建一个初始化的 schema.json 文件
    fs.writeFileSync(getSchemaJSONPath(userId), defaultSchema, { encoding: 'utf-8' })
    res.send(Result.success('创建成功'))
  }
  res.send(Result.success('用户已存在'))
})

// 删除用户的目录和相关的schema
router.post('/deleteUser', function (req, res, next) {
  const { userId, currentUserId } = req.body
  const userDirectory = `${archiveDirectory}/${userId ?? currentUserId}`
  // 如果用户目录存在，则删除
  if (fs.existsSync(userDirectory)) {
    fs.rmSync(userDirectory, { recursive: true, force: true })
    res.send(Result.success('删除成功'))
  } else {
    res.send(Result.error('用户不存在'))
  }
})

module.exports = router
