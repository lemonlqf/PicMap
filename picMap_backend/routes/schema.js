/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:30:32
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 16:44:48
 * @FilePath: \Code\picMap_backend\routes\schema.js
 * @Description:
 */
var express = require('express')
var router = express.Router()
var defaultSchema = require('../public/globalVariable').defaultSchema
const fs = require('node:fs')
const { getSchemaDirPath, getSchemaJSONPath, getImageFilePath, } = require('../public/globalVariable')
const Result = require('./resultCode/result.js')

/* GET schema. */
router.get('/getSchema', function (req, res, next) {
  const { currentUserId } = req.query
  let schema = null
  // 判断文件是否存在
  const fileExists = fs.existsSync(getSchemaJSONPath(currentUserId))
  if (!fileExists) {
    // 创建schema保存的目录
    fs.mkdirSync(getSchemaDirPath(currentUserId), { recursive: true })
    // 在schema保存目录下创建一个初始化的 schema.json 文件
    fs.writeFileSync(getSchemaJSONPath(currentUserId), defaultSchema, { encoding: 'utf-8' })
    schema = defaultSchema
  } else {
    schema = fs.readFileSync(getSchemaJSONPath(currentUserId), { encoding: 'utf-8' })
  }

  res.send(Result.success(schema))
})

/**
 * 原子写入 schema 文件
 * 采用"写临时文件 + 原子重命名"的策略，防止写入过程中崩溃导致数据损坏
 *
 * 原理：
 * 1. 先将数据写入 .tmp 临时文件
 * 2. 临时文件写成功后，使用 fs.renameSync 原子替换原文件
 * 3. rename 是操作系统级原子操作，要么成功要么失败，不存在中间状态
 *
 * @param {string} filePath - 目标文件路径
 * @param {string} data - 要写入的数据（JSON 字符串）
 */
function atomicWriteFile(filePath, data) {
  const tmpPath = filePath + '.tmp'
  const dirPath = require('node:path').dirname(filePath)

  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  // Step 1: 写入临时文件
  fs.writeFileSync(tmpPath, data, { encoding: 'utf-8' })

  // Step 2: 原子替换原文件（POSIX 标准保证原子性）
  fs.renameSync(tmpPath, filePath)
}

router.post('/setSchema', function (req, res, next) {
  const { currentUserId } = req.body
  const schema = req.body.schema

  if (!schema) {
    res.send(Result.fail('schema数据不能为空'))
    return
  }

  try {
    const schemaPath = getSchemaJSONPath(currentUserId)
    atomicWriteFile(schemaPath, schema)
    res.send(Result.success('schema数据更新成功！'))
  } catch (error) {
    console.error('保存schema失败:', error)
    res.send(Result.fail('保存schema失败'))
  }
})

module.exports = router
