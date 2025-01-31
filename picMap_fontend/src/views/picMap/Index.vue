<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 10:02:23
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-31 21:37:44
 * @FilePath: \Code\picMap_fontend\src\views\picMap\Index.vue
 * @Description: 
-->
<template>
  <div id="map"></div>
  <div class="fix-group switch-group">
    <template v-for="item in appMapTile" :key="item.name">
      <el-button @click="changeMapTile(item)">{{ item.name }}</el-button>
    </template>
  </div>
  <div class="fix-group upload-group">
    <ImageUpolad :map="map"></ImageUpolad>
  </div>
</template>

<script setup>
import { onBeforeMount, onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ImageUpolad from '@/components/imgUpload/Index.vue'
import appMapTile from './appMapTile'
// 直接引用API可能还没有解析完成，所以在这里还是直接引入模块内的接口
import schemaHttp from '@/http/modules/schema'
import { useSchemaStore } from '@/store/schema'
import {
  addImageIconToMap,
  addGroupIconToMap,
  observeMapMoveToUpgradeMarker,
  updateVisibleMarkers
} from '@/utils/map.js'
import { getGroupAndImageList } from '@/utils/schema.js'
const schemaStore = useSchemaStore()
const currentMapTile = ref(appMapTile[0])

function changeMapTile(item) {
  currentMapTile.value = item
  initTile()
}

const map = ref()

/**
 * @description: 获取地图的schema
 * @return {*}
 */
async function initSchema() {
  const res = await schemaHttp.getSchema()
  if (res.code === 200) {
    // 将schema信息保存到store中
    schemaStore.setSchema(JSON.parse(res.data))
    initMarker()
  } else {
    console.error('获取schema失败')
  }
}

/**
 * @description: 初始化地图
 * @return {*}
 */
function initMap() {
  map.value = L.map('map', {
    center: [30.2489634, 120.2052342], //中心坐标
    zoom: 12, //初始缩放，因为在下文写了展示全地图，所以这里不设置，也可以设置
    minZoom: 3,
    maxZoom: 18,
    zoomControl: true, //缩放组件
    attributionControl: false //去掉右下角logol
  })
}

/**
 * @description: 初始化地图瓦片
 * @return {*}
 */
function initTile() {
  L.tileLayer(`${currentMapTile.value.url}`, {
    attribution: '&copy; <p>OpenStreetMap</p> contributors'
  }).addTo(map.value)
}

/**
 * @description: 初始化标记
 * @return {*}
 */
function initMarker() {
  const groupAndImageList = getGroupAndImageList()
  if (groupAndImageList?.length) {
    groupAndImageList.forEach(item => {
      if (item.type === 'group') {
        addGroupIconToMap(map.value, item)
      } else if (item.type === 'image') {
        addImageIconToMap(map.value, item)
      }
    })
  }
}

onBeforeMount(() => {
  initSchema()
})

onMounted(() => {
  initMap()
  initTile()
  initMarker()
  observeMapMoveToUpgradeMarker(map.value)
  setTimeout(() => {
    updateVisibleMarkers(map.value)
  }, 300)
})
</script>

<style lang="scss" scoped>
#map {
  height: 100vh;
  width: 100vw;
}

.fix-group {
  position: fixed;
  z-index: 1000;
}

.switch-group {
  top: 10px;
  right: 10px;
}

.upload-group {
  top: 100px;
  left: 10px;
}
</style>
