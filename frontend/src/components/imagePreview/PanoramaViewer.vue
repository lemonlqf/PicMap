<!--
 * @Description: 全景 360 图片查看器（基于 Photo Sphere Viewer），使用插件自带工具栏
-->
<template>
  <div ref="container" class="panorama-viewer" :class="{ 'is-fullscreen': isFullscreen }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Viewer, EquirectangularAdapter, type PanoData } from 'photo-sphere-viewer'
import { LittlePlanetAdapter } from 'photo-sphere-viewer/dist/adapters/little-planet'
import 'photo-sphere-viewer/dist/photo-sphere-viewer.css'

const props = defineProps<{
  // 全景图片 URL（equirectangular，data URL 或 http）
  src: string
  // 全景类型：spherical（球面，完整 2:1）/ cylindrical（柱形，水平 360° 高度不固定）
  panoramaType?: string
}>()

const container = ref<HTMLElement>()
const isLittlePlanet = ref(false)
// 全屏状态（CSS class 实现，避免浏览器全屏在重建 viewer 时丢失）
const isFullscreen = ref(false)
let viewer: Viewer | null = null

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
  viewer = new Viewer({
    container: container.value,
    panorama: props.src,
    adapter: isLittlePlanet.value ? LittlePlanetAdapter : EquirectangularAdapter,
    navbar: [
      'zoom',
      {
        id: 'fullscreen',
        title: isFullscreen.value ? '退出全屏' : '全屏',
        content: '⤢',
        className: 'psv-fullscreen-btn',
        onClick: () => {
          isFullscreen.value = !isFullscreen.value
          setTimeout(() => {
            viewer?.autoSize()
          }, 50)
        },
      },
      {
        id: 'projection',
        title: isLittlePlanet.value ? '普通全景' : '小星球',
        content: '360',
        className: 'psv-projection-btn',
        onClick: () => {
          isLittlePlanet.value = !isLittlePlanet.value
          destroyViewer()
          createViewer()
          // 重建后保持 CSS class 全屏
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
  // 柱形全景：限制垂直视野（水平 360°，垂直按图片高度映射）
  if (!isLittlePlanet.value && props.panoramaType === 'cylindrical') {
    viewer.setPanorama(props.src, {
      panoData: (image: HTMLImageElement): PanoData => {
        const fullWidth = image.naturalWidth
        const fullHeight = Math.round(fullWidth / 2)
        const croppedWidth = image.naturalWidth
        const croppedHeight = image.naturalHeight
        return {
          fullWidth,
          fullHeight,
          croppedWidth,
          croppedHeight,
          croppedX: 0,
          croppedY: Math.round((fullHeight - croppedHeight) / 2),
        }
      },
    })
  }
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
.psv-projection-btn,
.psv-fullscreen-btn {
  font-size: 14px;
  font-weight: bold;
}
</style>
