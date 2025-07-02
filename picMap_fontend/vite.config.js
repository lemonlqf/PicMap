import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'


// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), svgLoader()],
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
