<!--
 * @Description: 全景 360 图片查看器（基于 Photo Sphere Viewer 5.x），使用插件自带工具栏
-->
<template>
  <div ref="container" class="panorama-viewer" :class="{ 'is-fullscreen': isFullscreen }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Viewer, EquirectangularAdapter, type PanoData } from '@photo-sphere-viewer/core'
import '@photo-sphere-viewer/core/index.css'

const props = defineProps<{
  // 全景图片 URL（equirectangular，data URL 或 http）
  src: string
  // 全景类型：spherical（球面，完整 2:1）/ cylindrical（柱形，水平 360° 高度不固定）
  panoramaType?: string
}>()

const container = ref<HTMLElement>()
// 全屏状态（CSS class 实现，避免浏览器全屏在重建 viewer 时丢失）
const isFullscreen = ref(false)
let viewer: Viewer | null = null

// 全屏按钮图标：与视频播放器一致，采用 Element Plus 的 FullScreen 图标
const FULLSCREEN_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path fill="currentColor" d="m160 96.064 192 .192a32 32 0 0 1 0 64l-192-.192V352a32 32 0 0 1-64 0V96h64zm0 831.872V928H96V672a32 32 0 1 1 64 0v191.936l192-.192a32 32 0 1 1 0 64zM864 96.064V96h64v256a32 32 0 1 1-64 0V160.064l-192 .192a32 32 0 1 1 0-64zm0 831.872-192-.192a32 32 0 0 1 0-64l192 .192V672a32 32 0 1 1 64 0v256h-64z"/></svg>'

onMounted(() => {
  createViewer()
})

onBeforeUnmount(() => {
  destroyViewer()
})

watch(() => props.src, (newSrc) => {
  if (!newSrc) {
    destroyViewer()
    return
  }
  if (viewer) {
    try {
      viewer.setPanorama(newSrc)
    } catch {
      destroyViewer()
      createViewer()
    }
  } else {
    createViewer()
  }
})

function createViewer() {
  if (!container.value || !props.src) return
  // 柱形全景：限制垂直视野（水平 360°，垂直按图片高度映射）。
  // 必须在构造时通过 panoData 传入：若构造后再调用 setPanorama，会先中止构造时的首次加载，
  // 而 Photo Sphere Viewer 在加载被中止时不会清空 loadingPromise，导致视图一直停在 loading。
  const panoData = props.panoramaType === 'cylindrical'
    ? (image: HTMLImageElement): PanoData => {
        const fullWidth = image.naturalWidth
        const fullHeight = Math.round(fullWidth / 2)
        return {
          fullWidth,
          fullHeight,
          croppedWidth: image.naturalWidth,
          croppedHeight: image.naturalHeight,
          croppedX: 0,
          croppedY: Math.round((fullHeight - image.naturalHeight) / 2),
        }
      }
    : undefined
  viewer = new Viewer({
    container: container.value,
    panorama: props.src,
    adapter: EquirectangularAdapter,
    panoData,
    navbar: [
      'zoom',
      {
        id: 'fullscreen',
        title: isFullscreen.value ? '退出全屏' : '全屏',
        content: FULLSCREEN_ICON,
        className: 'psv-fullscreen-btn',
        onClick: () => {
          isFullscreen.value = !isFullscreen.value
          setTimeout(() => {
            viewer?.autoSize()
          }, 50)
        },
      },
    ],
    loadingTxt: '',
    mousewheel: true,
    mousemove: true,
  })
  // 全景加载/解码失败时打印错误，避免只表现为一直 loading 而无从排查
  viewer.addEventListener('panorama-error', (e: any) => {
    console.error('[PanoramaViewer] 全景加载失败:', e?.error || e)
  })
}

function destroyViewer() {
  viewer?.destroy()
  viewer = null
}
</script>

<style scoped>
.panorama-viewer {
  width: 100%;
  height: 100%;
}

.panorama-viewer.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 100000;
  background: #000;
}
</style>

<style>
.psv-fullscreen-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.psv-fullscreen-btn svg {
  width: 18px;
  height: 18px;
  display: block;
  fill: currentColor;
  transition: transform 0.15s ease;
}

.psv-fullscreen-btn:hover svg {
  transform: scale(1.2);
}
</style>
