<!--
 * @Description: 轨迹视频时间线对齐弹窗
 * - 主轨 = 该 GPX 轨迹的起点(0) → 终点(总时长)
 * - 每条视频一条带，宽度 = durationMs / 总时长 比例
 * - 整条拖拽视频条带 → 更新 timeOffsetMs（视频起点相对 GPX 起点的偏移）
 * - 地图预览：在轨迹线上叠加高亮子线，范围 = 视频起止时间对应坐标
-->
<template>
  <el-dialog :append-to-body="true" :z-index="1100" v-model="dialogVisible" :title="`轨迹视频对齐${trackName ? ' - ' + trackName : ''}`"
    width="80vw" :before-close="handleBeforeClose">
    <div v-if="loading" class="align-loading">
      <el-skeleton :rows="6" animated />
    </div>
    <div v-else-if="gpxPoints.length < 2" class="align-empty">
      <el-empty description="该轨迹缺少逐点坐标或时间信息，无法进行时间线对齐" :image-size="80" />
    </div>
    <div v-else class="align-content">
      <!-- 时间线 -->
      <div class="timeline-section">
        <div class="timeline-header">
          <span class="track-label">GPX 主轨</span>
          <div class="header-right">
            <span class="track-range">{{ formatMs(trackDurationMs) }}</span>
            <el-button size="small" @click="addVideoDialogVisible = true">添加视频</el-button>
            <el-button size="small" type="primary" plain :loading="localSelecting" @click="selectAndAddLocalVideos">
              添加本地视频
            </el-button>
          </div>
        </div>
        <div class="timeline-legend">
          <span>起点 0:00:00</span>
          <span>终点 {{ formatMs(trackDurationMs) }}</span>
        </div>
        <div class="timeline" ref="timelineRef">
          <!-- 主轨刻度线 -->
          <div class="track-scale"></div>
          <!-- 视频条带轨道 -->
          <div v-for="item in alignItems" :key="item.video.id" class="video-row"
            :class="{ active: activeVideoId === item.video.id }" @click="selectVideo(item.video.id)">
            <span class="video-name" :title="item.video.name">{{ item.video.name }}</span>
            <div class="video-lane">
              <!-- 条带 -->
              <div class="video-bar"
                :class="{ out: isOutOfRange(item) }"
                :style="barStyle(item)"
                @mousedown.stop="startDrag($event, item)">
                <span class="bar-label">{{ formatMs(item.video.durationMs) }}</span>
              </div>
              <!-- 越界标记 -->
              <span v-if="isOutOfRange(item)" class="out-warning" :style="outWarningStyle(item)">超出轨迹</span>
            </div>
            <div class="video-offset">
              <el-input v-model="item.offsetText" size="small" placeholder="HH:mm:ss" class="offset-input"
                @change="handleOffsetTextChange(item)" @blur="handleOffsetTextChange(item)" />
            </div>
            <el-button size="small" type="danger" class="video-remove" @click.stop="removeVideo(item.video.id)">
              移除
            </el-button>
          </div>
          <div v-if="alignItems.length === 0" class="no-video-tip">
            <el-empty description="该轨迹尚未关联视频，点击「添加视频」选择已上传视频，或「添加本地视频」从磁盘选择" :image-size="60" />
          </div>
        </div>
      </div>

      <!-- 地图预览：轨迹线 + 高亮弧段 -->
      <div class="map-section">
        <div class="map-header">
          <span>地图预览</span>
          <span v-if="activeVideoId" class="map-hint">
            {{ activeVideoName }}：{{ formatMs(activeOffsetMs) }} - {{ formatMs(activeOffsetMs + activeDurationMs) }}
          </span>
        </div>
        <div class="preview-map" ref="previewMapRef"></div>
      </div>

      <!-- 选中视频详情 -->
      <div v-if="activeVideo" class="detail-section">
        <span class="detail-label">起点偏移</span>
        <el-input v-model="activeOffsetText" size="small" class="detail-offset" placeholder="HH:mm:ss"
          @change="handleActiveOffsetChange" />
        <span class="detail-duration">时长 {{ formatMs(activeDurationMs) }}</span>
        <el-button size="small" type="primary" class="detail-focus" @click="focusActiveSegment">聚焦弧段</el-button>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <!-- 上传模式必须至少保留一个视频；普通模式允许清空（保存后即取消该轨迹的全部视频关联） -->
      <el-button type="primary" :disabled="!!props.pendingVideo && alignItems.length === 0" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>

  <!-- 添加视频弹窗 -->
  <el-dialog v-model="addVideoDialogVisible" title="添加视频到该轨迹" width="600px" append-to-body>
    <div class="add-video-content">
      <div class="add-video-hint">选择要添加到该轨迹的视频（已上传，或从本地磁盘选择）</div>
      <div class="add-video-toolbar">
        <el-button size="small" type="primary" plain :loading="localSelecting" @click="selectLocalForDialog">
          从本地选择视频
        </el-button>
        <span v-if="localSelecting" class="local-progress">
          解析中 {{ localProgress.processed }}/{{ localProgress.total }}
        </span>
      </div>
      <el-select v-model="selectedVideoIds" multiple filterable placeholder="选择视频" style="width: 100%">
        <el-option v-for="v in selectableVideos" :key="v.id" :label="v.local ? `${v.name}（本地）` : v.name"
          :value="v.id">
          <span>{{ v.name }}<span v-if="v.local" class="opt-local">本地</span></span>
          <span class="opt-duration">{{ formatMs(v.durationMs) }}</span>
        </el-option>
      </el-select>
      <el-empty v-if="selectableVideos.length === 0" description="暂无可添加的视频，可点击上方「从本地选择视频」" :image-size="60" />
    </div>
    <template #footer>
      <el-button @click="addVideoDialogVisible = false">取消</el-button>
      <el-button type="primary" :disabled="selectedVideoIds.length === 0" @click="confirmAddVideos">添加</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { ElMessage } from 'element-plus'
import i18n from '@/i18n/index'
import API from '@/wails/api'
import { useSchemaStore } from '@/store/schema'
import { useAppStore } from '@/store/appSchema'
import { getDefaultMapTile } from '@/components/mapSelector/defaultMap'
import { fetchTrackPoints, VIDEO_COLORS } from '@/utils/videoNode'
import type { IGpxPoint } from '@/utils/videoNode'
import { importVideo, pushVideoToSchema, associateVideoToTrack, videoSelectContext } from '@/utils/video'
import { editSchemaAttrAndSave, saveSchema } from '@/utils/schema'
import type { ITrackInfo, IVideoInfo, IVideoRef } from '@/type/schema'
import type { ISelectedVideo } from '@/type/video'

const dialogVisible = defineModel<boolean>('modelValue', { required: true })

const emit = defineEmits<{
  (e: 'aligned'): void
}>()

const props = defineProps<{
  trackId: string
  trackName?: string
  // 上传模式：传入待上传视频（尚未进 schema）时，对齐确认后自动上传并关联到该轨迹
  pendingVideo?: {
    id: string
    name: string
    path: string
    durationMs?: number
    startTimeMs?: number
  } | null
}>()

const schemaStore = useSchemaStore()
const appStore = useAppStore()

// ---- 数据加载 ----
const loading = ref(false)
const gpxPoints = ref<IGpxPoint[]>([])

// 对齐项：video + 当前偏移文本
interface AlignItem {
  video: IVideoInfo
  timeOffsetMs: number
  offsetText: string
  color: string
  // 本地待导入视频的磁盘路径（未进 schema，保存时导入）
  localPath?: string
}
const alignItems = ref<AlignItem[]>([])

// 相对对齐的基准时刻（视频时钟与轨迹时钟基准不一致时使用，取本次打开后最早的视频起点，跨多次添加保持稳定）
let relativeBaseMs = 0

const activeVideoId = ref<string | null>(null)

// 主轨总时长（GPX 起止时间差）
const trackDurationMs = computed(() => {
  const pts = gpxPoints.value
  if (pts.length < 2) return 0
  const first = pts[0].timeMs
  const last = pts[pts.length - 1].timeMs
  if (!first || !last) return 0
  return Math.max(0, last - first)
})

// 从文件名解析视频起始时刻（与后端 ParseStartTimeFromName 规则一致，作为兜底）
// 支持 DJI_20251130121358_0033_D、20260820_171710、IMG_20260820_171710 等
function parseNameTimeMs(name: string | undefined): number {
  if (!name) return 0
  const m = name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})[\s_\-]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})/)
  if (!m) return 0
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  const ms = date.getTime()
  return isNaN(ms) ? 0 : ms
}

// 视频起始绝对时刻（优先用文件解析值，缺失时用文件名解析兜底）
function videoStartMs(video: IVideoInfo | undefined): number {
  return video?.startTimeMs || parseNameTimeMs(video?.name) || 0
}

/**
 * @description: 为一组新增视频自动分配偏移。
 * 正常情况按"视频起点 - GPX 起点"绝对对齐；若所有视频都早于 GPX 起点（视频与轨迹时钟基准不一致，
 * 常见于无人机时区/时钟未校准），则退化为以最早视频为 0 点、按视频彼此间隔排布，保证相对位置正确。
 */
function assignAutoOffsets(items: AlignItem[]) {
  if (items.length === 0) return
  const gpxStart = gpxPoints.value[0]?.timeMs || 0
  const starts = items.map(i => videoStartMs(i.video))
  const hasStart = starts.map(s => s > 0)
  const absOffsets = starts.map(s => (gpxStart && s > 0) ? s - gpxStart : 0)

  const allKnown = hasStart.every(Boolean)
  const allBeforeTrack = allKnown && absOffsets.every(o => o <= 0)

  let offsets: number[]
  if (allBeforeTrack) {
    // 时钟基准不一致：以最早视频为基准做相对对齐；基准跨多次添加保持稳定
    const minStart = Math.min(...starts.filter(s => s > 0))
    if (!relativeBaseMs) relativeBaseMs = minStart
    offsets = starts.map(s => (s > 0 ? Math.max(0, s - relativeBaseMs) : 0))
  } else {
    offsets = absOffsets.map(o => Math.max(0, o))
  }

  const toText = (ms: number) => (ms ? new Date(ms).toLocaleString('zh-CN', { hour12: false }) : '-')
  console.log('[TrackVideoAlign] assignAutoOffsets', {
    mode: allBeforeTrack ? 'relative(相对最早视频)' : 'absolute(相对GPX起点)',
    gpxStartText: toText(gpxStart),
    items: items.map((item, i) => ({
      id: item.video.id,
      videoStartText: toText(starts[i]),
      rawOffsetMin: (absOffsets[i] / 60000).toFixed(1),
      offsetMin: (offsets[i] / 60000).toFixed(1),
    })),
  })

  items.forEach((item, i) => {
    item.timeOffsetMs = offsets[i]
    item.offsetText = msToHhmmss(offsets[i])
  })
}

function loadTrackVideos(): AlignItem[] {
  const schema = schemaStore.getSchema
  const track: ITrackInfo | undefined = schema.trackInfo?.find(t => t.id === props.trackId)
  const videoMap = new Map<string, IVideoInfo>()
  ;(schema.videoInfo || []).forEach(v => videoMap.set(v.id, v))

  const refs: IVideoRef[] = track?.videos || []
  const items: AlignItem[] = []
  refs.forEach((ref, idx) => {
    const video = videoMap.get(ref.videoId)
    if (!video) return
    const offset = ref.timeOffsetMs ?? 0
    items.push({
      video,
      timeOffsetMs: offset,
      offsetText: msToHhmmss(offset),
      color: VIDEO_COLORS[idx % VIDEO_COLORS.length],
    })
  })
  return items
}

// ---- 添加/移除视频 ----
const addVideoDialogVisible = ref(false)
const selectedVideoIds = ref<string[]>([])

// 本地磁盘选择解析出来的视频（尚未导入 schema）
const localVideos = ref<ISelectedVideo[]>([])
const localSelecting = ref(false)
const localProgress = ref({ processed: 0, total: 0 })
// 直接添加模式：从主弹窗「添加本地视频」入口选择后，解析完成自动加入对齐列表
const addLocalDirectly = ref(false)

// 把当前本地解析结果加入对齐列表（跳过已在列表中的）
function addLocalVideosToAlign() {
  const added: AlignItem[] = []
  localVideos.value.forEach(v => {
    if (alignItems.value.find(i => i.video.id === v.id)) return
    console.log('[TrackVideoAlign] addLocalVideo raw', v)
    const video = { id: v.id, name: v.name, durationMs: v.durationMs, startTimeMs: v.startTimeMs } as IVideoInfo
    const item: AlignItem = {
      video,
      timeOffsetMs: 0,
      offsetText: msToHhmmss(0),
      color: VIDEO_COLORS[alignItems.value.length % VIDEO_COLORS.length],
      localPath: v.path,
    }
    alignItems.value.push(item)
    added.push(item)
  })
  assignAutoOffsets(added)
  if (!activeVideoId.value && alignItems.value.length > 0) {
    activeVideoId.value = alignItems.value[0].video.id
  }
}

// 主弹窗「添加本地视频」：选择后直接加入对齐列表
function selectAndAddLocalVideos() {
  addLocalDirectly.value = true
  selectLocalVideos()
}

// 添加视频弹窗内「从本地选择视频」：仅收集到列表，待用户确认后加入
function selectLocalForDialog() {
  addLocalDirectly.value = false
  selectLocalVideos()
}

// 可添加的已上传视频：所有已导入视频中尚未关联到该轨迹的
const availableVideos = computed(() => {
  const schema = schemaStore.getSchema
  const track: ITrackInfo | undefined = schema.trackInfo?.find(t => t.id === props.trackId)
  const linkedIds = new Set((track?.videos || []).map(r => r.videoId))
  return (schema.videoInfo || []).filter(v => !linkedIds.has(v.id))
})

// 本地视频中尚未进 schema、且未在已上传列表出现的项
const localOnlyVideos = computed(() => {
  const uploadedIds = new Set((schemaStore.getSchema.videoInfo || []).map(v => v.id))
  const availableIds = new Set(availableVideos.value.map(v => v.id))
  return localVideos.value.filter(v => !uploadedIds.has(v.id) && !availableIds.has(v.id))
})

// 下拉可选列表：已上传视频 + 本地待导入视频（本地项标记 local）
interface SelectableVideo {
  id: string
  name: string
  durationMs?: number
  local: boolean
}
const selectableVideos = computed<SelectableVideo[]>(() => [
  ...availableVideos.value.map(v => ({ id: v.id, name: v.name || v.id, durationMs: v.durationMs, local: false })),
  ...localOnlyVideos.value.map(v => ({ id: v.id, name: v.name, durationMs: v.durationMs, local: true })),
])

// 打开本地文件选择框（复用后端 SelectVideos + 解析事件）
async function selectLocalVideos() {
  localSelecting.value = true
  localProgress.value = { processed: 0, total: 0 }
  videoSelectContext.owner = 'alignDialog'
  try {
    const res = await API.video.selectVideos()
    if (res.code !== 200) {
      localSelecting.value = false
      videoSelectContext.owner = ''
      ElMessage.error(res.msg || i18n.global.t('description.selectVideoFailed'))
      return
    }
    const total = res.data?.total ?? 0
    localProgress.value = { processed: 0, total }
    // 取消选择框时不会触发 videos-done 事件，需手动结束加载态
    if (total === 0) {
      localSelecting.value = false
      videoSelectContext.owner = ''
      addLocalDirectly.value = false
    }
  } catch (e) {
    console.error('选择视频失败', e)
    localSelecting.value = false
    videoSelectContext.owner = ''
    addLocalDirectly.value = false
    ElMessage.error(i18n.global.t('description.selectVideoFailed'))
  }
}

function confirmAddVideos() {
  const localMap = new Map(localOnlyVideos.value.map(v => [v.id, v]))
  const toAdd = selectedVideoIds.value
    .map(id => {
      const uploaded = availableVideos.value.find(v => v.id === id)
      if (uploaded) {
        return { video: uploaded as IVideoInfo, localPath: undefined as string | undefined }
      }
      const local = localMap.get(id)
      if (local) {
        return {
          video: { id: local.id, name: local.name, durationMs: local.durationMs, startTimeMs: local.startTimeMs } as IVideoInfo,
          localPath: local.path as string | undefined,
        }
      }
      return null
    })
    .filter((v): v is { video: IVideoInfo; localPath: string | undefined } => !!v)
  if (toAdd.length === 0) {
    addVideoDialogVisible.value = false
    return
  }
  console.log('[TrackVideoAlign] confirmAddVideos', toAdd.map(t => ({
    id: t.video.id,
    name: t.video.name,
    startTimeMs: t.video.startTimeMs,
    localPath: t.localPath,
  })))
  const added: AlignItem[] = []
  toAdd.forEach(({ video, localPath }) => {
    if (!alignItems.value.find(i => i.video.id === video.id)) {
      const item: AlignItem = {
        video,
        timeOffsetMs: 0,
        offsetText: msToHhmmss(0),
        color: VIDEO_COLORS[alignItems.value.length % VIDEO_COLORS.length],
        localPath,
      }
      alignItems.value.push(item)
      added.push(item)
    }
  })
  assignAutoOffsets(added)
  if (!activeVideoId.value && alignItems.value.length > 0) {
    activeVideoId.value = alignItems.value[0].video.id
  }
  selectedVideoIds.value = []
  addVideoDialogVisible.value = false
}

function removeVideo(videoId: string) {
  const index = alignItems.value.findIndex(i => i.video.id === videoId)
  if (index < 0) return
  alignItems.value.splice(index, 1)
  if (activeVideoId.value === videoId) {
    activeVideoId.value = alignItems.value.length > 0 ? alignItems.value[0].video.id : null
  }
}

async function loadData() {
  loading.value = true
  alignItems.value = []
  activeVideoId.value = null
  localVideos.value = []
  localSelecting.value = false
  localProgress.value = { processed: 0, total: 0 }
  addLocalDirectly.value = false
  relativeBaseMs = 0
  try {
    const pts = await fetchTrackPoints(props.trackId)
    gpxPoints.value = pts || []
    console.log('[TrackVideoAlign] loadData gpx', {
      trackId: props.trackId,
      count: gpxPoints.value.length,
      firstTimeMs: gpxPoints.value[0]?.timeMs,
      lastTimeMs: gpxPoints.value[gpxPoints.value.length - 1]?.timeMs,
    })
    if (gpxPoints.value.length >= 2) {
      if (props.pendingVideo) {
        // 上传模式：以该待上传视频为唯一对齐项
        const pendingVideoInfo = {
          id: props.pendingVideo.id,
          name: props.pendingVideo.name,
          durationMs: props.pendingVideo.durationMs,
          startTimeMs: props.pendingVideo.startTimeMs,
        } as IVideoInfo
        const item: AlignItem = {
          video: pendingVideoInfo,
          timeOffsetMs: 0,
          offsetText: msToHhmmss(0),
          color: VIDEO_COLORS[0],
        }
        alignItems.value = [item]
        assignAutoOffsets([item])
        activeVideoId.value = props.pendingVideo.id
      } else {
        alignItems.value = loadTrackVideos()
        if (alignItems.value.length > 0) {
          activeVideoId.value = alignItems.value[0].video.id
        }
      }
    }
  } catch (e) {
    console.error('加载轨迹点失败', e)
    gpxPoints.value = []
  } finally {
    loading.value = false
    nextTick(() => {
      initPreviewMap()
      refreshPreview()
    })
  }
}

watch(dialogVisible, (val) => {
  if (val) {
    loadData()
  } else {
    destroyPreviewMap()
    // 关闭弹窗时释放本地选择上下文，避免上传面板持续忽略解析事件
    if (videoSelectContext.owner === 'alignDialog') videoSelectContext.owner = ''
  }
})

// 监听"从本地选择视频"的后端解析事件（仅在本弹窗主动选择时消费）
onMounted(() => {
  API.video.onVideosParsed((payload: any) => {
    if (!localSelecting.value) return
    const videos: ISelectedVideo[] = payload?.videos ?? []
    videos.forEach(v => {
      if (!localVideos.value.find(item => item.id === v.id)) {
        localVideos.value.push(v)
      }
    })
  })
  API.video.onVideosProgress((payload: any) => {
    if (!localSelecting.value) return
    localProgress.value = { processed: payload?.processed ?? 0, total: payload?.total ?? 0 }
  })
  API.video.onVideosDone(() => {
    if (!localSelecting.value) return
    localSelecting.value = false
    videoSelectContext.owner = ''
    // 主弹窗入口：解析完成后直接加入对齐列表
    if (addLocalDirectly.value) {
      addLocalVideosToAlign()
      addLocalDirectly.value = false
    }
  })
})

onUnmounted(() => {
  destroyPreviewMap()
  // 若正在本地选择中卸载，释放选择上下文（事件监听由 UploadPanel 统一清理）
  if (videoSelectContext.owner === 'alignDialog') videoSelectContext.owner = ''
})

// ---- 时间线条带样式 ----
function barStyle(item: AlignItem): Record<string, string> {
  const duration = trackDurationMs.value || 1
  const width = Math.max(2, (item.video.durationMs || 0) / duration * 100)
  const left = Math.max(0, item.timeOffsetMs / duration * 100)
  return {
    width: `${width}%`,
    left: `${left}%`,
    background: item.color,
  }
}

function outWarningStyle(item: AlignItem): Record<string, string> {
  const duration = trackDurationMs.value || 1
  const left = (item.timeOffsetMs + (item.video.durationMs || 0)) / duration * 100
  return { left: `${Math.min(100, left)}%` }
}

function isOutOfRange(item: AlignItem): boolean {
  return item.timeOffsetMs + (item.video.durationMs || 0) > trackDurationMs.value
}

// ---- 条带拖拽 ----
let draggingItem: AlignItem | null = null
let dragStartX = 0
let dragStartOffset = 0
// 时间线满量程对应的像素宽度（拖动换算用，避免与鼠标位移不成比例）
let laneWidthPx = 0

// 计算时间线轨道（.video-lane）的实际像素宽度，作为满量程比例基准
function measureLaneWidth(): number {
  if (timelineRef.value) {
    const lane = timelineRef.value.querySelector('.video-lane')
    if (lane) return lane.clientWidth || timelineRef.value.clientWidth
  }
  return timelineRef.value?.clientWidth || 100
}

function startDrag(e: MouseEvent, item: AlignItem) {
  if (trackDurationMs.value <= 0) return
  e.preventDefault()
  draggingItem = item
  dragStartX = e.clientX
  dragStartOffset = item.timeOffsetMs
  laneWidthPx = measureLaneWidth()
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!draggingItem) return
  // 像素位移 / 轨道像素宽度 * 总时长 = 对应毫秒（保证与鼠标位移 1:1）
  const deltaMs = (e.clientX - dragStartX) / laneWidthPx * trackDurationMs.value
  let newOffset = Math.round(dragStartOffset + deltaMs)
  // 起点允许为负（视频从轨迹起点之前开始），但给出越界提示；不过度钳制以便调整
  if (newOffset < 0) newOffset = 0
  draggingItem.timeOffsetMs = newOffset
  draggingItem.offsetText = msToHhmmss(newOffset)
  // 实时联动地图预览（所有视频弧段一起刷新）
  refreshAllSegments()
}

function onDragEnd() {
  draggingItem = null
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// ---- 偏移文本输入 ----
function handleOffsetTextChange(item: AlignItem) {
  const ms = hhmmssToMs(item.offsetText)
  if (isNaN(ms) || ms < 0) {
    item.offsetText = msToHhmmss(item.timeOffsetMs)
    return
  }
  item.timeOffsetMs = ms
  item.offsetText = msToHhmmss(ms)
  refreshAllSegments()
}

function handleActiveOffsetChange() {
  const item = alignItems.value.find(i => i.video.id === activeVideoId.value)
  if (item) handleOffsetTextChange(item)
}

// ---- 激活项 ----
const activeVideo = computed<AlignItem | null>(() =>
  alignItems.value.find(i => i.video.id === activeVideoId.value) || null
)
const activeOffsetText = computed(() => activeVideo.value?.offsetText || '')
const activeOffsetMs = computed(() => activeVideo.value?.timeOffsetMs || 0)
const activeDurationMs = computed(() => activeVideo.value?.video.durationMs || 0)
const activeVideoName = computed(() => activeVideo.value?.video.name || '')

function selectVideo(videoId: string) {
  activeVideoId.value = videoId
  refreshAllSegments()
}

// ---- 地图预览 ----
const timelineRef = ref<HTMLElement>()
const previewMapRef = ref<HTMLElement>()
let previewMap: maplibregl.Map | null = null
const TRACK_SOURCE = 'align-track-src'
const TRACK_LAYER = 'align-track-layer'
const SEG_SOURCE = 'align-seg-src'
const SEG_LAYER = 'align-seg-layer'

function getPreviewTileUrl(): string {
  const activeTiles = schemaStore.getSchema?.mapInfo?.activeTiles ?? []
  const customTiles = appStore.getAppSchema?.mapInfo?.mapTiles ?? []
  const defaultTileId = appStore.getAppSchema?.mapInfo?.defaultTileId ?? ''
  const defaultTiles = getDefaultMapTile()
  const allTiles = [...defaultTiles, ...customTiles]
  if (defaultTileId && activeTiles.includes(defaultTileId)) {
    const defaultTile = allTiles.find(tile => tile.id === defaultTileId)
    if (defaultTile) return defaultTile.url as string
  }
  const currentTile = allTiles.find(tile => activeTiles.includes(tile.id))
  return (currentTile?.url as string) || (defaultTiles[0]?.url as string)
}

function initPreviewMap() {
  if (!previewMapRef.value || previewMap) return
  previewMap = new maplibregl.Map({
    container: previewMapRef.value,
    style: { version: 8, sources: {}, layers: [] },
    attributionControl: false,
    center: [120.2, 30.2],
    zoom: 10,
    minZoom: 3,
    maxZoom: 18,
  })
  previewMap.on('load', () => {
    const tileUrl = getPreviewTileUrl()
    if (tileUrl && !previewMap!.getSource('preview-tile')) {
      previewMap!.addSource('preview-tile', { type: 'raster', tiles: [tileUrl], tileSize: 256 })
      previewMap!.addLayer({ id: 'preview-tile-layer', type: 'raster', source: 'preview-tile' })
    }
    // 轨迹线
    if (!previewMap!.getSource(TRACK_SOURCE)) {
      previewMap!.addSource(TRACK_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      })
      previewMap!.addLayer({
        id: TRACK_LAYER, type: 'line', source: TRACK_SOURCE,
        paint: { 'line-color': '#409eff', 'line-width': 3, 'line-opacity': 0.6 },
      })
    }
    // 高亮弧段：所有已关联视频的弧段同时显示，颜色按各自视频配色（数据驱动）
    if (!previewMap!.getSource(SEG_SOURCE)) {
      previewMap!.addSource(SEG_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      previewMap!.addLayer({
        id: SEG_LAYER, type: 'line', source: SEG_SOURCE,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 7,
          'line-opacity': 0.9,
        },
      })
    }
    refreshPreview()
  })
}

function destroyPreviewMap() {
  if (previewMap) {
    previewMap.remove()
    previewMap = null
  }
}

// 刷新预览：画完整轨迹线 + 所有已关联视频的弧段
function refreshPreview() {
  if (!previewMap) return
  const pts = gpxPoints.value
  const coords = pts.map(p => [p.lng, p.lat] as [number, number])
  if (coords.length >= 2) {
    setLineData(TRACK_SOURCE, coords)
    if (!previewMap.getBounds().getNorthWest()) {
      try {
        const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
        previewMap.fitBounds(bounds, { padding: 30, duration: 200, maxZoom: 17 })
      } catch { /* 忽略 */ }
    }
  }
  refreshAllSegments()
}

// 刷新所有已关联视频的弧段（每个视频一段，各自颜色）
function refreshAllSegments() {
  if (!previewMap) return
  const features = alignItems.value
    .map(item => {
      const coords = extractSegmentCoords(item)
      if (coords.length < 2) return null
      return {
        type: 'Feature',
        properties: { color: item.color },
        geometry: { type: 'LineString', coordinates: coords },
      }
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
  setSegmentsData(features)
}

function setSegmentsData(features: any[]) {
  if (!previewMap) return
  if (!previewMap.getSource(SEG_SOURCE)) return
  ;(previewMap.getSource(SEG_SOURCE) as maplibregl.GeoJSONSource).setData({
    type: 'FeatureCollection',
    features,
  })
}

function setLineData(sourceId: string, coords: [number, number][]) {
  if (!previewMap) return
  if (!previewMap.getSource(sourceId)) return
  ;(previewMap.getSource(sourceId) as maplibregl.GeoJSONSource).setData({
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: coords },
  })
}

// 提取视频时间段 [startMs, startMs+duration] 对应的轨迹线坐标段（含首尾插值端点）
function extractSegmentCoords(item: AlignItem): [number, number][] {
  const pts = gpxPoints.value
  if (pts.length < 2) return []
  const gpxStart = pts[0].timeMs
  if (!gpxStart) return []
  const startAbs = gpxStart + item.timeOffsetMs
  const endAbs = gpxStart + item.timeOffsetMs + (item.video.durationMs || 0)

  // 在相邻两点上线性插值得到某时刻坐标
  const interpolateAt = (timeMs: number): [number, number] | null => {
    if (timeMs <= pts[0].timeMs) return [pts[0].lng, pts[0].lat]
    if (timeMs >= pts[pts.length - 1].timeMs) return [pts[pts.length - 1].lng, pts[pts.length - 1].lat]
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (a.timeMs === 0 || b.timeMs === 0) continue
      if (timeMs >= a.timeMs && timeMs <= b.timeMs) {
        const ratio = (timeMs - a.timeMs) / (b.timeMs - a.timeMs)
        return [a.lng + (b.lng - a.lng) * ratio, a.lat + (b.lat - a.lat) * ratio]
      }
    }
    return null
  }

  const startCoord = interpolateAt(startAbs)
  const endCoord = interpolateAt(endAbs)
  if (!startCoord || !endCoord) return []

  const coords: [number, number][] = [startCoord]
  // 收集时间段内的所有采样点
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (!p.timeMs) continue
    if (p.timeMs > startAbs && p.timeMs < endAbs) {
      coords.push([p.lng, p.lat])
    }
  }
  // 去重：末点可能与内部最后一点重合
  const last = coords[coords.length - 1]
  if (Math.abs(last[0] - endCoord[0]) > 1e-9 || Math.abs(last[1] - endCoord[1]) > 1e-9) {
    coords.push(endCoord)
  }
  return coords
}

function focusActiveSegment() {
  if (!previewMap || !activeVideo.value) return
  const segCoords = extractSegmentCoords(activeVideo.value)
  if (segCoords.length < 2) return
  try {
    const bounds = segCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(segCoords[0], segCoords[0]))
    previewMap.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 17 })
  } catch { /* 忽略 */ }
}

// ---- 保存 ----
async function handleSave() {
  const schema = schemaStore.getSchema
  const track = schema.trackInfo?.find(t => t.id === props.trackId)
  if (!track) {
    ElMessage.error(i18n.global.t('description.trackNotExist'))
    return
  }

  // 上传模式：先导入待上传视频到用户目录并写入 schema
  if (props.pendingVideo) {
    const item = alignItems.value[0]
    if (!item) return
    const res = await API.video.importVideo({
      id: props.pendingVideo.id,
      name: props.pendingVideo.name,
      path: props.pendingVideo.path,
    })
    if (res.code !== 200) {
      ElMessage.error(res.msg || i18n.global.t('description.videoImportFailed'))
      return
    }
    const vi: IVideoInfo = res.data
    // 关联信息（轨迹 + 偏移）只存 trackInfo.videos，videoInfo 不存 trackId/timeOffsetMs
    pushVideoToSchema(vi)
    associateVideoToTrack(props.trackId, vi.id, item.timeOffsetMs)
    await saveSchema()
    ElMessage.success(i18n.global.t('description.videoLinkedAndUploaded'))
    emit('aligned')
    dialogVisible.value = false
    return
  }

  // 更新 trackInfo.videos（权威来源）
  const trackInfoList = [...(schema.trackInfo || [])]
  const trackIndex = trackInfoList.findIndex(t => t.id === props.trackId)
  const refs: IVideoRef[] = []
  // 本地选择的视频需先导入到用户目录并写入 schema.videoInfo
  for (const item of alignItems.value) {
    let videoId = item.video.id
    if (item.localPath) {
      const vi = await importVideo({ id: item.video.id, name: item.video.name || '', path: item.localPath })
      if (!vi) {
        ElMessage.error(i18n.global.t('description.videoImportFailedNamed', { name: item.video.name || item.video.id }))
        return
      }
      pushVideoToSchema(vi)
      videoId = vi.id
      item.video = vi
      item.localPath = undefined
    }
    refs.push({ videoId, timeOffsetMs: item.timeOffsetMs })
  }
  trackInfoList[trackIndex] = { ...trackInfoList[trackIndex], videos: refs }

  await editSchemaAttrAndSave('trackInfo', trackInfoList)
  await saveSchema()
  ElMessage.success(i18n.global.t('description.alignSaved'))
  dialogVisible.value = false
}

async function handleBeforeClose(done: () => void) {
  done()
}

// ---- 时间格式化 ----
function msToHhmmss(ms: number): string {
  if (!ms && ms !== 0) return ''
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function hhmmssToMs(str: string): number {
  const parts = str.split(':').map(Number)
  if (parts.length !== 3 || parts.some(n => isNaN(n))) return NaN
  return ((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000)
}

function formatMs(ms: number | undefined): string {
  if (!ms) return '0:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${h}:${pad(m)}:${pad(s)}`
}
</script>

<style scoped>
.align-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.align-loading {
  min-height: 200px;
}

.align-empty {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-section {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.track-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.track-range {
  font-size: 12px;
  color: #909399;
}

.timeline-legend {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.timeline {
  position: relative;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafafa;
  padding: 8px;
  min-height: 60px;
  /* 轨道区最高 200px，超出滚动显示 */
  max-height: 200px;
  overflow-y: auto;
}

.track-scale {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: #409eff;
  border-radius: 2px;
  opacity: 0.5;
}

.video-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  cursor: pointer;
  border-radius: 4px;
}

.video-row.active {
  background: #f0f7ff;
}

.video-name {
  width: 140px;
  flex-shrink: 0;
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-lane {
  position: relative;
  flex: 1;
  height: 26px;
}

.video-bar {
  position: absolute;
  height: 22px;
  top: 2px;
  border-radius: 4px;
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2px;
  user-select: none;
  transition: filter 0.15s;
}

.video-bar:hover {
  filter: brightness(1.1);
}

.video-bar.out {
  background: #e6a23c;
}

.bar-label {
  font-size: 10px;
  color: #fff;
  white-space: nowrap;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.4);
}

.out-warning {
  position: absolute;
  top: -2px;
  transform: translateX(-50%);
  font-size: 10px;
  color: #e6a23c;
  white-space: nowrap;
  background: #fff;
  padding: 0 4px;
  border-radius: 2px;
  border: 1px solid #e6a23c;
}

.video-offset {
  width: 110px;
  flex-shrink: 0;
}

.offset-input {
  width: 100%;
}

.no-video-tip {
  padding: 10px 0;
}

.map-section {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.map-hint {
  font-size: 12px;
  font-weight: 400;
  color: #e6a23c;
}

.preview-map {
  width: 100%;
  height: 26vh;
  border-radius: 6px;
  overflow: hidden;
}

.detail-section {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fff;
}

.detail-label {
  font-size: 13px;
  color: #606266;
}

.detail-offset {
  width: 140px;
}

.detail-duration {
  font-size: 12px;
  color: #909399;
}

.detail-focus {
  margin-left: auto;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.video-remove {
  flex-shrink: 0;
}

.add-video-content {
  padding: 4px 8px;
}

.add-video-hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.add-video-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.local-progress {
  font-size: 12px;
  color: #909399;
}

.opt-local {
  margin-left: 6px;
  padding: 0 4px;
  font-size: 11px;
  color: #409eff;
  background: rgba(64, 158, 255, 0.12);
  border-radius: 3px;
}

.opt-duration {
  float: right;
  color: #909399;
  font-size: 12px;
}

</style>
