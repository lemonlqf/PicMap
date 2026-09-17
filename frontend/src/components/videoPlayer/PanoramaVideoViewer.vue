<!--
 * @Description: 全景 360 视频查看器（基于 Photo Sphere Viewer 5.x EquirectangularVideoAdapter）
 * - 通过 utils/videoBlob 分块读取视频并拼装成 objectURL，喂给 VideoAdapter
 * - 支持拖拽视角 / 缩放
 * - 隐藏 PSV 自带 navbar，底部使用与 VideoPlayer 一致的自制控制栏
 *   （播放/静音/音量/当前时间/进度/总时长/全屏）
-->
<template>
  <div class="panorama-video-viewer" ref="rootRef">
    <div ref="container" class="pv-container"></div>
    <!-- 加载遮罩（与普通视频播放器风格一致） -->
    <div v-if="loading" class="pv-loading-mask">
      <el-icon class="pv-loading-icon is-loading"><Loading /></el-icon>
      <span class="pv-loading-text">视频加载中 {{ loadPercent }}%</span>
    </div>
    <!-- 控制栏：复用 VideoControls，保证与普通视频播放器样式/交互一致 -->
    <VideoControls v-if="!loading" :is-playing="isPlaying" :current-time="currentTime" :duration="duration"
      :volume="volume" :muted="muted" :is-fullscreen="isFullscreen" @toggle-play="togglePlay"
      @toggle-mute="toggleMute" @toggle-fullscreen="toggleFullscreen" @volume-change="onVolumeChange" @seek="onSeek" />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { Viewer } from '@photo-sphere-viewer/core'
import { EquirectangularVideoAdapter } from '@photo-sphere-viewer/equirectangular-video-adapter'
import { VideoPlugin } from '@photo-sphere-viewer/video-plugin'
import '@photo-sphere-viewer/core/index.css'
import '@photo-sphere-viewer/video-plugin/index.css'
import { loadVideoAsObjectUrl, getVideoStreamUrl } from '@/utils/videoBlob'
import VideoControls from './VideoControls.vue'

const props = defineProps<{
  videoId: string
}>()

const rootRef = ref<HTMLElement>()
const container = ref<HTMLElement>()
const loading = ref(false)
const loadPercent = ref(0)

const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const muted = ref(false)
/** 静音前音量（取消静音时恢复） */
const lastVolume = ref(1)
const isFullscreen = ref(false)

let viewer: Viewer | null = null
let videoPlugin: VideoPlugin | null = null

function togglePlay() {
  videoPlugin?.playPause()
}

function toggleMute() {
  if (!videoPlugin) return
  // 静音时音量归零，取消静音恢复静音前的值
  if (muted.value) {
    muted.value = false
    const v = lastVolume.value > 0 ? lastVolume.value : 1
    volume.value = v
    videoPlugin.setVolume(v)
    videoPlugin.setMute(false)
  } else {
    if (volume.value > 0) lastVolume.value = volume.value
    muted.value = true
    volume.value = 0
    videoPlugin.setVolume(0)
    videoPlugin.setMute(true)
  }
}

function onVolumeChange(val: number | number[]) {
  const v = Array.isArray(val) ? val[0] : val
  volume.value = v
  if (v > 0) lastVolume.value = v
  muted.value = v <= 0
  videoPlugin?.setVolume(v)
  videoPlugin?.setMute(v <= 0)
}

function onSeek(val: number | number[]) {
  const sec = Array.isArray(val) ? val[0] : val
  currentTime.value = sec
  // 注意：setProgress 接收的是比例(0~1)，按秒跳转需用 setTime
  videoPlugin?.setTime(sec)
}

function toggleFullscreen() {
  const el = rootRef.value
  if (!el) return
  if (document.fullscreenElement) document.exitFullscreen?.()
  else el.requestFullscreen?.()
}

let fullscreenResizeTimer: number | null = null

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  // 全屏尺寸变化后让 PSV 重新适配
  if (fullscreenResizeTimer != null) clearTimeout(fullscreenResizeTimer)
  fullscreenResizeTimer = window.setTimeout(() => {
    fullscreenResizeTimer = null
    viewer?.autoSize()
  }, 100)
}

// 每次创建/销毁递增，用于丢弃过期的异步加载续体（卸载或快速切换 videoId 时避免创建孤儿 viewer）
let createToken = 0

async function createViewer() {
  if (!container.value || !props.videoId) return
  destroyViewer()
  // 在销毁（其内部会递增 token）之后取本次 token，保证本次为最新一次创建
  const token = ++createToken
  loading.value = true
  loadPercent.value = 0
  // 优先使用本地 HTTP 流（支持 Range）；不可用时回退分块 blob
  let source = await getVideoStreamUrl(props.videoId)
  if (token !== createToken) return
  if (!source) {
    source = await loadVideoAsObjectUrl(props.videoId, (loaded, total) => {
      if (token !== createToken) return
      loadPercent.value = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
    })
  }
  // 异步等待期间可能已卸载 / 切换视频 / 被新的创建请求取代
  if (token !== createToken || !container.value) return
  loading.value = false
  if (!source) return

  viewer = new Viewer({
    container: container.value,
    panorama: { source },
    adapter: EquirectangularVideoAdapter,
    plugins: [[VideoPlugin, { progressbar: false, bigbutton: false, autoplay: true }]],
    // 隐藏 PSV 自带 navbar，播放/音量/进度由自制控制栏提供
    navbar: false,
    loadingTxt: '',
    mousewheel: true,
    mousemove: true,
  })

  const plugin = viewer.getPlugin<VideoPlugin>(VideoPlugin)
  videoPlugin = plugin
  if (plugin) {
    volume.value = plugin.getVolume()
    muted.value = volume.value <= 0
    duration.value = plugin.getDuration() || 0
    plugin.addEventListener('volume-change', ({ volume: v }: any) => {
      volume.value = v
      muted.value = v <= 0
    })
    plugin.addEventListener('play-pause', ({ playing }: any) => {
      isPlaying.value = playing
    })
    plugin.addEventListener('progress', ({ time, duration: dur }: any) => {
      currentTime.value = time
      duration.value = dur
    })
    // ProgressEvent 仅在 timeupdate（播放时）触发，未播放时拿不到时长；
    // 这里轮询兜底，直到拿到有效 duration（metadata 加载完成）或超时
    startDurationPolling()
  }
}

// 未播放时轮询获取总时长（VideoPlugin.getDuration 依赖 video 元数据就绪）
let durationTimer: number | null = null
function startDurationPolling() {
  stopDurationPolling()
  let tries = 0
  durationTimer = window.setInterval(() => {
    const dur = videoPlugin?.getDuration() || 0
    if (dur > 0 && isFinite(dur)) {
      duration.value = dur
      stopDurationPolling()
      return
    }
    tries++
    // 最多轮询约 30 秒（覆盖大视频加载元数据的时间）
    if (tries > 60) stopDurationPolling()
  }, 500)
}

function stopDurationPolling() {
  if (durationTimer != null) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

function destroyViewer() {
  // 作废进行中的异步创建，避免其完成后创建孤儿 viewer
  createToken++
  stopDurationPolling()
  videoPlugin = null
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  viewer?.destroy()
  viewer = null
}

onMounted(() => {
  createViewer()
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (fullscreenResizeTimer != null) {
    clearTimeout(fullscreenResizeTimer)
    fullscreenResizeTimer = null
  }
  if (document.fullscreenElement && document.fullscreenElement === rootRef.value) {
    document.exitFullscreen?.()
  }
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

.pv-loading-mask {
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

.pv-loading-icon {
  font-size: 30px;
  color: #409eff;
}

.pv-loading-text {
  letter-spacing: 1px;
}
</style>
