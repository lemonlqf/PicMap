/*
 * @Author: Do not edit
 * @Date: 2024-12-12 19:00:05
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-13 11:51:14
 * @FilePath: \picMap_fontend\vite.config.js
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
    extensions: ['.js', '.json', '.vue']
  }
})
