<template>
  <div id="map"></div>
</template>

<script setup lang="ts">
import { onBeforeMount, onMounted, ref, watch, nextTick, reactive } from 'vue'
import L from 'leaflet'
import mapService from '@/services/map'
import { useMapStore } from '../../store/map'
import markerService from '@/services/marker'
import { getGroupAndImageList, getAllImageIdInSchema, saveSchema, getAllGroupIdInSchema } from '@/utils/schema'
import {
  hiddenImageInfoDrawerMapClick,
} from '@/utils/map'

let map: L.map = null


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
    default: 10
  },
  mapCenter: {
    type: Array,
    default: () => [30.2489634, 120.2052342]
  }
})

/**
 * @description: 初始化地图
 * @return {*}
 */
async function initMap() {
  if (!map) {
    map = L.map('map', {
      zoom: props.mapZoom, //初始缩放，因为在下文写了展示全地图，所以这里不设置，也可以设置
      minZoom: 3,
      maxZoom: 18, // 目前小于18不显示了
      center: props.mapCenter,
      zoomControl: false, //缩放组件
      attributionControl: false //去掉右下角logol
    })
    // 把地图实例保存一下，其他地方可以用
    mapService.initMapInstance(map)
  } else {
    // 已经有值的话直接设置一下初始位置
    map.setView(props.mapCenter, props.mapZoom)
  }
}

// 保存一下瓦片图层的实例，方便后续切换瓦片图层时移除
let currentTileLayer: any = null

/**
 * @description: 初始化地图瓦片
 * @return {*}
 */
function initTile() {
  // 移除旧的图层
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer)
  }
  props.tileLayer?.url && (currentTileLayer = L.tileLayer(`${props.tileLayer?.url}`, {
    attribution: '&copy; <p>OpenStreetMap</p> contributors'
  })?.addTo?.(map))
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
  map.eachLayer((layer: L.layer) => {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
  // 清理store中的值
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
  // 监听簇点击
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