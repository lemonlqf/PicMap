<!--
 * @Description: 全景 360 视频查看器（基于 Photo Sphere Viewer EquirectangularVideoAdapter）
 * - 通过 utils/videoBlob 分块读取视频并拼装成 objectURL，喂给 VideoAdapter
 * - 支持拖拽视角 / 缩放，复用 photo-sphere-viewer 样式
-->
<template>
  <div class="panorama-video-viewer" v-loading="loading" :element-loading-text="`视频加载中 ${loadPercent}%`">
    <div ref="container" class="pv-container"></div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Viewer } from 'photo-sphere-viewer'
import { EquirectangularVideoAdapter } from 'photo-sphere-viewer/dist/adapters/equirectangular-video'
import { VideoPlugin } from 'photo-sphere-viewer/dist/plugins/video'
import 'photo-sphere-viewer/dist/photo-sphere-viewer.css'
import 'photo-sphere-viewer/dist/plugins/video.css'
import { loadVideoAsObjectUrl } from '@/utils/videoBlob'

const props = defineProps<{
  videoId: string
}>()

const container = ref<HTMLElement>()
const loading = ref(false)
const loadPercent = ref(0)
let viewer: Viewer | null = null

async function createViewer() {
  if (!container.value || !props.videoId) return
  destroyViewer()
  loading.value = true
  loadPercent.value = 0
  const url = await loadVideoAsObjectUrl(props.videoId, (loaded, total) => {
    loadPercent.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  })
  loading.value = false
  if (!url || !container.value) return

  viewer = new Viewer({
    container: container.value,
    panorama: { source: url },
    adapter: [EquirectangularVideoAdapter as any, { autoplay: false, muted: false }],
    plugins: [VideoPlugin as any],
    navbar: ['zoom', 'fullscreen'],
    loadingTxt: '',
    mousewheel: true,
    mousemove: true,
  })
}

function destroyViewer() {
  viewer?.destroy()
  viewer = null
}

onMounted(() => {
  createViewer()
})

onBeforeUnmount(() => {
  destroyViewer()
})

watch(() => props.videoId, () => {
  createViewer()
})
</script>

<style scoped>
.panorama-video-viewer {
  width: 100%;
  height: 100%;
  position: relative;
}

.pv-container {
  width: 100%;
  height: 100%;
}
</style>
