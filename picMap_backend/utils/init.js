/*
 * @Author: Do not edit
 * @Date: 2025-06-29 13:32:47
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 13:56:00
 * @FilePath: \Code\picMap_backend\utils\init.js
 * @Description: 
 */
const { appSchemaPath, defaultAppInfo, archiveDirectory, setUserName } = require('../public/globalVariable')
const fs = require('node:fs')

// 初始化appInfoJSON文件
function initAppInfoJSON() {
  let appInfo = defaultAppInfo
  // 判断文件是否存在
  const fileExists = fs.existsSync(appSchemaPath)
  if (!fileExists) {
    // 创建schema保存的目录
    fs.mkdirSync(archiveDirectory, { recursive: true })
    // 在schema保存目录下创建一个初始化的 appSchema.json 文件
    fs.writeFileSync(appSchemaPath, defaultAppInfo, { encoding: 'utf-8' })
  } else {
    appInfo = fs.readFileSync(appSchemaPath, { encoding: 'utf-8' })
  }
  return appInfo
}

// 初始化用户目录
function initUsersDirectory(userInfos = defaultAppInfo.userInfos) {
  userInfos.forEach(user => {
    const userDirectory = `${archiveDirectory}/${user.userId}`
    // 如果用户目录不存在，则创建
    if (!fs.existsSync(userDirectory)) {
      fs.mkdirSync(userDirectory, { recursive: true })
    }
  })
}

function init() {
  // 初始化应用信息JSON文件
  const appInfo = initAppInfoJSON()
  // 初始化用户目录
  initUsersDirectory(JSON.parse(appInfo).userInfos)
  // 取第零个用户的userId作为默认用户
  const defaultShowUserId = JSON.parse(appInfo).userInfos[0].userId
  // 设置当前用户的存档目录
  setUserName(defaultShowUserId)
}

module.exports = {
  init
}