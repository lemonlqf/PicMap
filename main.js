/*
 * @Author: Do not edit
 * @Date: 2025-06-12 21:07:12
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-14 19:42:34
 * @FilePath: \Code\main.js
 * @Description: 
 */
import { app, BrowserWindow } from 'electron'
import { fileURLToPath, pathToFileURL } from 'url'
import path from 'path'
import { execFile } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let backendProcess

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })
  console.log(path.join(__dirname, 'picMap_fontend/dist/index.html'))
  win.loadFile(path.join(__dirname, 'picMap_fontend/dist/index.html'))
}

app.whenReady().then(() => {
  if (!process.env.BACKEND_STARTED) {
    const backendPath = path.join(__dirname, './picMap_backend/dist/app.bundle.js')
    console.log('---', backendPath)
    backendProcess = execFile(
      process.execPath, // Node 解释器
      [backendPath],
      {
        env: { ...process.env, BACKEND_STARTED: 'true' }
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error('后端服务启动失败:', error)
        }
        if (stdout) {
          console.log('后端服务输出:', stdout)
        }
        if (stderr) {
          console.error('后端服务错误:', stderr)
        }
      }
    )
  }
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill()
    app.quit()
  }
})