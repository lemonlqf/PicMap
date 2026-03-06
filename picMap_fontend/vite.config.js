import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'


// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), svgLoader()],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api']
      },
      sass: {
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api']
      }
    }
  },
  server: {
    hmr: true,
    port: 5199,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src') // 路径别名
    },
    extensions: ['.js', '.json', '.vue', '.ts']
  }
})
