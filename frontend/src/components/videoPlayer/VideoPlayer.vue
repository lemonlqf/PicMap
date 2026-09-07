<!--
 * @Description: 视频播放器组件（基于 video.js）
 * - objectURL 由 utils/videoBlob 共享缓存提供，不再各自分块拼接
 * - 提供播放/暂停/进度条/seek 等完整控制
 * - 支持全局键盘控制：空格播放暂停、←→快退快进、↑↓音量、M静音、F全屏
-->
<template>
  <div class="video-player">
    <video ref="videoEl" class="video-js vjs-big-play-centered" :poster="posterUrl || undefined"></video>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import { loadVideoAsObjectUrl } from '@/utils/videoBlob'

const props = defineProps({
  videoId: { type: String, required: true },
  posterUrl: { type: String, default: '' }
})

const videoEl = ref<HTMLVideoElement>()
let player: any = null

/** 快进快退步长（秒） */
const SEEK_STEP = 5
/** 音量调节步长 */
const VOLUME_STEP = 0.1

/**
 * @description: 全局键盘控制（弹框打开期间任意位置按键均生效）
 */
function handleKeydown(e: KeyboardEvent) {
  if (!player || player.isDisposed()) return
  // 输入框 / 可编辑区域聚焦时不拦截按键（含 contenteditable 内部的子元素）
  const target = e.target as HTMLElement | null
  if (target && (target.closest?.('[contenteditable]') ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable)) return

  switch (e.key) {
    case ' ':            // 空格：播放/暂停
    case 'k':
    case 'K':
      e.preventDefault()
      player.paused() ? player.play() : player.pause()
      break
    case 'ArrowLeft':    // ← 快退 5s
      e.preventDefault()
      player.currentTime(Math.max(0, player.currentTime() - SEEK_STEP))
      break
    case 'ArrowRight':   // → 快进 5s
      e.preventDefault()
      player.currentTime(Math.min(player.duration() || 0, player.currentTime() + SEEK_STEP))
      break
    case 'ArrowUp':      // ↑ 音量+
      e.preventDefault()
      player.volume(Math.min(1, player.volume() + VOLUME_STEP))
      break
    case 'ArrowDown':    // ↓ 音量-
      e.preventDefault()
      player.volume(Math.max(0, player.volume() - VOLUME_STEP))
      break
    case 'm':
    case 'M':            // 静音切换
      player.muted(!player.muted())
      break
    case 'f':
    case 'F':            // 全屏切换
      player.isFullscreen() ? player.exitFullscreen() : player.requestFullscreen()
      break
  }
}

/**
 * @description: 初始化 video.js 播放器（objectURL 由 utils/videoBlob 共享缓存提供）
 */
async function initPlayer() {
  if (!videoEl.value) return
  // 销毁旧播放器
  if (player) {
    player.dispose()
    player = null
  }

  try {
    const url = await loadVideoAsObjectUrl(props.videoId)
    if (!url || !videoEl.value) {
      ElMessage.error('视频加载失败')
      return
    }
    player = videojs(videoEl.value, {
      controls: true,
      autoplay: false,
      fill: true,
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
  if (props.videoId) initPlayer()
})

onMounted(() => {
  if (props.videoId) initPlayer()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (player) {
    player.dispose()
    player = null
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

<!-- video.js 生成的 DOM 不受 scoped 影响，单独全局样式保证整幅画面完整显示（不被裁切/拉伸） -->
<style>
.video-js .vjs-tech {
  object-fit: contain;
}
</style>
