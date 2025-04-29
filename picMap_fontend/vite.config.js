/*
 * @Author: Do not edit
 * @Date: 2024-12-12 19:00:05
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-04-29 23:06:02
 * @FilePath: \Code\picMap_fontend\vite.config.js
 * @Description:
 */
import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    hmr: true
  },
  resolve: {
    api: 'modern-compiler',
    alias: {
      '@': resolve(__dirname, 'src') // 路径别名
    },
    extensions: ['.js', '.json', '.vue', '.ts']
  }
})
