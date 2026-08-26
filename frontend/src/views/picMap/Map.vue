<template>
  <div class="map-wrap">
    <div id="map"></div>
    <!-- 俯仰角调节 -->
    <div class="pitch-control">
      <span class="pitch-label">俯仰角: {{ pitch }}°</span>
      <input type="range" min="0" max="60" v-model.number="pitch" @input="setPitch" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import * as maplibregl from 'maplibre-gl'
import mapService from '@/services/map'
import { useMapStore } from '../../store/map'
import markerService from '@/services/marker'
import { initBoxSelect } from '@/services/boxSelect'
import { getGroupAndImageList } from '@/utils/schema'
import { useSchemaStore } from '@/store/schema'
import { hiddenImageInfoDrawerMapClick } from '@/utils/map'
import { DEFAULT_CENTER, DEFAULT_ZOOM, MAP_CONSTANT } from '@/utils/constant'
import { toMapLibreLngLat } from '@/utils/mapLibre'
import trackService from '@/services/track'
import API from '@/wails/api'

const props = defineProps({
  // 瓦片信息
  tileLayer: {
    type: Object,
    default: null
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
    // style 异步加载完成后再初始化瓦片与标记
    map.on('load', () => {
      mapLoaded = true
      initTile()
      initMarker()
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
}

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
    })
  })
}

/**
 * @description: 地图实例获取接口，提供给外部调用
 * @return {*}
 */
function getMapInstance() {
  return map
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
