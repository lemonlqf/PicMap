<!--
 * @Description: 轨迹视频上传弹窗（统一轨迹/轨迹视频入口）
 * - 支持上传内嵌 GPS 的轨迹视频（可独立）
 * - 支持普通视频关联已有 GPX 轨迹后上传
-->
<template>
  <el-dialog :append-to-body="true" :z-index="1000" v-model="dialogVisible" title="上传轨迹视频" width="70vw"
    :before-close="handleBeforeClose">
    <div class="video-upload-content">
      <div class="toolbar">
        <el-button type="primary" @click="handleSelectVideos" :disabled="isParsing">
          {{ isParsing ? '解析中...' : '选择视频' }}
        </el-button>
        <span class="hint">普通视频需先选择关联的 GPX 轨迹</span>
      </div>

      <div v-if="parseProgress.total > 0 && parseProgress.processed < parseProgress.total" class="progress">
        <el-progress :percentage="Math.round(parseProgress.processed / parseProgress.total * 100)"
          :format="() => `${parseProgress.processed}/${parseProgress.total}`" />
      </div>

      <!-- 已上传视频列表 -->
      <div class="section">
        <h3 class="section-title">已上传视频</h3>
        <div class="video-list">
          <div v-for="video in uploadedVideos" :key="video.id" class="video-item uploaded">
            <div class="video-info">
              <div class="name">{{ video.name }}</div>
              <div class="meta">
                <span>{{ formatDuration(video.durationMs) }}</span>
                <span v-if="video.trackId" class="track-name">轨迹: {{ getTrackName(video.trackId) }}</span>
                <span v-if="video.GPSLatitude && video.GPSLongitude" class="manual-badge">
                  已定位 {{ Number(video.GPSLatitude).toFixed(4) }}, {{ Number(video.GPSLongitude).toFixed(4) }}
                </span>
                <span class="mode-text">{{ video.timeMode === 'offset' ? '相对轨迹' : '绝对时间' }}</span>
              </div>
            </div>
            <div class="video-actions">
              <el-button size="small" @click="openPlayer(video.id)">播放</el-button>
              <el-button size="small" @click="toggleEdit(video.id)">{{ editingVideoId === video.id ? '收起' : '编辑' }}</el-button>
              <el-button size="small" type="danger" @click="handleDeleteUploaded(video.id)">删除</el-button>
            </div>
          </div>
          <el-empty v-if="uploadedVideos.length === 0" description="暂无已上传视频" :image-size="60" />
        </div>
      </div>

      <!-- 编辑已上传视频弹窗 -->
      <el-dialog v-model="editDialogVisible" title="编辑视频对齐" width="760px" append-to-body>
        <div v-if="editingVideo" class="edit-form">
          <div class="edit-name">{{ editingVideo.name }}</div>
          <div class="edit-body">
            <el-form label-width="110px" label-position="left" class="edit-left">
              <el-form-item label="关联轨迹">
                <el-select v-model="editingForm.trackId" filterable clearable style="width: 100%">
                  <el-option v-for="track in trackList" :key="track.id" :label="track.name || track.id"
                    :value="track.id" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="editingForm.trackId" label="轨迹时间">
                <div class="track-time-range">
                  <div>开始: {{ getTrackTimeText(editingForm.trackId, 'start') }}</div>
                  <div>结束: {{ getTrackTimeText(editingForm.trackId, 'end') }}</div>
                </div>
              </el-form-item>
              <el-form-item label="时间模式">
                <el-select v-model="editingForm.timeMode" style="width: 100%">
                  <el-option label="绝对时间" value="absolute" />
                  <el-option label="相对轨迹" value="offset" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="editingForm.timeMode !== 'offset'" label="起始时刻">
                <el-date-picker v-model="editingForm.startTimeText" type="datetime" placeholder="起始时刻"
                  format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
              </el-form-item>
              <el-form-item v-else label="相对偏移">
                <el-time-picker v-model="editingForm.offsetText" placeholder="距轨迹起点" format="HH:mm:ss"
                  value-format="HH:mm:ss" style="width: 100%" />
              </el-form-item>
              <el-form-item label="预览节点">
                <span class="preview-node-count">{{ previewNodeCount }} 个</span>
              </el-form-item>
            </el-form>
            <div class="edit-right">
              <div class="preview-map" ref="previewMapRef"></div>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveEdit">保存</el-button>
        </template>
      </el-dialog>

      <!-- 播放视频弹窗 -->
      <el-dialog v-model="playerVisible" title="播放视频" width="720px" append-to-body>
        <div class="player-container">
          <VideoPlayer v-if="playerVisible && playingVideoId" :video-id="playingVideoId"
            :poster="''" />
        </div>
      </el-dialog>

      <!-- 手动定位弹窗（复用图片定位弹窗） -->
      <LocateDialog v-model="locateDialogShow" :image-id="locateVideoId" @confirm="handleLocateConfirm"
        @manual-locate="handleLocateManual"></LocateDialog>

      <!-- 待上传视频列表 -->
      <div class="section">
        <h3 class="section-title">待上传视频</h3>
        <div class="video-list">
        <div v-for="video in pendingVideoList" :key="video.id" class="video-item">
          <div class="video-info">
            <div class="name">{{ video.name }}</div>
            <div class="meta">
              <span>{{ formatDuration(video.durationMs) }}</span>
              <span v-if="video.imported && nodesMap[video.id]" class="node-text">
                已生成 {{ nodesMap[video.id] }} 个节点
              </span>
              <span v-if="video.parsedTimeText" class="time-text">解析时间: {{ video.parsedTimeText }}</span>
              <span v-else class="time-text warn">未解析到时间，可手动选择</span>
              <span v-if="video.hasGpsData" class="gps-badge">含GPS</span>
              <span v-if="manualGpsMap[video.id]" class="manual-badge">
                已定位 {{ manualGpsMap[video.id].lat.toFixed(4) }}, {{ manualGpsMap[video.id].lng.toFixed(4) }}
              </span>
            </div>
          </div>
          <div class="video-actions">
            <el-select v-model="selectedTrackMap[video.id]" :placeholder="video.hasGpsData || manualGpsMap[video.id] ? '可选关联 GPX' : '选择 GPX 轨迹'"
              clearable filterable size="small" class="track-select">
              <el-option v-for="track in trackList" :key="track.id" :label="track.name || track.id"
                :value="track.id" />
            </el-select>

            <el-select v-model="timeModeMap[video.id]" size="small" class="mode-select"
              @change="handleModeChange(video)">
              <el-option label="绝对时间" value="absolute" />
              <el-option label="相对轨迹" value="offset" />
            </el-select>

            <!-- 绝对时间模式 -->
            <el-date-picker v-if="timeModeMap[video.id] !== 'offset'" v-model="absoluteTimeMap[video.id]"
              type="datetime" placeholder="起始时刻" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss"
              size="small" />

            <!-- 相对偏移模式 -->
            <el-time-picker v-else v-model="offsetTimeMap[video.id]" placeholder="距轨迹起点" format="HH:mm:ss"
              value-format="HH:mm:ss" size="small" />

            <el-button size="small" :type="manualGpsMap[video.id] ? 'success' : 'default'"
              @click="showManualLocate(video.id)">
              {{ manualGpsMap[video.id] ? '已定位' : '定位' }}
            </el-button>
            <el-button type="primary" size="small" :loading="importingMap[video.id]"
              @click="handleImport(video)">导入</el-button>
            <el-button size="small" @click="handleRemove(video.id)">移除</el-button>
          </div>
        </div>
        <el-empty v-if="pendingVideoList.length === 0" description="尚未选择视频" />
        </div>
        </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import * as maplibregl from 'maplibre-gl'
import { ElMessage, ElMessageBox } from 'element-plus'
import API from '@/wails/api'
import { useSchemaStore } from '@/store/schema'
import { useAppStore } from '@/store/appSchema'
import { getDefaultMapTile } from '@/components/mapSelector/defaultMap'
import { importVideo, pushVideoToSchema, associateVideoToTrack, deleteVideos } from '@/utils/video'
import { saveSchema, editSchemaAttrAndSave } from '@/utils/schema'
import { generateVideoNodes, fetchTrackPoints } from '@/utils/videoNode'
import VideoPlayer from '@/components/videoPlayer/VideoPlayer.vue'
import LocateDialog from '@/components/imgUpload/LocateDialog.vue'
import markerService from '@/services/marker'
import type { ISelectedVideo } from '@/type/video'
import type { IVideoInfo, ITrackInfo } from '@/type/schema'

const dialogVisible = defineModel<boolean>('modelValue', { required: true })

const schemaStore = useSchemaStore()
const appStore = useAppStore()
const videoList = ref<ISelectedVideo[]>([])
const selectedTrackMap = ref<Record<string, string>>({})
const timeModeMap = ref<Record<string, 'absolute' | 'offset'>>({})
const absoluteTimeMap = ref<Record<string, string>>({})  // 绝对起始时刻 "YYYY-MM-DD HH:mm:ss"
const offsetTimeMap = ref<Record<string, string>>({})    // 相对轨迹起点偏移 "HH:mm:ss"
const importingMap = ref<Record<string, boolean>>({})
const nodesMap = ref<Record<string, number>>({}) // videoId -> 生成节点数
const isParsing = ref(false)
const parseProgress = ref({ processed: 0, total: 0 })

// 手动定位：videoId -> { lat, lng }（地图坐标系，与图片手动定位一致）
const manualGpsMap = ref<Record<string, { lat: number; lng: number }>>({})
const locateDialogShow = ref(false)
const locateVideoId = ref<string | null>(null)

// 可选的 GPX 轨迹列表
const trackList = ref<ITrackInfo[]>([])

// 已上传视频列表（从 schema.videoInfo 加载）
const uploadedVideos = computed<IVideoInfo[]>(() => {
  return schemaStore.getSchema.videoInfo || []
})

// 待上传视频列表（剔除已导入的）
const pendingVideoList = computed(() => {
  return videoList.value.filter(v => !v.imported)
})

// ---- 已上传视频编辑状态 ----
const editDialogVisible = ref(false)
const editingVideoId = ref('')
const editingVideo = ref<IVideoInfo | null>(null)
const editingForm = ref<{
  trackId?: string
  timeMode: 'absolute' | 'offset'
  startTimeText: string
  offsetText: string
}>({ timeMode: 'absolute', startTimeText: '', offsetText: '' })
const editingNodesMap = ref<Record<string, number>>({})

// ---- 视频播放状态 ----
const playerVisible = ref(false)
const playingVideoId = ref('')

function openPlayer(videoId: string) {
  playingVideoId.value = videoId
  playerVisible.value = true
}

// ---- 预览地图 ----
const previewMapRef = ref<HTMLElement>()
const previewNodeCount = ref(0)
let previewMap: maplibregl.Map | null = null
const previewNodeMarkers: maplibregl.Marker[] = []
let previewTimer: ReturnType<typeof setTimeout> | null = null

/**
 * @description: 获取当前瓦片 URL（与主地图/轨迹地图一致）
 */
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

/**
 * @description: 初始化预览地图
 */
function initPreviewMap() {
  if (!previewMapRef.value || previewMap) return
  previewMap = new maplibregl.Map({
    container: previewMapRef.value,
    style: { version: 8, sources: {}, layers: [] },
    attributionControl: false,
    center: [120.2, 30.2],
    zoom: 12,
    minZoom: 3,
    maxZoom: 18,
  })
  previewMap.on('load', () => {
    // 加载瓦片图层（与主地图一致的瓦片源）
    const tileUrl = getPreviewTileUrl()
    if (tileUrl && !previewMap!.getSource('preview-tile')) {
      previewMap!.addSource('preview-tile', { type: 'raster', tiles: [tileUrl], tileSize: 256 })
      previewMap!.addLayer({ id: 'preview-tile-layer', type: 'raster', source: 'preview-tile' })
    }
    // 首次打开即刷新预览
    refreshPreview()
  })
}

/**
 * @description: 刷新预览：绘制轨迹线 + 节点
 */
async function refreshPreview() {
  const map = previewMap
  if (!map || !editingVideo.value) return
  const form = editingForm.value
  if (!form.trackId) {
    clearPreview()
    return
  }

  // 清除旧图层与节点
  clearPreview()

  // 加载轨迹点，绘制轨迹线
  const gpx = await fetchTrackPoints(form.trackId)
  let coords: [number, number][] = []
  if (gpx && gpx.length > 0) {
    coords = gpx.map(p => [p.lng, p.lat] as [number, number])
    if (!map.getSource('preview-track')) {
      map.addSource('preview-track', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      })
      map.addLayer({ id: 'preview-track-layer', type: 'line', source: 'preview-track', paint: { 'line-color': '#409eff', 'line-width': 3 } })
    } else {
      ;(map.getSource('preview-track') as any).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } })
    }
  }

  // 生成节点（当前表单配置）
  const video: IVideoInfo = {
    id: editingVideo.value.id,
    name: editingVideo.value.name,
    trackId: form.trackId,
    timeMode: form.timeMode,
    durationMs: editingVideo.value.durationMs,
  }
  if (form.timeMode === 'absolute') {
    video.startTimeMs = form.startTimeText ? new Date(form.startTimeText.replace(' ', 'T')).getTime() : 0
  } else {
    video.timeOffsetMs = form.offsetText ? hhmmssToMs(form.offsetText) : 0
  }

  const nodes = await generateVideoNodes(video)
  previewNodeCount.value = nodes.length
  nodes.forEach(node => {
    const el = document.createElement('div')
    el.style.cssText =
      'width:12px;height:12px;border-radius:50%;background:#e6a23c;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);'
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([node.lng, node.lat])
      .addTo(map)
    previewNodeMarkers.push(marker)
  })

  // 适配边界（轨迹 + 节点）
  try {
    if (coords && coords.length > 0) {
      const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
      map.fitBounds(bounds, { padding: 30, duration: 200, maxZoom: 18 })
    }
  } catch { /* 忽略边界适配失败 */ }
}

/**
 * @description: 清除预览图层与节点
 */
function clearPreview() {
  previewNodeCount.value = 0
  previewNodeMarkers.forEach(m => m.remove())
  previewNodeMarkers.length = 0
  if (previewMap) {
    if (previewMap.getLayer('preview-track-layer')) previewMap.removeLayer('preview-track-layer')
    if (previewMap.getSource('preview-track')) previewMap.removeSource('preview-track')
  }
}

/**
 * @description: 获取轨迹时间范围文本
 */
function getTrackTimeText(trackId: string, type: 'start' | 'end'): string {
  // 直接从 schema 读取，避免 trackList 未加载导致显示不出来
  const track = (schemaStore.getSchema.trackInfo || []).find(t => t.id === trackId)
  if (!track) return '-'
  const val = type === 'start' ? track.startTime : track.endTime
  if (!val) return '-'
  return formatDateTimePreservingValue(val)
}

/**
 * @description: 将日期时间字符串格式化为 "YYYY-MM-DD HH:mm:ss"
 * 保持原始数值（不做时区换算），兼容多种常见格式：
 *  - 2024-11-03T13:38:24.000Z
 *  - 2024-11-03 13:38:24
 *  - 2024/11/03 13:38:24
 *  - 2024-11-03T13:38:24+08:00
 * 无法解析时返回原串。
 */
function formatDateTimePreservingValue(val: string): string {
  // 提取 年月日 [分隔符] 时分秒（忽略毫秒与时区后缀）
  const m = val.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2}):(\d{1,2}))?/)
  if (!m) return val
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  const pad = (n: string) => n.padStart(2, '0')
  const timePart = m[4] !== undefined
    ? `${pad(h)}:${pad(mi)}:${pad(s)}`
    : '00:00:00'
  return `${y}-${pad(mo)}-${pad(d)} ${timePart}`
}

/**
 * @description: 打开编辑弹窗，回填已上传视频的当前配置
 */
function toggleEdit(videoId: string) {
  if (editingVideoId.value === videoId && editDialogVisible.value) {
    editDialogVisible.value = false
    return
  }
  const video = uploadedVideos.value.find(v => v.id === videoId)
  if (!video) return
  // 重新加载轨迹列表，确保编辑时可选且能显示轨迹时间
  trackList.value = schemaStore.getSchema.trackInfo || []
  editingVideoId.value = videoId
  editingVideo.value = { ...video }
  editingForm.value = {
    trackId: video.trackId,
    timeMode: video.timeMode === 'offset' ? 'offset' : 'absolute',
    startTimeText: video.startTimeMs ? msToDateTime(video.startTimeMs) : '',
    offsetText: msToHhmmss(video.timeOffsetMs || 0),
  }
  editDialogVisible.value = true
}

// 编辑弹窗打开时初始化预览地图，关闭时销毁
watch(editDialogVisible, (val) => {
  if (val) {
    nextTick(() => {
      initPreviewMap()
      refreshPreview()
    })
  } else {
    if (previewMap) {
      previewMap.remove()
      previewMap = null
    }
    clearPreview()
    editingVideo.value = null
    editingVideoId.value = ''
  }
})

// 编辑表单变化时实时刷新预览（防抖 200ms）
watch(editingForm, () => {
  if (!editDialogVisible.value) return
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    refreshPreview()
  }, 200)
}, { deep: true })

/**
 * @description: 保存已上传视频的修改
 */
async function saveEdit() {
  const video = editingVideo.value
  if (!video) return
  const form = editingForm.value

  // 校验：普通视频需关联轨迹
  if (!form.trackId) {
    ElMessage.warning('请选择关联的 GPX 轨迹')
    return
  }
  if (form.timeMode === 'absolute' && !form.startTimeText) {
    ElMessage.warning('请设置绝对起始时刻')
    return
  }
  if (form.timeMode === 'offset' && !form.offsetText) {
    ElMessage.warning('请设置相对偏移')
    return
  }

  // 更新 videoInfo
  const videoInfoList = [...(schemaStore.getSchema.videoInfo || [])]
  const idx = videoInfoList.findIndex(v => v.id === video.id)
  if (idx < 0) {
    ElMessage.error('视频不存在')
    return
  }
  const updated: IVideoInfo = { ...videoInfoList[idx] }
  updated.trackId = form.trackId
  updated.timeMode = form.timeMode
  if (form.timeMode === 'absolute') {
    updated.startTimeMs = new Date(form.startTimeText.replace(' ', 'T')).getTime()
    updated.timeOffsetMs = undefined
  } else {
    updated.timeOffsetMs = hhmmssToMs(form.offsetText)
    updated.startTimeMs = undefined
  }
  videoInfoList[idx] = updated

  // 更新关联轨迹的 videos 引用
  const trackInfoList = [...(schemaStore.getSchema.trackInfo || [])]
  // 从旧轨迹移除引用
  if (video.trackId) {
    const oldTrack = trackInfoList.find(t => t.id === video.trackId)
    if (oldTrack?.videos) {
      oldTrack.videos = oldTrack.videos.filter(v => v.videoId !== video.id)
    }
  }
  // 添加到新轨迹
  const newTrack = trackInfoList.find(t => t.id === form.trackId)
  if (newTrack) {
    if (!newTrack.videos) newTrack.videos = []
    const existing = newTrack.videos.find(v => v.videoId === video.id)
    const offset = updated.timeOffsetMs || 0
    if (existing) {
      existing.timeOffsetMs = offset
    } else {
      newTrack.videos.push({ videoId: video.id, timeOffsetMs: offset })
    }
  }

  await editSchemaAttrAndSave('videoInfo', videoInfoList)
  await editSchemaAttrAndSave('trackInfo', trackInfoList)

  // 重新生成节点
  const nodes = await generateVideoNodes(updated)
  editingNodesMap.value[video.id] = nodes.length
  editDialogVisible.value = false
  editingVideoId.value = ''
  ElMessage.success(`已保存，生成 ${nodes.length} 个节点`)
}

/**
 * @description: 删除已上传视频
 */
async function handleDeleteUploaded(videoId: string) {
  try {
    await ElMessageBox.confirm('确定删除该视频吗？删除后无法恢复。', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await deleteVideos([videoId])
  ElMessage.success('删除成功')
}

/**
 * @description: 根据轨迹 ID 获取轨迹名称
 */
function getTrackName(trackId: string): string {
  return trackList.value.find(t => t.id === trackId)?.name || trackId
}

/**
 * @description: 切换时间对齐模式时，把已解析的文件名时间预填到绝对时间
 */
function handleModeChange(video: ISelectedVideo) {
  // 切到绝对时间且未设置时，用解析到的文件名时间预填
  if (timeModeMap.value[video.id] !== 'offset' && !absoluteTimeMap.value[video.id] && video.parsedTimeText) {
    absoluteTimeMap.value[video.id] = video.parsedTimeText
  }
}

watch(dialogVisible, (val) => {
  if (val) {
    trackList.value = schemaStore.getSchema.trackInfo || []
    loadExistingVideos()
  }
})

/**
 * @description: 从 schema 加载已导入的视频（标记为已导入，避免重复）
 */
function loadExistingVideos() {
  const existing = schemaStore.getSchema.videoInfo || []
  // 只显示尚未在列表中的已导入视频
  videoList.value.forEach(v => {
    if (existing.find(e => e.id === v.id)) {
      v.imported = true
    }
  })
}

/**
 * @description: 选择视频
 */
async function handleSelectVideos() {
  isParsing.value = true
  try {
    const res = await API.video.selectVideos()
    if (res.code !== 200) {
      ElMessage.error(res.msg || '选择视频失败')
      return
    }
    parseProgress.value = { processed: 0, total: res.data?.total ?? 0 }
  } catch (e) {
    console.error('选择视频失败', e)
    ElMessage.error('选择视频失败')
  }
}

/**
 * @description: 打开定位弹窗为视频手动设置坐标（复用图片定位弹窗）
 */
function showManualLocate(videoId: string) {
  locateVideoId.value = videoId
  locateDialogShow.value = true
}

/**
 * @description: 处理定位弹窗手动输入经纬度确认
 */
function handleLocateConfirm(data: { id: string | null; GPSLatitude: number | null; GPSLongitude: number | null; GPSAltitude: number | null }) {
  if (data.id && data.GPSLatitude != null && data.GPSLongitude != null) {
    manualGpsMap.value[data.id] = { lat: data.GPSLatitude, lng: data.GPSLongitude }
  }
}

/**
 * @description: 处理定位弹窗"手动定位"（取当前地图中心）
 */
function handleLocateManual(data: { id: string | null; lat: number; lng: number }) {
  if (data.id) {
    manualGpsMap.value[data.id] = { lat: data.lat, lng: data.lng }
  }
}

/**
 * @description: 导入单个视频
 */
async function handleImport(video: ISelectedVideo) {
  const trackId = selectedTrackMap.value[video.id]
  const manualGps = manualGpsMap.value[video.id]
  // 普通视频（无内嵌 GPS 且未手动定位）必须关联 GPX；有 GPS 或已手动定位的可单独上传或可选关联
  if (!video.hasGpsData && !trackId && !manualGps) {
    ElMessage.warning('普通视频需选择关联的 GPX 轨迹，或手动定位')
    return
  }

  // 解析时间对齐方式（二选一）；单独上传的视频（内嵌 GPS 或已手动定位）可不设置时间
  const mode = timeModeMap.value[video.id] || 'absolute'
  const isStandalone = !trackId && (video.hasGpsData || !!manualGps)
  if (!isStandalone) {
    if (mode === 'absolute' && !absoluteTimeMap.value[video.id]) {
      ElMessage.warning('请设置视频的绝对起始时刻')
      return
    }
    if (mode === 'offset' && !offsetTimeMap.value[video.id]) {
      ElMessage.warning('请设置视频相对轨迹起点的偏移')
      return
    }
  }

  importingMap.value[video.id] = true
  try {
    const res = await API.video.importVideo({ id: video.id, name: video.name, path: video.path })
    if (res.code !== 200) {
      ElMessage.error(res.msg || '导入失败')
      return
    }
    const vi: IVideoInfo = res.data
    // 手动定位优先覆盖（内嵌 GPS 已在后端转为 GCJ02，手动坐标为地图坐标系）
    if (manualGps) {
      vi.GPSLatitude = manualGps.lat
      vi.GPSLongitude = manualGps.lng
    }
    // 记录关联的 GPX 与时间对齐方式
    if (trackId) {
      vi.trackId = trackId
      vi.timeMode = mode
      if (mode === 'absolute') {
        vi.startTimeMs = new Date(absoluteTimeMap.value[video.id].replace(' ', 'T')).getTime()
        vi.timeOffsetMs = undefined
      } else {
        vi.timeOffsetMs = hhmmssToMs(offsetTimeMap.value[video.id])
        vi.startTimeMs = undefined
      }
    }
    // 写入 schema
    pushVideoToSchema(vi)
    if (trackId) {
      associateVideoToTrack(trackId, vi.id, vi.timeOffsetMs || 0)
    }
    await saveSchema()

    // 生成视频节点（坐标来自 GPX 时间对应位置）或添加地图视频标记
    let nodeCount = 0
    if (trackId) {
      const nodes = await generateVideoNodes(vi)
      nodeCount = nodes.length
    } else if (vi.GPSLatitude && vi.GPSLongitude) {
      await markerService.addVideoMarkerToMap(vi)
    }
    nodesMap.value[video.id] = nodeCount
    video.imported = true
    ElMessage.success(isStandalone ? '导入成功' : `导入成功，生成 ${nodeCount} 个节点`)
  } catch (e) {
    console.error('导入失败', e)
    ElMessage.error('导入失败')
  } finally {
    importingMap.value[video.id] = false
  }
}

/**
 * @description: "HH:mm:ss" 转为毫秒（相对偏移量）
 */
function hhmmssToMs(str: string): number {
  const [h, m, s] = str.split(':').map(Number)
  return ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000
}

/**
 * @description: epoch 毫秒转 "YYYY-MM-DD HH:mm:ss"
 */
function msToDateTime(ms: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * @description: 毫秒偏移量转 "HH:mm:ss"
 */
function msToHhmmss(ms: number): string {
  if (!ms) return ''
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/**
 * @description: 移除待导入列表中的视频
 */
function handleRemove(videoId: string) {
  videoList.value = videoList.value.filter(v => v.id !== videoId)
  delete selectedTrackMap.value[videoId]
  delete timeModeMap.value[videoId]
  delete absoluteTimeMap.value[videoId]
  delete offsetTimeMap.value[videoId]
  delete manualGpsMap.value[videoId]
}

/**
 * @description: 格式化时长
 */
function formatDuration(ms: number | undefined): string {
  if (!ms) return '时长未知'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * @description: 关闭弹窗前检查
 */
async function handleBeforeClose(done: () => void) {
  const hasUnimported = videoList.value.some(v => !v.imported)
  if (hasUnimported) {
    try {
      await ElMessageBox.confirm('有未导入的视频，确定关闭吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      resetState()
      done()
    } catch {
      // 取消关闭
    }
  } else {
    resetState()
    done()
  }
}

function resetState() {
  videoList.value = []
  selectedTrackMap.value = {}
  timeModeMap.value = {}
  absoluteTimeMap.value = {}
  offsetTimeMap.value = {}
  manualGpsMap.value = {}
  parseProgress.value = { processed: 0, total: 0 }
}

// 事件监听
onUnmounted(() => {
  API.video.offVideosEvents()
})

// 注册事件（组件挂载时）
function registerEvents() {
  API.video.onVideosParsed((payload: any) => {
    const videos: ISelectedVideo[] = payload?.videos ?? []
    videos.forEach((v) => {
      if (!videoList.value.find(exist => exist.id === v.id)) {
        videoList.value.push({ ...v, imported: false })
        // 默认绝对时间模式，预填解析到的文件名时间
        timeModeMap.value[v.id] = 'absolute'
        if (v.parsedTimeText) {
          absoluteTimeMap.value[v.id] = v.parsedTimeText
        }
      }
    })
  })
  API.video.onVideosProgress((payload: any) => {
    parseProgress.value = {
      processed: payload?.processed ?? 0,
      total: payload?.total ?? 0
    }
  })
  API.video.onVideosDone(() => {
    isParsing.value = false
  })
}
registerEvents()
</script>

<style scoped>
.video-upload-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 40vh;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hint {
  font-size: 12px;
  color: #909399;
}

.progress {
  padding: 8px 0;
}

.video-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 55vh;
  overflow-y: auto;
}

.video-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}

.video-info {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  display: flex;
  gap: 12px;
}

.time-text.warn {
  color: #e6a23c;
}

.gps-badge {
  color: #67c23a;
  border: 1px solid #67c23a;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 1.4;
}

.manual-badge {
  color: #409eff;
  border: 1px solid #409eff;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 11px;
  line-height: 1.4;
}

.section {
  border-top: 1px solid #ebeef5;
  padding-top: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin: 0 0 8px;
}

.video-item.uploaded {
  background: #f8fafc;
  border-color: #d9e2ec;
}

.track-name {
  color: #409eff;
}

.mode-text {
  color: #909399;
}

.edit-form {
  padding: 4px 8px;
}

.edit-body {
  display: flex;
  gap: 16px;
}

.edit-left {
  flex: 1;
  min-width: 300px;
}

.edit-right {
  flex: 1;
  min-width: 280px;
}

.preview-map {
  width: 100%;
  height: 300px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.track-time-range {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  width: 100%;
}

.preview-node-count {
  color: #67c23a;
  font-weight: 500;
}

.player-container {
  width: 100%;
  height: 60vh;
}

.edit-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  margin-bottom: 16px;
}

.node-text {
  color: #67c23a;
}

.video-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.track-select {
  width: 180px;
}

.mode-select {
  width: 100px;
}
</style>
