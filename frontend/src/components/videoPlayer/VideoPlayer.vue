<!--
 * @Description: 视频播放器组件（基于 video.js）
 * - objectURL 由 utils/videoBlob 共享缓存提供，不再各自分块拼接
 * - 自带自定义控制栏：播放/暂停、音量、进度、时间、全屏（hideControls 时隐藏，由外部控制）
 * - 加载成功后自动播放
 * - 支持全局键盘控制：空格播放暂停、←→快退快进、↑↓音量、M静音、F全屏
-->
<template>
  <div ref="rootRef" class="video-player">
    <video ref="videoEl" class="video-js vjs-big-play-centered" :poster="posterUrl || undefined"></video>

    <!-- 加载进度遮罩 -->
    <div v-if="loading" class="video-loading-mask">
      <el-icon class="video-loading-icon is-loading"><Loading /></el-icon>
      <span class="video-loading-text">视频加载中 {{ loadPercent }}%</span>
    </div>

    <!-- 自定义控制栏 -->
    <div v-if="!hideControls && !loading" class="vp-controls">
      <el-button class="vp-play" circle size="small" :icon="isPlaying ? VideoPause : VideoPlay" @click="togglePlay" />
      <el-icon class="vp-icon" :title="muted ? '取消静音' : '静音'" @click="toggleMute">
        <Mute v-if="muted || volume <= 0" />
        <Headset v-else />
      </el-icon>
      <el-slider v-model="volume" class="vp-volume" :min="0" :max="1" :step="0.01" :show-tooltip="false"
        @input="onVolumeChange" />
      <span class="vp-time">{{ formatTime(currentTime) }}</span>
      <el-slider class="vp-progress" :model-value="currentTime" :min="0" :max="duration || 0" :step="0.1"
        :disabled="!duration" :show-tooltip="false" @input="onSeek" />
      <span class="vp-time">{{ formatTime(duration) }}</span>
      <el-icon class="vp-icon" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
        <FullScreen />
      </el-icon>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, VideoPlay, VideoPause, Mute, Headset, FullScreen } from '@element-plus/icons-vue'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import { loadVideoAsObjectUrl } from '@/utils/videoBlob'

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
const isFullscreen = ref(false)

/** 快进快退步长（秒） */
const SEEK_STEP = 5
/** 音量调节步长 */
const VOLUME_STEP = 0.1

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '00:00'
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

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
  muted.value = v <= 0
  if (player && !player.isDisposed()) {
    player.volume(v)
    player.muted(v <= 0)
  }
}
function toggleMute() {
  muted.value = !muted.value
  if (player && !player.isDisposed()) player.muted(muted.value)
}
function toggleFullscreen() {
  if (!rootRef.value) return
  if (document.fullscreenElement) document.exitFullscreen?.()
  else rootRef.value.requestFullscreen?.()
}
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
}

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
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0

  try {
    loading.value = true
    loadPercent.value = 0
    const url = await loadVideoAsObjectUrl(props.videoId, (loaded, total) => {
      loadPercent.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
    })
    if (!url || !videoEl.value) {
      ElMessage.error('视频加载失败')
      return
    }
    player = videojs(videoEl.value, {
      controls: false,
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
  } catch (e) {
    console.error('初始化播放器失败', e)
    ElMessage.error('视频加载失败')
  } finally {
    loading.value = false
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
  if (document.fullscreenElement) document.exitFullscreen?.()
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
.vp-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0));
  color: #fff;
}

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
