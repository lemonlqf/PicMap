<template>
  <div class="map-wrap">
    <div id="map"></div>
    <!-- 俯仰角调节 -->
    <div class="pitch-control">
      <span class="pitch-label">俯仰角: {{ pitch }}°</span>
      <input type="range" min="0" max="60" v-model.number="pitch" @input="setPitch" />
    </div>
    <!-- 轨迹详情面板（复用现有详情面板） -->
    <TrackDetailPanel :visible="detailPanelVisible" :trackList="detailPanelTrackList"
      :currentTrackId="detailPanelTrackId" :trackInfo="detailPanelTrackInfo"
      @update:visible="detailPanelVisible = $event" @track-change="handleTrackChange" />
    <!-- 视频播放弹窗（点击视频节点弹出） -->
    <VideoPlayDialog v-model:visible="videoPlayVisible" :video-id="videoPlayId" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
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
  map.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })
  currentTileUrl = url
  // 底图重新入栈后叠加层需置于其上（addLayer 默认置顶，重新加回底图会盖住叠加层）
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

// 在底图之上渲染叠加层（raster 图层，置于 tile-layer 之上）
function renderTileOverlays(overlays: ITileOverlay[]) {
  if (!map || !mapLoaded) return
  const mapInst = map
  clearTileOverlays()
  if (!overlays || !overlays.length) return
  overlays.forEach((ov, i) => {
    if (!ov?.url) return
    const srcId = `${OVERLAY_SOURCE_PREFIX}${i}`
    const layerId = `${OVERLAY_LAYER_PREFIX}${i}`
    if (mapInst.getSource(srcId)) return
    mapInst.addSource(srcId, { type: 'raster', tiles: [ov.url], tileSize: 256, maxzoom: MAP_CONSTANT.MAX_ZOOM })
    mapInst.addLayer({ id: layerId, type: 'raster', source: srcId })
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
  const schemaStore = useSchemaStore()
  const videoInfo = schemaStore.getSchema.videoInfo || []
  for (const video of videoInfo) {
    if (video.GPSLatitude && video.GPSLongitude) {
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
  instance.setClickCallback(mainMap, (info: any) => {
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
 * @description: 渲染主地图上开启"显示在主地图"的轨迹
 * 遍历 schema.trackInfo，对 showOnMainMap 为 true 的轨迹 addMap 显示，已关闭的 removeMap 隐藏
 * @return {*}
 */
function renderMainMapTracks() {
  if (!map) return
  const mainMap = map
  const schemaStore = useSchemaStore()
  const trackInfoList = schemaStore.getSchema.trackInfo || []
  const targetIds = new Set(
    trackInfoList
      .filter((t: any) => t.setting?.showOnMainMap)
      .map((t: any) => t.id)
  )
  trackService.getInstances().forEach((instance) => {
    const id = instance.getTrackId()
    const normalizedId = id.replace(/\.gpx$/i, '')
    const isTarget = targetIds.has(id) || targetIds.has(normalizedId) || Array.from(targetIds).some((tid: string) => tid.replace(/\.gpx$/i, '') === normalizedId)
    if (!isTarget) {
      instance.removeMap(mainMap)
    }
  })
  targetIds.forEach((trackId) => {
    const existing = trackService.getTrackInstanceById(trackId) ||
      trackService.getTrackInstanceById(`${trackId}.gpx`)
    if (existing) {
      existing.addMap(mainMap)
      bindTrackInteractions(existing, mainMap)
      return
    }
    // 实例不存在时从后端加载
    API.track.getTrack(trackId).then((res: any) => {
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
    })
  })
  updateDetailTrackList()
}

/**
 * @description: 同步主地图详情面板的轨迹列表（用于详情面板头部切换轨迹）
 * @return {*}
 */
function updateDetailTrackList() {
  if (!map) return
  const schemaStore = useSchemaStore()
  const trackInfoList = schemaStore.getSchema.trackInfo || []
  const targetIds = new Set(
    trackInfoList
      .filter((t: any) => t.setting?.showOnMainMap)
      .map((t: any) => t.id)
  )
  const list: any[] = []
  trackService.getInstances().forEach((instance) => {
    const id = instance.getTrackId()
    const normalizedId = id.replace(/\.gpx$/i, '')
    const isTarget = targetIds.has(id) || targetIds.has(normalizedId) || Array.from(targetIds).some((tid: string) => tid.replace(/\.gpx$/i, '') === normalizedId)
    if (!isTarget) return
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
  }
}

// 监听详情面板关闭，取消高亮
watch(detailPanelVisible, (newVal) => {
  if (!newVal && currentSelectedInstance) {
    currentSelectedInstance.unhighlight()
    currentSelectedInstance = null
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

defineExpose({
  init,
  initTile,
  renderTileOverlays,
  clearTileOverlays,
  getMapInstance,
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
</style>
