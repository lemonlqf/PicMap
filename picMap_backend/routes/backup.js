/*
 * @Author: Do not edit
 * @Date: 2025-03-04
 * @Description: 数据备份和导入功能
 * 
 * 功能说明:
 * - backup: 创建备份，将所有数据打包成zip文件
 * - backupList: 获取备份文件列表
 * - import: 导入备份数据，支持覆盖和合并两种模式
 * - deleteBackup: 删除备份文件
 */
const express = require('express')
const router = express.Router()
const Result = require('./resultCode/result.js')
const fs = require('node:fs')
const path = require('node:path')
// archiveDirectory: 数据存储根目录，默认 D:/PicMap
const { archiveDirectory } = require('../public/globalVariable.js')
// archiver: 用于创建zip压缩文件
const archiver = require('archiver')
// node-stream-zip: 用于解压zip文件
const StreamZip = require('node-stream-zip')

/**
 * 创建备份
 * 将appSchema.json和所有用户数据打包成zip文件
 * 备份文件保存在 D:/PicMap_Backup 目录下
 */
router.post('/backup', async function (req, res, next) {
  try {
    // 创建备份目录，如果不存在则创建
    const backupDir = path.join(archiveDirectory, '..', 'PicMap_Backup')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    // 生成备份文件名，使用时间戳命名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFileName = `PicMap_Backup_${timestamp}.zip`
    const backupFilePath = path.join(backupDir, backupFileName)

    // 创建文件写入流和zip压缩对象
    const output = fs.createWriteStream(backupFilePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    // 压缩完成时的回调
    output.on('close', () => {
      res.send(Result.success({
        filePath: backupFilePath,
        fileName: backupFileName,
        size: archive.pointer()
      }))
    })

    // 压缩错误处理
    archive.on('error', (err) => {
      throw err
    })

    // 绑定输出流
    archive.pipe(output)

    // 备份应用配置文件 appSchema.json（包含用户列表等信息）
    const appSchemaSrc = path.join(archiveDirectory, 'appSchema.json')
    if (fs.existsSync(appSchemaSrc)) {
      archive.file(appSchemaSrc, { name: 'appSchema.json' })
    }

    // 遍历数据目录，备份所有用户数据
    const users = fs.readdirSync(archiveDirectory)
    for (const user of users) {
      // 跳过非目录文件（appSchema.json和备份文件）
      if (user === 'appSchema.json' || user.endsWith('.zip')) continue

      const userPath = path.join(archiveDirectory, user)
      if (fs.statSync(userPath).isDirectory()) {
        // 将用户目录添加到压缩包，保持目录结构
        archive.directory(userPath, user)
      }
    }

    // 完成压缩
    await archive.finalize()
  } catch (error) {
    console.error('Backup error:', error)
    res.send(Result.fail('备份失败: ' + error.message))
  }
})

/**
 * 获取备份文件列表
 * 返回备份目录中所有zip文件的信息
 */
router.get('/backupList', function (req, res, next) {
  try {
    const backupDir = path.join(archiveDirectory, '..', 'PicMap_Backup')
    if (!fs.existsSync(backupDir)) {
      return res.send(Result.success([]))
    }

    // 读取备份目录，筛选zip文件并获取文件信息
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.zip'))
      .map(f => {
        const filePath = path.join(backupDir, f)
        const stats = fs.statSync(filePath)
        return {
          fileName: f,
          filePath: filePath,
          size: stats.size,
          createTime: stats.birthtime
        }
      })
      // 按创建时间倒序排列
      .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))

    res.send(Result.success(files))
  } catch (error) {
    console.error('Get backup list error:', error)
    res.send(Result.fail('获取备份列表失败: ' + error.message))
  }
})

/**
 * 导入数据
 * @param {string} filePath - 备份文件路径
 * @param {string} mode - 导入模式: 'cover'(覆盖) 或 'merge'(合并)
 *
 * 覆盖模式: 先删除现有所有数据，再解压备份文件
 * 合并模式: 保留现有数据，将备份中的新数据添加到现有数据中
 */
router.post('/import', async function (req, res, next) {
  try {
    const { filePath, mode } = req.body

    // 验证备份文件是否存在
    if (!filePath || !fs.existsSync(filePath)) {
      return res.send(Result.fail('备份文件不存在'))
    }

    // 打开zip文件
    const zip = new StreamZip.async({ file: filePath })

    // 获取zip中的文件列表
    const entries = await zip.entries()
    const entryNames = Object.keys(entries)

    // 验证是否是有效的备份文件（必须包含appSchema.json）
    if (!entryNames.includes('appSchema.json')) {
      await zip.close()
      return res.send(Result.fail('无效的备份文件'))
    }

    // 覆盖模式：先删除现有所有用户数据
    if (mode === 'cover') {
      const users = fs.readdirSync(archiveDirectory)
      for (const user of users) {
        if (user === 'appSchema.json' || user.endsWith('.zip')) continue
        const userPath = path.join(archiveDirectory, user)
        if (fs.statSync(userPath).isDirectory()) {
          fs.rmSync(userPath, { recursive: true, force: true })
        }
      }
    }

    // 创建临时目录用于解压
    const tempDir = path.join(archiveDirectory, '..', 'PicMap_Temp_Import')
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    fs.mkdirSync(tempDir, { recursive: true })

    // 解压zip文件到临时目录
    await zip.extract(null, tempDir)
    await zip.close()

    // 导入应用配置文件 appSchema.json
    const tempAppSchema = path.join(tempDir, 'appSchema.json')
    if (fs.existsSync(tempAppSchema)) {
      const targetAppSchema = path.join(archiveDirectory, 'appSchema.json')
      fs.copyFileSync(tempAppSchema, targetAppSchema)
    }

    // 导入用户数据
    const tempUsers = fs.readdirSync(tempDir)
    for (const user of tempUsers) {
      if (user === 'appSchema.json') continue

      const srcPath = path.join(tempDir, user)
      const destPath = path.join(archiveDirectory, user)

      if (fs.statSync(srcPath).isDirectory()) {
        if (fs.existsSync(destPath)) {
          // 合并模式：将备份中的新图片和schema数据添加到现有数据中
          if (mode === 'merge') {
            // 复制不存在的图片文件
            const srcImages = path.join(srcPath, 'images')
            const destImages = path.join(destPath, 'images')
            if (fs.existsSync(srcImages) && fs.existsSync(destImages)) {
              const srcFiles = fs.readdirSync(srcImages)
              for (const file of srcFiles) {
                const destFile = path.join(destImages, file)
                if (!fs.existsSync(destFile)) {
                  fs.copyFileSync(path.join(srcImages, file), destFile)
                }
              }
            }
            // 合并 schema.json 中的数据
            const srcSchema = path.join(srcPath, 'images', 'schema', 'schema.json')
            const destSchema = path.join(destPath, 'images', 'schema', 'schema.json')
            if (fs.existsSync(srcSchema) && fs.existsSync(destSchema)) {
              const srcData = JSON.parse(fs.readFileSync(srcSchema, { encoding: 'utf-8' }))
              const destData = JSON.parse(fs.readFileSync(destSchema, { encoding: 'utf-8' }))

              // 合并图片信息：只添加不存在的图片
              const existImageIds = new Set(destData.imageInfo.map(img => img.id))
              const existGroupIds = new Set(destData.groupInfo.map(g => g.id))

              for (const img of srcData.imageInfo) {
                if (!existImageIds.has(img.id)) {
                  destData.imageInfo.push(img)
                }
              }

              // 合并分组信息：只添加不存在的分组
              for (const group of srcData.groupInfo) {
                if (!existGroupIds.has(group.id)) {
                  destData.groupInfo.push(group)
                }
              }

              fs.writeFileSync(destSchema, JSON.stringify(destData, null, 2))
            }
          }
        } else {
          // 新用户目录直接移动到数据目录
          fs.renameSync(srcPath, destPath)
        }
      }
    }

    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true })

    res.send(Result.success('导入成功'))
  } catch (error) {
    console.error('Import error:', error)
    res.send(Result.fail('导入失败: ' + error.message))
  }
})

/**
 * 删除备份文件
 * 根据文件路径删除指定的备份文件
 */
router.post('/deleteBackup', function (req, res, next) {
  try {
    const { filePath } = req.body
    if (!filePath || !fs.existsSync(filePath)) {
      return res.send(Result.fail('备份文件不存在'))
    }

    // 删除文件
    fs.unlinkSync(filePath)
    res.send(Result.success('删除成功'))
  } catch (error) {
    console.error('Delete backup error:', error)
    res.send(Result.fail('删除失败: ' + error.message))
  }
})

module.exports = router
