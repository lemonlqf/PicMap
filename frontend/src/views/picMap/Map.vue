<template>
  <div id="map"></div>
</template>

<script setup lang="ts">
import * as maplibregl from 'maplibre-gl'
import mapService from '@/services/map'
import { useMapStore } from '../../store/map'
import markerService from '@/services/marker'
import { getGroupAndImageList } from '@/utils/schema'
import { hiddenImageInfoDrawerMapClick } from '@/utils/map'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constant'
import { toMapLibreLngLat } from '@/utils/mapLibre'

let map: maplibregl.Map | null = null

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
  }
})

/**
 * @description: 初始化地图
 * @return {*}
 */
function initMap() {
  if (!map) {
    map = new maplibregl.Map({
      container: 'map',
      style: { version: 8, sources: {}, layers: [] },
      center: toMapLibreLngLat(props.mapCenter[0], props.mapCenter[1]),
      zoom: props.mapZoom,
      minZoom: 3,
      maxZoom: 18,
      pitch: 45,
      bearing: 0,
      attributionControl: false,
    })
    mapService.initMapInstance(map)
  } else {
    map.jumpTo({
      center: toMapLibreLngLat(props.mapCenter[0], props.mapCenter[1]),
      zoom: props.mapZoom,
    })
  }
}

// 保存当前瓦片 url，避免重复添加
let currentTileUrl: string | null = null

/**
 * @description: 初始化地图瓦片
 * @return {*}
 */
function initTile() {
  if (!map) return
  const url = props.tileLayer?.url
  if (!url) return
  if (currentTileUrl === url) return
  if (map.getLayer('tile-layer')) map.removeLayer('tile-layer')
  if (map.getSource('tile')) map.removeSource('tile')
  map.addSource('tile', { type: 'raster', tiles: [url], tileSize: 256 })
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
  initMap()
  initTile()
  initMarker()
  mapService.observeMapChangeToUpgradeMarker()
  hiddenImageInfoDrawerMapClick()
  markerService.observeClisterClick()
}

defineExpose({
  init,
  initTile,
  getMapInstance,
})
</script>

<style scoped>
#map {
  height: 100vh;
  width: 100vw;
}
</style>
