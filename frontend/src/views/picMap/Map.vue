<template>
  <div class="map-wrap">
    <div id="map"></div>
    <!-- 俯仰角调节（随纯净模式淡入淡出，与其他开关一致） -->
    <div :class="['pitch-control', pitchClass]">
      <span class="pitch-label">俯仰角: {{ pitch }}°</span>
      <input type="range" min="0" max="60" v-model.number="pitch" @input="setPitch" />
    </div>
    <!-- 轨迹详情面板（复用现有详情面板） -->
    <TrackDetailPanel :visible="detailPanelVisible" :trackList="detailPanelTrackList"
      :currentTrackId="detailPanelTrackId" :trackInfo="detailPanelTrackInfo"
      @update:visible="detailPanelVisible = $event"
      @video-focus="handleVideoFocus" />
    <!-- 视频播放弹窗（点击视频节点弹出） -->
    <VideoPlayDialog v-model:visible="videoPlayVisible" :video-id="videoPlayId" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { PropType } from 'vue'
import * as maplibregl from 'maplibre-gl'
import type { ITileOverlay } from '@/type/appSchema'
import mapService from '@/services/map'
import { useMapStore } from '../../store/map'
import markerService from '@/services/marker'
import { initBoxSelect } from '@/services/boxSelect'
import { getGroupAndImageList } from '@/utils/schema'
import { useSchemaStore } from '@/store/schema'
import { hiddenImageInfoDrawerMapClick } from '@/utils/map'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_CONSTANT, OVERLAY_LAYER_PREFIX, OVERLAY_SOURCE_PREFIX } from '@/utils/constant'
import { toMapLibreLngLat } from '@/utils/mapLibre'
import trackService from '@/services/track'
import API from '@/wails/api'
import { fetchTrackPoints, extractSegmentCoords, getVideoColor, resolveVideoSegmentAtPoint, VIDEO_SEG_LINE_WIDTH, VIDEO_SEG_LINE_OPACITY } from '@/utils/videoNode'
import eventBus from '@/utils/eventBus'
import TrackDetailPanel from '@/components/trackDetail/TrackDetailPanel.vue'
import VideoPlayDialog from '@/components/videoPlayer/VideoPlayDialog.vue'

const props = defineProps({
  // 瓦片信息
  tileLayer: {
    type: Object,
    default: null
  },
  // 当前瓦片的叠加层（路网标注等）
  tileOverlays: {
    type: Array as PropType<ITileOverlay[]>,
    default: () => []
  },
  // 是否展示叠加层
  showTileOverlays: {
    type: Boolean,
    default: false
  },
  // 图片或者组件id
  idList: {
    type: Array,
    default: () => []
  },
  mapZoom: {
    type: Number,
    default: DEFAULT_ZOOM
  },
  mapCenter: {
    type: Array as () => number[],
    default: () => DEFAULT_CENTER
  },
  mapPitch: {
    type: Number,
    default: 0
  },
  mapBearing: {
    type: Number,
    default: 0
  },
  // 俯仰角控件的动画 class（与其他开关一致：纯净模式下淡出并禁用指针）
  pitchClass: {
    type: String,
    default: ''
  }
})

let map: maplibregl.Map | null = null
const pitch = ref(props.mapPitch)

// 轨迹详情面板状态
const detailPanelVisible = ref(false)
const detailPanelTrackId = ref('')
const detailPanelTrackInfo = ref<any>(null)
const detailPanelTrackList = ref<any[]>([])
let currentSelectedInstance: any = null

// 视频播放弹窗状态
const videoPlayVisible = ref(false)
const videoPlayId = ref('')
let videoPlayBound = false
let trackPanelCloseBound = false

/**
 * @description: 初始化地图
 * @return {*}
 */
function initMap() {
  if (!map) {
    // 同步滑块显示为恢复的俯仰角
    pitch.value = props.mapPitch
    map = new maplibregl.Map({
      container: 'map',
      style: { version: 8, sources: {}, layers: [] },
      center: toMapLibreLngLat(props.mapCenter[0], props.mapCenter[1]),
      zoom: props.mapZoom,
      minZoom: MAP_CONSTANT.MIN_ZOOM,
      maxZoom: MAP_CONSTANT.MAX_ZOOM,
      pitch: props.mapPitch,
      bearing: props.mapBearing,
      attributionControl: false,
    })
    mapService.initMapInstance(map)
    // 框选：Ctrl + 左键拖拽（原生事件 + 自绘矩形，preventDefault 阻止旋转/平移）
    initBoxSelect()
    // style 异步加载完成后再初始化瓦片与标记、轨迹
    map.on('load', () => {
      mapLoaded = true
      initTile()
      initMarker()
      renderMainMapTracks()
      syncTileOverlays()
    })
    // 监听地图 pitch 变化（鼠标旋转/手势），同步滑块显示
    map.on('pitch', () => {
      pitch.value = Math.round(map!.getPitch())
    })
  } else {
    map.jumpTo({
      center: toMapLibreLngLat(props.mapCenter[0], props.mapCenter[1]),
      zoom: props.mapZoom,
    })
  }
}

function setPitch() {
  map?.setPitch(pitch.value)
}

// 保存当前瓦片 url，避免重复添加
let currentTileUrl: string | null = null
// style 是否已加载完成
let mapLoaded = false

/**
 * @description: 初始化地图瓦片
 * @return {*}
 */
function initTile() {
  if (!map || !mapLoaded) return
  const url = props.tileLayer?.url
  if (!url) return
  if (currentTileUrl === url) return
  if (map.getLayer('tile-layer')) map.removeLayer('tile-layer')
  if (map.getSource('tile')) map.removeSource('tile')
  map.addSource('tile', { type: 'raster', tiles: [url], tileSize: 256, maxzoom: MAP_CONSTANT.MAX_ZOOM })
  // 底图必须始终置于最底层：插入到当前第一个已存在图层之前，
  // 否则 addLayer 默认置顶会让底图/叠加层盖住轨迹线
  const bottomLayerId = map.getStyle().layers?.[0]?.id
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' }, bottomLayerId)
  currentTileUrl = url
  // 底图重新入栈后同步叠加层层级（叠加层置于底图之上、业务图层之下）
  syncTileOverlays()
}

// 清理所有叠加层（路网标注等）
function clearTileOverlays() {
  if (!map || !mapLoaded) return
  const mapInst = map
  let i = 0
  while (mapInst.getLayer(`${OVERLAY_LAYER_PREFIX}${i}`) || mapInst.getSource(`${OVERLAY_SOURCE_PREFIX}${i}`)) {
    if (mapInst.getLayer(`${OVERLAY_LAYER_PREFIX}${i}`)) mapInst.removeLayer(`${OVERLAY_LAYER_PREFIX}${i}`)
    if (mapInst.getSource(`${OVERLAY_SOURCE_PREFIX}${i}`)) mapInst.removeSource(`${OVERLAY_SOURCE_PREFIX}${i}`)
    i++
  }
}

// 在底图之上、其他业务图层（轨迹/标记等）之下渲染叠加层（raster 图层）
function renderTileOverlays(overlays: ITileOverlay[]) {
  if (!map || !mapLoaded) return
  const mapInst = map
  clearTileOverlays()
  if (!overlays || !overlays.length) return
  // 找到第一个既非底图也非叠加层的图层作为插入基准，保证叠加层不盖住轨迹线
  const beforeId = mapInst.getStyle().layers?.find(
    (layer: any) => layer.id !== 'tile-layer' &&
      !layer.id.startsWith(OVERLAY_LAYER_PREFIX)
  )?.id
  overlays.forEach((ov, i) => {
    if (!ov?.url) return
    const srcId = `${OVERLAY_SOURCE_PREFIX}${i}`
    const layerId = `${OVERLAY_LAYER_PREFIX}${i}`
    if (mapInst.getSource(srcId)) return
    mapInst.addSource(srcId, { type: 'raster', tiles: [ov.url], tileSize: 256, maxzoom: MAP_CONSTANT.MAX_ZOOM })
    mapInst.addLayer({ id: layerId, type: 'raster', source: srcId }, beforeId)
  })
}

// 依据 props（叠加层列表 + 开关）同步渲染/清理叠加层
function syncTileOverlays() {
  if (props.showTileOverlays && props.tileOverlays?.length) {
    renderTileOverlays(props.tileOverlays)
  } else {
    clearTileOverlays()
  }
}

// 叠加层配置或开关变化时同步
watch(
  () => [props.tileOverlays, props.showTileOverlays],
  () => {
    syncTileOverlays()
  },
  { deep: true }
)

/**
 * @description: 初始化标记
 * @return {*}
 */
async function initMarker() {
  removeAllMarkers()
  const groupAndImageList = getGroupAndImageList()
  if (groupAndImageList?.length) {
    groupAndImageList.forEach(item => {
      if (item.showType === 'group') {
        markerService.addGroupMarkerToMap(item)
      } else if (item.showType === 'image') {
        markerService.addImageMarkerToMap(item)
      }
    })
  }
  // 有坐标的视频在地图上显示为视频标记（封面为第一帧）
  // 已加入分组的视频不在地图上单独显示（与图片一致）
  const schemaStore = useSchemaStore()
  const videoInfo = schemaStore.getSchema.videoInfo || []
  const videoIdInGroup: string[] = []
  ;(schemaStore.getSchema.groupInfo || []).forEach(group => {
    group.videoNumbers && videoIdInGroup.push(...group.videoNumbers)
  })
  for (const video of videoInfo) {
    if (video.GPSLatitude && video.GPSLongitude && !videoIdInGroup.includes(video.id)) {
      await markerService.addVideoMarkerToMap(video)
    }
  }
}

/**
 * @description: 移除所有marker
 * @return {*}
 */
function removeAllMarkers() {
  const mapStore = useMapStore()
  const markerClusters = markerService.getMarkerClusters()
  markerClusters && markerClusters.clearLayers()
  mapStore.init()
}

/**
 * @description: 为指定轨迹绑定主地图上的点击（展示信息）与右键（移除菜单）交互
 * @param {*} instance - 轨迹实例
 * @param {maplibregl.Map} mainMap - 主地图实例
 * @return {*}
 */
function bindTrackInteractions(instance: any, mainMap: maplibregl.Map) {
  const trackId = instance.getTrackId()
  instance.setClickCallback(mainMap, (info: any, e?: any) => {
    const normalizedId = trackId.replace(/\.gpx$/i, '')
    const instanceId = `${normalizedId}_main`
    if (currentSelectedInstance && currentSelectedInstance !== instance) {
      currentSelectedInstance.unhighlight()
    }
    instance.highlight(mainMap, instanceId)
    currentSelectedInstance = instance
    detailPanelTrackId.value = instanceId
    detailPanelTrackInfo.value = { instanceId, id: trackId, instance, ...info }
    detailPanelVisible.value = true

    // 点击位置若落在轨迹关联视频的弧段上，高亮该弧段并滚动对应标签到可视区
    if (e?.lngLat) {
      focusVideoSegmentAtPoint(trackId, e.lngLat)
    }
  })
  instance.setContextMenuCallback(mainMap, (_info: any, e: any) => {
    // 构造兼容 contentMenu 的事件结构
    const menuEvent = {
      target: { options: { id: trackId, type: 'track' } },
      originalEvent: { x: e?.originalEvent?.clientX ?? e?.point?.x ?? 0, y: e?.originalEvent?.clientY ?? e?.point?.y ?? 0 },
    }
    eventBus.emit('show-content-menu', menuEvent)
  })
}

/**
 * @description: 根据点击位置判断命中的视频弧段，高亮并滚动对应视频标签到可视区
 * @param {string} trackId - 轨迹 ID
 * @param {{lng:number,lat:number}} lngLat - 点击位置（GCJ02）
 */
async function focusVideoSegmentAtPoint(trackId: string, lngLat: { lng: number; lat: number }) {
  const normalize = (id: string) => String(id).replace(/\.gpx$/i, '').toLowerCase()
  const schemaStore = useSchemaStore()
  const trackSchema = (schemaStore.getSchema.trackInfo || []).find(
    (t: any) => normalize(t.id) === normalize(trackId)
  )
  const videos = trackSchema?.videos || []
  if (videos.length === 0) return
  const gpx = await fetchTrackPoints(trackId)
  const hit = resolveVideoSegmentAtPoint(
    gpx || [],
    videos,
    schemaStore.getSchema.videoInfo || [],
    lngLat
  )
  if (!hit) return
  drawVideoSegmentHighlight(hit.color, hit.segCoords)
  eventBus.emit('video-tag-scroll-to', { trackId, videoId: hit.videoId })
}

/**
 * @description: 收集"显示在主地图"的轨迹 id 集合（原始 id 与去 .gpx 后缀的规范化 id）
 * 一次构建，供渲染与详情列表复用，避免重复遍历与 O(n²) 匹配
 */
function getShowOnMainMapIdSets() {
  const schemaStore = useSchemaStore()
  const trackInfoList = schemaStore.getSchema.trackInfo || []
  const rawSet = new Set<string>()
  const normalizedSet = new Set<string>()
  trackInfoList.forEach((t: any) => {
    if (!t.setting?.showOnMainMap) return
    rawSet.add(t.id)
    normalizedSet.add(String(t.id).replace(/\.gpx$/i, '').toLowerCase())
  })
  return { rawSet, normalizedSet }
}

/**
 * @description: 判断轨迹实例是否属于"显示在主地图"目标集合（O(1)）
 */
function isShowOnMainMapTrack(
  trackId: string,
  sets: { rawSet: Set<string>; normalizedSet: Set<string> }
): boolean {
  if (sets.rawSet.has(trackId)) return true
  return sets.normalizedSet.has(String(trackId).replace(/\.gpx$/i, '').toLowerCase())
}

/**
 * @description: 渲染主地图上开启"显示在主地图"的轨迹
 * 遍历 schema.trackInfo，对 showOnMainMap 为 true 的轨迹 addMap 显示，已关闭的 removeMap 隐藏
 * @return {*}
 */
function renderMainMapTracks() {
  if (!map) return
  const mainMap = map
  const targetSets = getShowOnMainMapIdSets()
  trackService.getInstances().forEach((instance) => {
    if (!isShowOnMainMapTrack(instance.getTrackId(), targetSets)) {
      instance.removeMap(mainMap)
    }
  })
  const pending: Promise<void>[] = []
  targetSets.rawSet.forEach((trackId) => {
    const existing = trackService.getTrackInstanceById(trackId) ||
      trackService.getTrackInstanceById(`${trackId}.gpx`)
    if (existing) {
      existing.addMap(mainMap)
      bindTrackInteractions(existing, mainMap)
      return
    }
    // 实例不存在时从后端加载
    pending.push(API.track.getTrack(trackId).then((res: any) => {
      const payload = res?.data?.code !== undefined ? res.data : res
      const fileContent = payload?.data?.fileContent || payload?.fileContent
      if (!fileContent) return
      const fileName = trackId.includes('.gpx') ? trackId : `${trackId}.gpx`
      const file = new File([new Blob([fileContent], { type: 'application/gpx+xml' })], fileName, {
        type: 'application/gpx+xml'
      })
      const instance = trackService.activeTrack(file)
      instance.addMap(mainMap)
      bindTrackInteractions(instance, mainMap)
    }).catch(() => { /* 单条加载失败不影响其余轨迹 */ }))
  })
  // 所有异步加载完成后统一更新一次详情列表，避免每加载一条就全量遍历一次
  if (pending.length) {
    Promise.all(pending).then(() => updateDetailTrackList())
  }
  updateDetailTrackList()
}

/**
 * @description: 同步主地图详情面板的轨迹列表（用于详情面板头部切换轨迹）
 * @return {*}
 */
function updateDetailTrackList() {
  if (!map) return
  const targetSets = getShowOnMainMapIdSets()
  const list: any[] = []
  trackService.getInstances().forEach((instance) => {
    const id = instance.getTrackId()
    if (!isShowOnMainMapTrack(id, targetSets)) return
    const normalizedId = id.replace(/\.gpx$/i, '')
    const info = instance.getTrackInfo()
    list.push({ instanceId: `${normalizedId}_main`, id, instance, ...info })
  })
  detailPanelTrackList.value = list
  if (!detailPanelTrackList.value.some((t) => t.instanceId === detailPanelTrackId.value)) {
    detailPanelVisible.value = false
    detailPanelTrackId.value = ''
    detailPanelTrackInfo.value = null
  }
}

/**
 * @description: 处理详情面板轨迹切换（高亮切换）
 * @param {string} instanceId - 轨迹实例ID
 * @return {*}
 */
function handleTrackChange(instanceId: string) {
  const track = detailPanelTrackList.value.find((t) => t.instanceId === instanceId)
  if (track) {
    if (currentSelectedInstance && currentSelectedInstance !== track.instance) {
      currentSelectedInstance.unhighlight()
    }
    if (track.instance && map) {
      track.instance.highlight(map, instanceId)
      currentSelectedInstance = track.instance
    }
    detailPanelTrackId.value = instanceId
    detailPanelTrackInfo.value = track
    const bounds = track.instance?.getBounds?.()
    if (map && bounds) {
      map.fitBounds(bounds as any, { padding: 60, duration: 500 })
    }
  }
}

/**
 * @description: 点击轨迹绑定视频 → 聚焦并高亮其所属轨迹（聚焦到视频在轨迹上对应的弧段，与"对齐视频"效果一致）
 * @param {string} videoId - 视频ID
 * @param {string} instanceId - 视频所属轨迹的实例ID
 * @return {*}
 */
async function handleVideoFocus(videoId: string, instanceId: string) {
  handleTrackChange(instanceId)
  if (!map) return
  // 优先从轨迹列表取，找不到时回退到当前详情面板的轨迹信息（异步加载的轨迹可能不在列表里）
  const track =
    detailPanelTrackList.value.find((t) => t.instanceId === instanceId) ??
    (detailPanelTrackInfo.value?.instanceId === instanceId ? detailPanelTrackInfo.value : undefined)
  const trackId = track?.id
  if (!trackId) return
  const gpx = await fetchTrackPoints(trackId)
  const normalize = (id: string) => String(id).replace(/\.gpx$/i, '').toLowerCase()
  const schemaStore = useSchemaStore()
  const trackSchema = (schemaStore.getSchema.trackInfo || []).find(
    (t: any) => normalize(t.id) === normalize(trackId)
  )
  const videos = trackSchema?.videos || []
  const refIndex = videos.findIndex((v: any) => v.videoId === videoId)
  const ref = refIndex >= 0 ? videos[refIndex] : undefined
  const durationMs = (schemaStore.getSchema.videoInfo || []).find((v) => v.id === videoId)?.durationMs || 0
  const segCoords = extractSegmentCoords(gpx || [], ref?.timeOffsetMs ?? 0, durationMs)
  if (segCoords.length >= 2) {
    drawVideoSegmentHighlight(getVideoColor(refIndex), segCoords)
    map.fitBounds(
      segCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(segCoords[0], segCoords[0])) as any,
      { padding: 60, duration: 500, maxZoom: 17 }
    )
    eventBus.emit('video-tag-scroll-to', { trackId, videoId })
  }
}

// 视频弧段高亮图层固定 id（与对齐视频界面配色一致）；加 main 前缀避免与全屏地图同名冲突
const VIDEO_SEG_SOURCE = 'video-seg-highlight-source-main'
const VIDEO_SEG_LAYER = 'video-seg-highlight-layer-main'

/**
 * @description: 在地图上用指定颜色高亮绘制视频对应的弧段（覆盖上一次的高亮）
 * @param {string} color - 视频配色（与对齐视频界面一致）
 * @param {[number, number][]} coords - GCJ02 弧段坐标
 */
function drawVideoSegmentHighlight(color: string, coords: [number, number][]) {
  if (!map) return
  if (map.getLayer(VIDEO_SEG_LAYER)) map.removeLayer(VIDEO_SEG_LAYER)
  if (map.getSource(VIDEO_SEG_SOURCE)) map.removeSource(VIDEO_SEG_SOURCE)
  map.addSource(VIDEO_SEG_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
  })
  map.addLayer({
    id: VIDEO_SEG_LAYER,
    type: 'line',
    source: VIDEO_SEG_SOURCE,
    paint: { 'line-color': color, 'line-width': VIDEO_SEG_LINE_WIDTH, 'line-opacity': VIDEO_SEG_LINE_OPACITY },
  })
}

/**
 * @description: 清除视频弧段高亮图层
 */
function clearVideoSegmentHighlight() {
  if (!map) return
  if (map.getLayer(VIDEO_SEG_LAYER)) map.removeLayer(VIDEO_SEG_LAYER)
  if (map.getSource(VIDEO_SEG_SOURCE)) map.removeSource(VIDEO_SEG_SOURCE)
}

// 监听详情面板关闭，取消高亮
watch(detailPanelVisible, (newVal) => {
  if (!newVal) {
    clearVideoSegmentHighlight()
    if (currentSelectedInstance) {
      currentSelectedInstance.unhighlight()
      currentSelectedInstance = null
    }
  }
})

/**
 * @description: 地图实例获取接口，提供给外部调用
 * @return {*}
 */
function getMapInstance() {
  return map
}

/**
 * @description: 判断点击点是否命中主地图上的任意轨迹图层
 * 用于区分点击轨迹（不关闭详情）与点击空白/其他节点（关闭详情）
 * @param {*} e - MapLibre 地图点击事件
 * @return {boolean}
 */
function isClickOnTrack(e: any): boolean {
  if (!map) return false
  const mainMap = map
  // 点击轨迹起终点标记：等同点击轨迹线，不关闭详情
  const target = e?.originalEvent?.target as HTMLElement | null
  if (target && (target.closest('.track-marker-start') || target.closest('.track-marker-end'))) {
    return true
  }
  const layerIds: string[] = []
  trackService.getInstances().forEach((instance) => {
    const ref = instance.getTrackLayer(mainMap)
    if (ref) {
      if (ref.hitLayerId && mainMap.getLayer(ref.hitLayerId)) layerIds.push(ref.hitLayerId)
      if (mainMap.getLayer(ref.layerId)) layerIds.push(ref.layerId)
    }
  })
  if (layerIds.length === 0) return false
  const features = mainMap.queryRenderedFeatures(e.point, { layers: layerIds })
  return features.length > 0
}

/**
 * @description: 点击地图空白或节点时关闭轨迹详情面板（与图片详情交互一致）
 * 点击空白：监听 map click（轨迹图层命中时不关闭）
 * 点击图片/分组/视频节点：节点点击会阻止地图 click，通过 show-image-data 事件关闭
 * @return {*}
 */
function closeTrackPanelOnMapClick() {
  if (!map || trackPanelCloseBound) return
  trackPanelCloseBound = true
  map.on('click', (e: any) => {
    // 点击轨迹线本身不关闭详情
    if (isClickOnTrack(e)) return
    detailPanelVisible.value = false
  })
  // 点击其他图片/分组/视频节点时关闭轨迹详情面板
  eventBus.on('show-image-data', () => {
    detailPanelVisible.value = false
  })
}

/**
 * @description: 点击视频节点 → 弹出视频播放弹窗（事件由 marker.ts 发出）
 */
function bindVideoPlayDialog() {
  if (videoPlayBound) return
  videoPlayBound = true
  eventBus.on('show-video-play', (payload: { videoId: string }) => {
    videoPlayId.value = payload.videoId
    videoPlayVisible.value = true
  })
}

/**
 * @description: 地图初始化
 * @return {*}
 */
async function init() {
  const isFirstInit = !map
  initMap()
  mapService.observeMapChangeToUpgradeMarker()
  hiddenImageInfoDrawerMapClick()
  closeTrackPanelOnMapClick()
  bindVideoPlayDialog()
  markerService.observeClisterClick()
  // 注册主地图轨迹渲染回调，供轨迹开关变化时即时增删轨迹
  mapService.registerTrackRender(() => {
    renderMainMapTracks()
  })
  // 渲染主地图上开启"显示在主地图"的轨迹
  renderMainMapTracks()
  // 切换用户后重新加载 marker（首次初始化由 map load 回调处理）
  if (!isFirstInit && map) {
    markerService.reset()
    await initMarker()
  }
}

// 组件卸载时清理高亮、流动动画与地图实例，避免 rAF 与图层泄漏
onUnmounted(() => {
  clearVideoSegmentHighlight()
  if (currentSelectedInstance) {
    currentSelectedInstance.unhighlight()
    currentSelectedInstance = null
  }
  if (map) {
    trackService.deleteTracksInMap(map)
    map.remove()
    map = null
  }
})

/**
 * @description: 坐标系切换后全量重渲染：清空轨迹实例（坐标需按新坐标系重解析）并重建 marker 与轨迹
 */
async function reloadForCoordChange() {
  if (!map) return
  // 轨迹实例缓存了按旧坐标系解析的坐标，先彻底清空以便重新解析
  trackService.deleteAllTracks()
  detailPanelTrackList.value = []
  // 重建所有 marker（图片/分组/视频坐标按新坐标系重算）
  markerService.reset()
  await initMarker()
  renderMainMapTracks()
}

defineExpose({
  init,
  initTile,
  renderTileOverlays,
  clearTileOverlays,
  getMapInstance,
  reloadForCoordChange,
})
</script>

<style scoped>
.map-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
#map {
  height: 100vh;
  width: 100vw;
}
.pitch-control {
  position: absolute;
  left: 25px;
  bottom: 90px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 8px 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.pitch-label {
  font-size: 12px;
  color: #333;
}
.no-pointer-events {
  pointer-events: none;
}
</style>
