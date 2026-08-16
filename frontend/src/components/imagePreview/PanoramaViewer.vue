<!--
 * @Description: 全景 360 图片查看器（基于 Photo Sphere Viewer），支持投影切换、全屏、柱形全景限制垂直视野
-->
<template>
  <div class="panorama-viewer-wrap" :class="{ 'is-fullscreen': isFullscreen }">
    <div ref="container" class="panorama-viewer"></div>
    <div class="panorama-toolbar">
      <button class="projection-btn" @click="toggleProjection">
        {{ isLittlePlanet ? $t('normalPanorama') : $t('littlePlanet') }}
      </button>
      <button class="projection-btn" @click="toggleFullscreen">
        {{ isFullscreen ? $t('exitFullscreen') : $t('fullscreen') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Viewer, EquirectangularAdapter, type PanoData } from 'photo-sphere-viewer'
import { LittlePlanetAdapter } from 'photo-sphere-viewer/dist/adapters/little-planet'
import { useI18n } from 'vue-i18n'
import 'photo-sphere-viewer/dist/photo-sphere-viewer.css'

const { t } = useI18n()

const props = defineProps<{
  // 全景图片 URL（equirectangular，data URL 或 http）
  src: string
  // 全景类型：spherical（球面，完整 2:1）/ cylindrical（柱形，水平 360° 高度不固定）
  panoramaType?: string
}>()

const container = ref<HTMLElement>()
const isLittlePlanet = ref(false)
const isFullscreen = ref(false)
let viewer: Viewer | null = null

onMounted(() => {
  createViewer()
})

onBeforeUnmount(() => {
  destroyViewer()
})

watch(() => props.src, (newSrc) => {
  // src 清空：销毁 viewer，避免加载空地址报错
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
    navbar: false,
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

function toggleProjection() {
  isLittlePlanet.value = !isLittlePlanet.value
  destroyViewer()
  createViewer()
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  // 容器尺寸变化后，等待 DOM 更新再刷新 viewer 尺寸
  nextTick(() => {
    viewer?.resize({ width: '100%', height: '100%' })
  })
}
</script>

<style scoped>
.panorama-viewer-wrap {
  position: relative;
  width: 100%;
  height: 370px;
}

.panorama-viewer-wrap.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 100000;
  background: #000;
}

.panorama-viewer {
  width: 100%;
  height: 100%;
}

.panorama-toolbar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 10px;
}

.projection-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.projection-btn:hover {
  background: rgba(0, 0, 0, 0.75);
}
</style>
