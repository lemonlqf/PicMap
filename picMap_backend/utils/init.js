/*
 * @Author: Do not edit
 * @Date: 2025-06-29 13:32:47
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-07-14 14:56:25
 * @FilePath: \Code\picMap_backend\utils\init.js
 * @Description: 
 */
const os = require('os');
const { appSchemaPath, defaultAppInfo, archiveDirectory, setUserName, setArchiveDirectory } = require('../public/globalVariable')
const fs = require('node:fs')
const path = require('path');

// 初始化存档目录
function initArchiveDirectory() {
  if (os.platform() === 'win32') {
    // Windows系统
    function findFirstAvailableDrive() {
      for (let drive = 68; drive <= 90; drive++) { // 从D盘（68对应'D'）开始
        const driveLetter = String.fromCharCode(drive);
        const drivePath = `${driveLetter}:/`;
        try {
          fs.accessSync(drivePath, fs.constants.F_OK);
          return driveLetter;
        } catch (e) {
          // 忽略，继续下一个盘符
        }
      }
      return null;
    }
    const driveLetter = findFirstAvailableDrive();
    if (driveLetter) {
      setArchiveDirectory(`${driveLetter}:/PicMap`);
    } else {
      // 没有找到非C盘的其他盘符，使用用户主目录
      setArchiveDirectory(path.join(os.homedir(), 'PicMap'));
    }
  } else {
    // 非Windows系统，直接使用用户主目录
    setArchiveDirectory(path.join(os.homedir(), 'PicMap'));
  }
}

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
  // 初始化存档目录
  initArchiveDirectory()
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