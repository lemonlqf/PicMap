<!--
 * @Description: 轨迹关联视频播放弹框
 * - 视频播放（video.js，隐藏内置控制栏）为主，右下角画中画显示轨迹地图
 * - 底部共同进度条：视频时间 ↔ 轨迹位置双向联动
 * - 轨迹上显示：完整视频弧段（半透明）、已走过弧段（高亮）、当前位置圆点
-->
<template>
  <el-dialog
    :model-value="visible"
    append-to-body
    :close-on-click-modal="false"
    :show-close="true"
    :destroy-on-close="true"
    :z-index="1000000"
    top="6vh"
    width="72vw"
    class="track-video-play-dialog"
    :class="{ 'controls-hidden': isFullscreen && !controlsVisible }"
    @update:model-value="onVisibleChange"
    @closed="handleClosed"
  >
    <template #header>
      <span class="track-video-play-title">{{ title }}</span>
    </template>

    <div v-if="visible && videoId" ref="bodyRef" class="track-video-play-body"
      :class="{ 'controls-hidden': isFullscreen && !controlsVisible }" @mousemove="showControls">
      <div class="video-area">
        <VideoPlayer
          :key="videoId"
          ref="playerRef"
          :video-id="videoId"
          hide-controls
          @loadedmetadata="handleLoadedMetadata"
          @timeupdate="handleTimeUpdate"
          @play="isPlaying = true"
          @pause="isPlaying = false"
          @ended="handleEnded"
        />
      </div>

      <!-- 上一个 / 下一个视频（仅当该轨迹有多个视频时显示） -->
      <button v-if="hasPrev" class="video-nav video-nav-prev" :title="t('track.prevVideo')" @click="goPrev">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <button v-if="hasNext" class="video-nav video-nav-next" :title="t('track.nextVideo')" @click="goNext">
        <el-icon><ArrowRight /></el-icon>
      </button>

      <!-- 画中画地图（可拖动放置、可最小化，避免遮挡视频） -->
      <div class="mini-map-wrap" ref="miniMapWrapRef" :class="{ 'is-minimized': miniMapMinimized }" :style="miniMapStyle">
        <div class="mini-map-bar" @mousedown="startMiniMapDrag">
          <el-icon class="mini-map-bar-icon"><MapLocation /></el-icon>
          <span class="mini-map-bar-text">{{ t('track.trackMap') }}</span>
          <el-icon class="mini-map-bar-toggle">
            <ArrowDown v-if="!miniMapMinimized" />
            <ArrowUp v-else />
          </el-icon>
        </div>
        <div v-show="!miniMapMinimized" class="mini-map" ref="miniMapRef"></div>
      </div>

      <!-- 共同进度条 -->
      <div class="progress-bar">
        <el-button
          class="progress-play"
          circle
          :icon="isPlaying ? VideoPause : VideoPlay"
          @click="togglePlay"
        />
        <!-- 音量（播放按钮右侧） -->
        <el-icon class="volume-btn" :title="muted ? '取消静音' : '静音'" @click="toggleMute">
          <Mute v-if="muted || volume <= 0" />
          <Headset v-else />
        </el-icon>
        <el-slider
          v-model="volume"
          class="volume-slider"
          :min="0"
          :max="1"
          :step="0.01"
          :show-tooltip="false"
          @input="onVolumeChange"
        />
        <span class="progress-time">{{ formatSeconds(currentSeconds) }}</span>
        <el-slider
          v-model="currentSeconds"
          class="progress-slider"
          :min="0"
          :max="durationSeconds || 0"
          :step="0.1"
          :disabled="!durationSeconds"
          :show-tooltip="false"
          @input="handleSliderInput"
        />
        <span class="progress-time">{{ formatSeconds(durationSeconds) }}</span>
        <!-- 自动播放下一个（全屏按钮左侧） -->
        <span class="auto-next" :title="t('track.autoNext')">
          <el-switch v-model="autoPlayNext" size="small" />
          <span class="auto-next-label">{{ t('track.autoNext') }}</span>
        </span>
        <!-- 全屏（右下角） -->
        <el-icon class="fullscreen-btn" :title="isFullscreen ? '退出全屏' : '全屏'" @click="toggleFullscreen">
          <FullScreen />
        </el-icon>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ElMessage } from 'element-plus'
import { VideoPlay, VideoPause, MapLocation, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, FullScreen, Mute, Headset } from '@element-plus/icons-vue'
import VideoPlayer from '@/components/videoPlayer/VideoPlayer.vue'
import { useSchemaStore } from '@/store/schema'
import { useAppStore } from '@/store/appSchema'
import { getDefaultMapTile } from '@/components/mapSelector/defaultMap'
import { fetchTrackPoints, extractRangeCoords, interpolateAt, getVideoColor } from '@/utils/videoNode'
import type { IGpxPoint } from '@/utils/videoNode'

const props = defineProps<{
  visible: boolean
  trackName?: string
  videoName?: string
  videoId?: string
  trackId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'update:videoId', value: string): void
  (e: 'update:videoName', value: string): void
}>()

const { t } = useI18n()
const schemaStore = useSchemaStore()
const appStore = useAppStore()

const subtitle = computed(() => props.videoName || props.trackName)
const title = computed(() =>
  subtitle.value ? `${t('track.videoPlay')} - ${subtitle.value}` : t('track.videoPlay')
)

// ---- 同轨迹视频列表（用于上一个/下一个切换） ----
interface PlayVideoItem {
  videoId: string
  name: string
}
const playVideoList = computed<PlayVideoItem[]>(() => {
  const track = findTrack()
  const infoList = schemaStore.getSchema.videoInfo || []
  return (track?.videos || []).map((r: any) => {
    const info = infoList.find((v) => v.id === r.videoId)
    return { videoId: r.videoId, name: info?.name || r.videoId }
  })
})
const currentIndex = computed(() => playVideoList.value.findIndex((v) => v.videoId === props.videoId))
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < playVideoList.value.length - 1)

function switchVideo(offset: number) {
  const target = playVideoList.value[currentIndex.value + offset]
  if (!target) return
  emit('update:videoId', target.videoId)
  emit('update:videoName', target.name)
}
function goPrev() {
  switchVideo(-1)
}
function goNext() {
  switchVideo(1)
}

// 自动播放下一个（持久化到 localStorage）
const AUTO_NEXT_KEY = 'picmap.trackVideoAutoNext'
const autoPlayNext = ref(localStorage.getItem(AUTO_NEXT_KEY) === '1')
watch(autoPlayNext, (val) => {
  localStorage.setItem(AUTO_NEXT_KEY, val ? '1' : '0')
})

// 当前视频播放结束：开启自动播放且存在下一个时自动切换
function handleEnded() {
  isPlaying.value = false
  if (autoPlayNext.value && hasNext.value) {
    goNext()
  }
}

// ---- 播放状态 ----
const playerRef = ref<any>(null)
const isPlaying = ref(false)
const currentSeconds = ref(0)
const durationSeconds = ref(0)
// 画中画地图是否最小化（折叠为小条，避免遮挡视频）
const miniMapMinimized = ref(false)

// ---- 画中画地图拖动放置 ----
const miniMapWrapRef = ref<HTMLElement>()
// 相对播放区左上角的位置；null 表示使用默认位置（右上角）
const miniMapPos = ref<{ x: number; y: number } | null>(null)
const miniMapStyle = computed(() => {
  const pos = miniMapPos.value
  return pos ? { left: `${pos.x}px`, top: `${pos.y}px`, right: 'auto' } : {}
})
const miniMapDrag = { active: false, moved: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 }

function startMiniMapDrag(e: MouseEvent) {
  if (!bodyRef.value || !miniMapWrapRef.value) return
  e.preventDefault()
  const bodyRect = bodyRef.value.getBoundingClientRect()
  const wrapRect = miniMapWrapRef.value.getBoundingClientRect()
  miniMapDrag.active = true
  miniMapDrag.moved = false
  miniMapDrag.startX = e.clientX
  miniMapDrag.startY = e.clientY
  miniMapDrag.startLeft = wrapRect.left - bodyRect.left
  miniMapDrag.startTop = wrapRect.top - bodyRect.top
  document.addEventListener('mousemove', onMiniMapDragMove)
  document.addEventListener('mouseup', onMiniMapDragEnd)
}

function onMiniMapDragMove(e: MouseEvent) {
  if (!miniMapDrag.active || !bodyRef.value || !miniMapWrapRef.value) return
  const dx = e.clientX - miniMapDrag.startX
  const dy = e.clientY - miniMapDrag.startY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) miniMapDrag.moved = true
  const bodyRect = bodyRef.value.getBoundingClientRect()
  const w = miniMapWrapRef.value.offsetWidth
  const h = miniMapWrapRef.value.offsetHeight
  const left = Math.max(0, Math.min(miniMapDrag.startLeft + dx, bodyRect.width - w))
  const top = Math.max(0, Math.min(miniMapDrag.startTop + dy, bodyRect.height - h))
  miniMapPos.value = { x: left, y: top }
}

function onMiniMapDragEnd() {
  document.removeEventListener('mousemove', onMiniMapDragMove)
  document.removeEventListener('mouseup', onMiniMapDragEnd)
  // 未发生位移视为点击 → 切换最小化
  if (miniMapDrag.active && !miniMapDrag.moved) toggleMiniMap()
  miniMapDrag.active = false
}

// ---- 全屏 ----
const bodyRef = ref<HTMLElement>()
const isFullscreen = ref(false)
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement
  // 全屏切换后画中画地图容器尺寸变化，需 resize
  nextTick(() => miniMap?.resize())
}
function toggleFullscreen() {
  if (!bodyRef.value) return
  if (document.fullscreenElement) {
    document.exitFullscreen?.()
  } else {
    bodyRef.value.requestFullscreen?.()
  }
}

// ---- 全屏下空闲自动隐藏控制（轨迹地图保留） ----
const IDLE_HIDE_MS = 5000
const controlsVisible = ref(true)
let idleTimer: number | null = null
function clearIdleTimer() {
  if (idleTimer != null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}
// 有交互：显示控制并重置空闲计时（仅全屏时计时隐藏）
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

// ---- 音量 ----
const volume = ref(1)
const muted = ref(false)
function toggleMute() {
  muted.value = !muted.value
  playerRef.value?.setMuted(muted.value)
}
function onVolumeChange(val: number | number[]) {
  const v = Array.isArray(val) ? val[0] : val
  volume.value = v
  muted.value = v <= 0
  playerRef.value?.setVolume(v)
  playerRef.value?.setMuted(v <= 0)
}

// 切换画中画地图的最小化状态；恢复时需 resize 地图以适配容器
function toggleMiniMap() {
  miniMapMinimized.value = !miniMapMinimized.value
  if (miniMapMinimized.value) {
    // 最小化时收缩回右上角
    miniMapPos.value = null
  } else {
    nextTick(() => {
      miniMap?.resize()
      // 恢复后让位置圆点跟上当前进度
      updateProgress(currentSeconds.value)
    })
  }
}

// ---- 轨迹数据 ----
const gpxPoints = ref<IGpxPoint[]>([])
// 视频起点绝对时刻（GPX 起始时刻 + timeOffsetMs）
const videoStartAbs = ref(0)
const videoDurationMs = ref(0)

const videoColor = computed(() => {
  const track = findTrack()
  const refs = track?.videos || []
  const idx = refs.findIndex((v: any) => v.videoId === props.videoId)
  return getVideoColor(idx < 0 ? 0 : idx)
})

// ---- 地图 ----
const miniMapRef = ref<HTMLElement>()
let miniMap: maplibregl.Map | null = null
const SEG_SOURCE = 'tvp-seg-src'
const SEG_LAYER = 'tvp-seg-layer'
const DONE_SOURCE = 'tvp-done-src'
const DONE_LAYER = 'tvp-done-layer'
let positionMarker: maplibregl.Marker | null = null
let mapReady = false

function findTrack() {
  if (!props.trackId) return undefined
  const normalize = (id: string) => String(id).replace(/\.gpx$/i, '').toLowerCase()
  return (schemaStore.getSchema.trackInfo || []).find(
    (item: any) => normalize(item.id) === normalize(props.trackId!)
  )
}

function getTileUrl(): string {
  const activeTiles = schemaStore.getSchema?.mapInfo?.activeTiles ?? []
  const customTiles = appStore.getAppSchema?.mapInfo?.mapTiles ?? []
  const defaultTileId = appStore.getAppSchema?.mapInfo?.defaultTileId ?? ''
  const defaultTiles = getDefaultMapTile()
  const allTiles = [...defaultTiles, ...customTiles]
  if (defaultTileId && activeTiles.includes(defaultTileId)) {
    const tile = allTiles.find((it) => it.id === defaultTileId)
    if (tile) return tile.url as string
  }
  const current = allTiles.find((tile) => activeTiles.includes(tile.id))
  return (current?.url as string) || (defaultTiles[0]?.url as string)
}

function initMap() {
  if (!miniMapRef.value || miniMap) {
    // 地图已存在时直接刷新当前视频（切换视频标签场景）
    applyVideoToMap()
    return
  }
  miniMap = new maplibregl.Map({
    container: miniMapRef.value,
    style: { version: 8, sources: {}, layers: [] },
    attributionControl: false,
    center: [120.2, 30.2],
    zoom: 10,
    minZoom: 3,
    maxZoom: 18,
  })
  miniMap.on('load', () => {
    const tileUrl = getTileUrl()
    if (tileUrl && !miniMap!.getSource('tvp-tile')) {
      miniMap!.addSource('tvp-tile', { type: 'raster', tiles: [tileUrl], tileSize: 256 })
      miniMap!.addLayer({ id: 'tvp-tile-layer', type: 'raster', source: 'tvp-tile' })
    }
    // 视频完整弧段（半透明底色）
    if (!miniMap!.getSource(SEG_SOURCE)) {
      miniMap!.addSource(SEG_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      miniMap!.addLayer({
        id: SEG_LAYER,
        type: 'line',
        source: SEG_SOURCE,
        paint: { 'line-color': videoColor.value, 'line-width': 6, 'line-opacity': 0.35 },
      })
    }
    // 已走过弧段（高亮）
    if (!miniMap!.getSource(DONE_SOURCE)) {
      miniMap!.addSource(DONE_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      miniMap!.addLayer({
        id: DONE_LAYER,
        type: 'line',
        source: DONE_SOURCE,
        paint: { 'line-color': videoColor.value, 'line-width': 6, 'line-opacity': 0.9 },
      })
    }
    mapReady = true
    applyVideoToMap()
  })
}

// 将当前视频数据应用到地图：更新配色、弧段、位置圆点并适配视野。
// 用于首次加载与切换视频标签后的刷新。
function applyVideoToMap() {
  if (!miniMap || !mapReady) return
  // 配色随当前视频更新
  if (miniMap.getLayer(SEG_LAYER)) miniMap.setPaintProperty(SEG_LAYER, 'line-color', videoColor.value)
  if (miniMap.getLayer(DONE_LAYER)) miniMap.setPaintProperty(DONE_LAYER, 'line-color', videoColor.value)
  // 重置进度状态并清除旧位置圆点
  lastDoneSeconds = -1
  pendingSeconds = null
  if (positionMarker) {
    positionMarker.remove()
    positionMarker = null
  }
  drawFullSegment()
  updateProgress(currentSeconds.value)
}

function destroyMap() {
  if (progressRaf != null) {
    cancelAnimationFrame(progressRaf)
    progressRaf = null
  }
  pendingSeconds = null
  lastDoneSeconds = -1
  if (positionMarker) {
    positionMarker.remove()
    positionMarker = null
  }
  if (miniMap) {
    miniMap.remove()
    miniMap = null
  }
  mapReady = false
}

function setLineData(sourceId: string, coords: [number, number][]) {
  if (!miniMap || !miniMap.getSource(sourceId)) return
  ;(miniMap.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  })
}

// 绘制视频完整弧段并适配视野
function drawFullSegment() {
  if (!miniMap || !mapReady) return
  const segCoords = extractRangeCoords(
    gpxPoints.value,
    videoStartAbs.value,
    videoStartAbs.value + videoDurationMs.value
  )
  setLineData(SEG_SOURCE, segCoords.length >= 2 ? segCoords : [])
  if (segCoords.length >= 2) {
    const bounds = segCoords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(segCoords[0], segCoords[0])
    )
    miniMap.fitBounds(bounds as any, { padding: 40, duration: 0, maxZoom: 17 })
  }
}

// 跳转/播放到某秒：更新已走过弧段与当前位置圆点
let lastDoneSeconds = -1
let pendingSeconds: number | null = null
let progressRaf: number | null = null

function updateProgress(seconds: number) {
  if (!miniMap || !mapReady) return
  const tAbs = videoStartAbs.value + Math.max(0, seconds) * 1000
  const pos = interpolateAt(gpxPoints.value, tAbs)
  if (pos) {
    if (!positionMarker) {
      const el = document.createElement('div')
      el.className = 'tvp-position-dot'
      positionMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      positionMarker.setLngLat(pos as [number, number]).addTo(miniMap)
    } else {
      positionMarker.setLngLat(pos as [number, number])
    }
  }
  // 已走过弧段：仅在秒数发生变化时重建，避免同一位置重复 setData
  if (Math.abs(seconds - lastDoneSeconds) < 0.05) return
  lastDoneSeconds = seconds
  const doneCoords = extractRangeCoords(gpxPoints.value, videoStartAbs.value, tAbs)
  setLineData(DONE_SOURCE, doneCoords.length >= 2 ? doneCoords : [])
}

// 将高频的进度更新合并到下一帧，避免 timeupdate 高频触发地图重绘
function scheduleProgressUpdate(seconds: number) {
  pendingSeconds = seconds
  if (progressRaf != null) return
  progressRaf = requestAnimationFrame(() => {
    progressRaf = null
    if (pendingSeconds != null) {
      updateProgress(pendingSeconds)
      pendingSeconds = null
    }
  })
}

// ---- 视频联动 ----
function handleLoadedMetadata(duration: number) {
  durationSeconds.value = duration || 0
  // 应用当前音量设置并自动播放
  nextTick(() => {
    playerRef.value?.setVolume(volume.value)
    playerRef.value?.setMuted(muted.value)
    playerRef.value?.play()
  })
}
function handleTimeUpdate(time: number) {
  currentSeconds.value = time
  scheduleProgressUpdate(time)
}
function handleSliderInput(value: number | number[]) {
  const sec = Array.isArray(value) ? value[0] : value
  playerRef.value?.seek(sec)
  updateProgress(sec)
}
function togglePlay() {
  if (isPlaying.value) playerRef.value?.pause()
  else playerRef.value?.play()
}

function formatSeconds(sec: number): string {
  if (!sec || !isFinite(sec)) return '00:00'
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// ---- 数据加载与生命周期 ----
async function loadData() {
  if (!props.trackId || !props.videoId) return
  const track = findTrack()
  const ref = (track?.videos || []).find((v: any) => v.videoId === props.videoId)
  const videoInfo = (schemaStore.getSchema.videoInfo || []).find((v) => v.id === props.videoId)
  videoDurationMs.value = videoInfo?.durationMs || 0
  const points = await fetchTrackPoints(props.trackId)
  gpxPoints.value = points || []
  const gpxStart = gpxPoints.value[0]?.timeMs || 0
  videoStartAbs.value = gpxStart + (ref?.timeOffsetMs ?? 0)
}

// 弹框打开/切换视频：重新加载当前视频数据并刷新地图
async function openVideo() {
  // 切换到不同视频时进度归零、播放状态复位（新视频由加载完成事件触发自动播放）
  currentSeconds.value = 0
  durationSeconds.value = 0
  isPlaying.value = false
  lastDoneSeconds = -1
  await loadData()
  if (!miniMap) {
    await nextTick()
    initMap()
  } else {
    initMap()
  }
}

watch(
  () => [props.visible, props.videoId, props.trackId] as const,
  async ([visible]) => {
    if (visible) await openVideo()
  },
  { immediate: true }
)

function onVisibleChange(value: boolean) {
  emit('update:visible', value)
}

// 关闭后销毁地图与数据（destroy-on-close 会重建内容）
function handleClosed() {
  if (document.fullscreenElement) document.exitFullscreen?.()
  destroyMap()
  gpxPoints.value = []
  currentSeconds.value = 0
  durationSeconds.value = 0
  isPlaying.value = false
  miniMapMinimized.value = false
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('keydown', showControls)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('keydown', showControls)
  clearIdleTimer()
  destroyMap()
})
</script>

<style scoped>
.track-video-play-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fullscreen-btn {
  flex-shrink: 0;
  font-size: 18px;
  color: #606266;
  cursor: pointer;
  padding: 2px;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
}

.auto-next {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.auto-next-label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}

.fullscreen-btn:hover {
  color: #303133;
  background: rgba(0, 0, 0, 0.06);
}

.track-video-play-body {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 72vh;
  background: transparent;
}

/* 全屏时铺满整个屏幕 */
.track-video-play-body:fullscreen {
  height: 100vh;
  width: 100vw;
  background: #000;
}

.track-video-play-body:fullscreen .video-area {
  margin: 0;
  border-radius: 0;
}

.track-video-play-body:fullscreen .progress-bar {
  margin: 8px 12px;
}

.video-area {
  flex: 1;
  min-height: 0;
  margin: 12px 12px 0;
  border-radius: 10px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #2b2f36 0%, #14161a 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

/* 上一个 / 下一个视频按钮（悬浮在视频区左右两侧中部） */
.video-nav {
  position: absolute;
  top: 44%;
  transform: translateY(-50%);
  z-index: 6;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s ease, transform 0.2s ease, opacity 0.3s ease;
}

.video-nav:hover {
  background: rgba(64, 158, 255, 0.85);
}

/* 全屏空闲时隐藏控制（轨迹地图保留） */
.track-video-play-body.controls-hidden .video-nav,
.track-video-play-body.controls-hidden .progress-bar {
  opacity: 0;
  pointer-events: none;
}

.video-nav-prev {
  left: 24px;
}

.video-nav-next {
  right: 24px;
}

.mini-map-wrap {
  position: absolute;
  right: 24px;
  top: 24px;
  width: 300px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(14px) saturate(1.5);
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  z-index: 5;
  transition: width 0.2s ease;
}

.mini-map-wrap.is-minimized {
  width: 138px;
}

.mini-map-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  color: #303133;
  font-size: 12px;
  cursor: move;
  user-select: none;
  background: rgba(255, 255, 255, 0.55);
  transition: background 0.2s ease;
}

.mini-map-bar:hover {
  background: rgba(64, 158, 255, 0.18);
}

.mini-map-bar-icon {
  font-size: 14px;
  color: #409eff;
}

.mini-map-bar-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.mini-map-bar-toggle {
  font-size: 14px;
  color: #909399;
}

.mini-map {
  width: 100%;
  height: 200px;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px;
  padding: 6px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: opacity 0.3s ease;
}

.progress-time {
  flex-shrink: 0;
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: #606266;
}

.progress-slider {
  flex: 1;
}

.volume-btn {
  flex-shrink: 0;
  font-size: 18px;
  color: #606266;
  cursor: pointer;
}

.volume-btn:hover {
  color: #409eff;
}

.volume-slider {
  flex-shrink: 0;
  width: 90px;
}

.progress-play {
  flex-shrink: 0;
  --el-button-bg-color: #409eff;
  --el-button-border-color: #409eff;
  --el-button-hover-bg-color: #66b1ff;
  --el-button-hover-border-color: #66b1ff;
  --el-button-text-color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.4);
}
</style>

<style>
/* 浅色毛玻璃弹框：半透明背景 + 模糊，弱化纯黑的老套观感（层级由 :z-index 控制） */
.el-dialog.track-video-play-dialog {
  --el-dialog-bg-color: transparent;
  --el-dialog-padding-primary: 0;

  padding: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
}

.el-dialog.track-video-play-dialog .el-dialog__header {
  position: relative;
  padding: 0;
  margin: 0;
  background: rgba(255, 255, 255, 0.5);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  transition: opacity 0.3s ease;
}

/* 全屏空闲时隐藏标题栏 */
.el-dialog.track-video-play-dialog.controls-hidden .el-dialog__header {
  opacity: 0;
  pointer-events: none;
}

.el-dialog.track-video-play-dialog .el-dialog__header .track-video-play-title {
  display: block;
  padding: 12px 16px;
  color: #303133;
  font-weight: 600;
}

.el-dialog.track-video-play-dialog .el-dialog__headerbtn {
  top: 8px;
}

.el-dialog.track-video-play-dialog .el-dialog__headerbtn .el-dialog__close {
  color: #606266;
  transition: color 0.2s, background 0.2s;
  border-radius: 6px;
  padding: 4px;
}

.el-dialog.track-video-play-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: #303133;
  background: rgba(0, 0, 0, 0.06);
}

.el-dialog.track-video-play-dialog .el-dialog__body {
  padding: 0;
  background: transparent;
}

/* 已走过/当前位置圆点（MapLibre 生成的 DOM 不受 scoped 影响） */
.tvp-position-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #409eff;
  border: 2px solid #fff;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
  transform: translate(-50%, -50%);
}
</style>
