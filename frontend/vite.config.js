import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'

/**
 * 把 maplibre-gl 的 worker 及其相对依赖原样复制到产物 assets/ 下。
 *
 * maplibre-gl v6 把 worker 拆成了独立文件（maplibre-gl-worker.mjs，内部再
 * `import ... from './maplibre-gl-shared.mjs'`），运行时按主 bundle 所在目录推断
 * worker 路径（new URL('./maplibre-gl-worker.mjs', import.meta.url)）。
 * 开发模式下 maplibre 由 vite 直接从 node_modules 提供，同目录下文件都在，所以正常；
 * 生产打包后主 bundle 落在 assets/，而 assets/ 里没有这两个文件，worker 构造失败 ——
 * 凡是走 worker 的数据源都会静默失效（GeoJSON 源 → 轨迹线、marker 聚合；矢量瓦片源），
 * 只有主线程加载的 raster 瓦片还正常，于是表现为"底图在、轨迹线和图片节点不见了"。
 */
function maplibreWorkerAssets() {
  return {
    name: 'picmap:maplibre-worker-assets',
    apply: 'build',
    writeBundle(options) {
      const pkgDist = resolve(__dirname, 'node_modules/maplibre-gl/dist')
      const outAssets = resolve(options.dir || resolve(__dirname, 'dist'), 'assets')
      mkdirSync(outAssets, { recursive: true })

      // 从 worker 入口出发，把相对依赖一并复制，保持文件名与相对引用一致
      const queue = ['maplibre-gl-worker.mjs']
      const copied = new Set()
      while (queue.length > 0) {
        const name = queue.pop()
        if (copied.has(name)) continue
        copied.add(name)

        const from = resolve(pkgDist, name)
        if (!existsSync(from)) {
          throw new Error(`[maplibre] worker 依赖文件缺失：${from}（maplibre-gl 目录结构可能已变化，请检查）`)
        }
        copyFileSync(from, resolve(outAssets, name))

        const code = readFileSync(from, 'utf8')
        for (const m of code.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)) {
          queue.push(m[1])
        }
      }
    }
  }
}


// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), svgLoader(), maplibreWorkerAssets()],
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
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
