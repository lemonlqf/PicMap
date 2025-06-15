/*
 * @Author: Do not edit
 * @Date: 2025-06-12 21:07:12
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-15 13:24:12
 * @FilePath: \Code\main.js
 * @Description: 
 */
import { app, BrowserWindow } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { fork } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let backendProcess
// 确保只运行一个实例， 防止多开
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // 预处理，和本帖子内容无关
      preload: path.join(__dirname, 'preload.js')
    }
  })
  // 获取前端打包产物的入口文件
  win.loadFile(path.join(__dirname, 'picMap_fontend/dist/index.html'))
}

app.whenReady().then(() => {
  if (!process.env.BACKEND_STARTED) {
    // 后端node产物路径
    const backendPath = path.join(__dirname, './picMap_backend/dist/app.bundle.js');
    // 启动后端node服务
    backendProcess = fork(
      backendPath,
      [],
      {
        execPath: process.execPath, // 指定使用 Electron 自带 Node
        env: { ...process.env, BACKEND_STARTED: 'true' }
      }
    );
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill()
    app.quit()
  }
})