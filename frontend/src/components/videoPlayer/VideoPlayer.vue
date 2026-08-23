<!--
 * @Description: 视频播放器组件（基于 video.js）
 * - 通过后端 GetVideoRange 分段读取视频，拼成 blob，用 video.js 播放
 * - 提供播放/暂停/进度条/seek 等完整控制
-->
<template>
  <div class="video-player">
    <video ref="videoEl" class="video-js vjs-big-play-centered" :poster="posterUrl"></video>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import API from '@/wails/api'

const props = defineProps({
  videoId: { type: String, required: true },
  posterUrl: { type: String, default: '' }
})

const videoEl = ref<HTMLVideoElement>()
let player: any = null
let objectUrl = ''
let blobParts: Blob[] = []
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB/段

/**
 * @description: 分段读取视频并拼成 blob
 */
async function loadVideoBlob(): Promise<string> {
  if (!props.videoId) return ''
  blobParts = []
  let loadedBytes = 0

  // 第一段获取文件大小
  const first = await fetchRange(0, CHUNK_SIZE)
  if (!first) return ''
  let totalLength = first.length
  appendChunk(first.data)
  loadedBytes = first.end

  // 继续读取
  while (loadedBytes < totalLength) {
    const end = Math.min(loadedBytes + CHUNK_SIZE, totalLength)
    const chunk = await fetchRange(loadedBytes, end)
    if (!chunk) break
    appendChunk(chunk.data)
    loadedBytes = chunk.end
  }

  const blob = new Blob(blobParts, { type: 'video/mp4' })
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(blob)
  return objectUrl
}

async function fetchRange(start: number, end: number) {
  const res = await API.video.getVideoRange({ videoId: props.videoId, start, end })
  if (res.code !== 200 || !res.data?.data) return null
  return res.data as { data: string; start: number; end: number; length: number }
}

function appendChunk(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  blobParts.push(new Blob([bytes]))
}

/**
 * @description: 初始化 video.js 播放器
 */
async function initPlayer() {
  if (!videoEl.value) return
  // 销毁旧播放器
  if (player) {
    player.dispose()
    player = null
  }

  try {
    const url = await loadVideoBlob()
    if (!url) {
      ElMessage.error('视频加载失败')
      return
    }
    player = videojs(videoEl.value, {
      controls: true,
      autoplay: false,
      fluid: true,
      sources: [{ src: url, type: 'video/mp4' }],
      html5: {
        vhs: {
          overrideNative: true
        }
      }
    })
    player.on('error', () => {
      console.error('video.js 播放错误')
    })
  } catch (e) {
    console.error('初始化播放器失败', e)
    ElMessage.error('视频加载失败')
  }
}

watch(() => props.videoId, () => {
  initPlayer()
})

onMounted(() => {
  initPlayer()
})

onUnmounted(() => {
  if (player) {
    player.dispose()
    player = null
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
  }
})
</script>

<style scoped>
.video-player {
  width: 100%;
  height: 100%;
  background: #000;
}

.video-js {
  width: 100%;
  height: 100%;
}
</style>
