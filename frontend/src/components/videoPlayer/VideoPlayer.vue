<!--
 * @Description: 视频播放器组件（基于 video.js）
 * - objectURL 由 utils/videoBlob 共享缓存提供，不再各自分块拼接
 * - 自带自定义控制栏：播放/暂停、音量、进度、时间、全屏（hideControls 时隐藏，由外部控制）
 * - 加载成功后自动播放
 * - 支持全局键盘控制：空格播放暂停、←→快退快进、↑↓音量、M静音、F全屏
-->
<template>
  <div ref="rootRef" class="video-player" @mousemove="showControls">
    <video ref="videoEl" class="video-js vjs-big-play-centered" :poster="posterUrl || undefined"></video>

    <!-- 加载进度遮罩 -->
    <div v-if="loading" class="video-loading-mask">
      <el-icon class="video-loading-icon is-loading"><Loading /></el-icon>
      <span class="video-loading-text">视频加载中 {{ loadPercent }}%</span>
    </div>

    <!-- 自定义控制栏（与全景播放器共用 VideoControls） -->
    <VideoControls v-if="!hideControls && !loading" :is-playing="isPlaying" :current-time="currentTime"
      :duration="duration" :volume="volume" :muted="muted" :is-fullscreen="isFullscreen"
      :visible="!isFullscreen || controlsVisible" @toggle-play="togglePlay" @toggle-mute="toggleMute"
      @toggle-fullscreen="toggleFullscreen" @volume-change="onVolumeChange" @seek="onSeek">
      <template #prev><slot name="prev"></slot></template>
      <template #next><slot name="next"></slot></template>
    </VideoControls>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import i18n from '@/i18n/index'
import { loadVideoAsObjectUrl, getVideoStreamUrl } from '@/utils/videoBlob'
import VideoControls from './VideoControls.vue'

const props = defineProps({
  videoId: { type: String, required: true },
  posterUrl: { type: String, default: '' },
  // 是否隐藏内置控制栏（由外部共同进度条控制时使用）
  hideControls: { type: Boolean, default: false }
})

const emit = defineEmits<{
  (e: 'timeupdate', currentTime: number): void
  (e: 'loadedmetadata', duration: number): void
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'ended'): void
}>()

const rootRef = ref<HTMLElement>()
const videoEl = ref<HTMLVideoElement>()
let player: any = null

// 加载状态与进度
const loading = ref(false)
const loadPercent = ref(0)

// 播放状态
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const muted = ref(false)
/** 静音前音量（取消静音时恢复） */
const lastVolume = ref(1)
const isFullscreen = ref(false)

/** 快进快退步长（秒） */
const SEEK_STEP = 5
/** 音量调节步长 */
const VOLUME_STEP = 0.1

function togglePlay() {
  if (!player || player.isDisposed()) return
  player.paused() ? player.play() : player.pause()
}
function onSeek(val: number | number[]) {
  const sec = Array.isArray(val) ? val[0] : val
  if (player && !player.isDisposed()) player.currentTime(sec)
  currentTime.value = sec
}
function onVolumeChange(val: number | number[]) {
  const v = Array.isArray(val) ? val[0] : val
  volume.value = v
  if (v > 0) lastVolume.value = v
  muted.value = v <= 0
  if (player && !player.isDisposed()) {
    player.volume(v)
    player.muted(v <= 0)
  }
}
function toggleMute() {
  // 静音时音量归零，取消静音恢复静音前的值
  if (muted.value) {
    muted.value = false
    const v = lastVolume.value > 0 ? lastVolume.value : 1
    volume.value = v
    if (player && !player.isDisposed()) {
      player.volume(v)
      player.muted(false)
    }
  } else {
    if (volume.value > 0) lastVolume.value = volume.value
    muted.value = true
    volume.value = 0
    if (player && !player.isDisposed()) {
      player.volume(0)
      player.muted(true)
    }
  }
}
function toggleFullscreen() {
  if (!rootRef.value) return
  if (document.fullscreenElement) document.exitFullscreen?.()
  else rootRef.value.requestFullscreen?.()
}
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

// ---- 全屏下空闲自动隐藏控制栏 ----
const IDLE_HIDE_MS = 5000
const controlsVisible = ref(true)
let idleTimer: number | null = null
// 加载遮罩兜底超时定时器（需在卸载/重载时清理，避免回调持有组件状态导致泄漏）
let maskTimer: number | null = null
function clearIdleTimer() {
  if (idleTimer != null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}
function clearMaskTimer() {
  if (maskTimer != null) {
    clearTimeout(maskTimer)
    maskTimer = null
  }
}
function showControls() {
  controlsVisible.value = true
  if (!isFullscreen.value) return
  clearIdleTimer()
  idleTimer = window.setTimeout(() => {
    controlsVisible.value = false
  }, IDLE_HIDE_MS)
}
watch(isFullscreen, (val) => {
  if (val) {
    showControls()
  } else {
    clearIdleTimer()
    controlsVisible.value = true
  }
})

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

  // 有按键交互则显示控制栏
  showControls()

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
      toggleFullscreen()
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
  clearMaskTimer()
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0

  let usingStream = false
  try {
    loading.value = true
    loadPercent.value = 0
    // 优先使用本地 HTTP 流（Range 边下边播，无需等待整段下载）；不可用时回退分块 blob
    let src = ''
    const streamUrl = await getVideoStreamUrl(props.videoId)
    if (streamUrl) {
      usingStream = true
      src = streamUrl
    } else {
      const url = await loadVideoAsObjectUrl(props.videoId, (loaded, total) => {
        loadPercent.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
      })
      if (!url) {
        ElMessage.error(i18n.global.t('description.videoLoadFailed'))
        return
      }
      src = url
    }
    if (!videoEl.value) return
    player = videojs(videoEl.value, {
      controls: false,
      autoplay: false,
      fill: true,
      sources: [{ src, type: 'video/mp4' }],
      html5: {
        vhs: {
          // 本地流交给原生播放器（支持 Range）；blob 仍走 VHS
          overrideNative: !usingStream
        }
      }
    })
    player.on('error', () => {
      console.error('video.js 播放错误')
    })
    // 同步内部状态并向父组件透出
    player.on('timeupdate', () => {
      currentTime.value = player.currentTime() || 0
      emit('timeupdate', currentTime.value)
    })
    player.on('loadedmetadata', () => {
      duration.value = player.duration() || 0
      // 应用当前音量并自动播放
      player.volume(volume.value)
      player.muted(muted.value)
      emit('loadedmetadata', duration.value)
      if (!props.hideControls) player.play()
    })
    player.on('play', () => {
      isPlaying.value = true
      emit('play')
    })
    player.on('pause', () => {
      isPlaying.value = false
      emit('pause')
    })
    player.on('ended', () => {
      isPlaying.value = false
      emit('ended')
    })
    player.on('volumechange', () => {
      volume.value = player.volume() ?? 1
      muted.value = !!player.muted()
    })
    if (usingStream) {
      // 数据可播即隐藏遮罩；兜底超时避免遮罩常驻
      const clearMask = () => {
        loading.value = false
        if (maskTimer != null) {
          clearTimeout(maskTimer)
          maskTimer = null
        }
      }
      player.on('loadeddata', clearMask)
      player.on('canplay', clearMask)
      maskTimer = window.setTimeout(clearMask, 10000)
    }
  } catch (e) {
    console.error('初始化播放器失败', e)
    ElMessage.error(i18n.global.t('description.videoLoadFailed'))
  } finally {
    if (!usingStream) loading.value = false
  }
}

watch(() => props.videoId, () => {
  if (props.videoId) initPlayer()
})

onMounted(() => {
  if (props.videoId) initPlayer()
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  clearIdleTimer()
  clearMaskTimer()
  // 仅当本播放器自身处于全屏时才退出，避免切换视频时误退出外层（如轨迹播放弹框）的全屏
  if (document.fullscreenElement && document.fullscreenElement === rootRef.value) {
    document.exitFullscreen?.()
  }
  if (player) {
    player.dispose()
    player = null
  }
})

// 暴露给父组件的播放控制接口（供外部进度条双向联动）
defineExpose({
  play() {
    if (player && !player.isDisposed()) player.play()
  },
  pause() {
    if (player && !player.isDisposed()) player.pause()
  },
  isPaused() {
    return player && !player.isDisposed() ? player.paused() : true
  },
  seek(seconds: number) {
    if (player && !player.isDisposed()) player.currentTime(seconds)
  },
  getCurrentTime() {
    return player && !player.isDisposed() ? player.currentTime() || 0 : 0
  },
  getDuration() {
    return player && !player.isDisposed() ? player.duration() || 0 : 0
  },
  setVolume(v: number) {
    if (player && !player.isDisposed()) player.volume(Math.max(0, Math.min(1, v)))
  },
  getVolume() {
    return player && !player.isDisposed() ? player.volume() ?? 1 : 1
  },
  setMuted(m: boolean) {
    if (player && !player.isDisposed()) player.muted(m)
  },
  isMuted() {
    return player && !player.isDisposed() ? !!player.muted() : false
  }
})
</script>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}

.video-js {
  width: 100%;
  height: 100%;
}

.video-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 13px;
}

.video-loading-icon {
  font-size: 30px;
  color: #409eff;
}

.video-loading-text {
  letter-spacing: 1px;
}

/* 自定义控制栏 */
.vp-play {
  flex-shrink: 0;
  --el-button-bg-color: #409eff;
  --el-button-border-color: #409eff;
  --el-button-hover-bg-color: #66b1ff;
  --el-button-hover-border-color: #66b1ff;
  --el-button-text-color: #fff;
}

.vp-icon {
  flex-shrink: 0;
  font-size: 18px;
  color: #fff;
  cursor: pointer;
}

.vp-icon:hover {
  color: #409eff;
}

.vp-time {
  flex-shrink: 0;
  min-width: 44px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.vp-progress {
  flex: 1;
}

.vp-volume {
  flex-shrink: 0;
  width: 80px;
}
</style>

<!-- video.js 生成的 DOM 不受 scoped 影响，单独全局样式保证整幅画面完整显示（不被裁切/拉伸） -->
<style>
.video-js .vjs-tech {
  object-fit: contain;
}
</style>
