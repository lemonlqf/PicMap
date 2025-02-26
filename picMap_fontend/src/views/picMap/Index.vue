<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 10:02:23
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-25 21:46:25
 * @FilePath: \Code\picMap_fontend\src\views\picMap\Index.vue
 * @Description: 
-->
<template>
  <div id="map"></div>
  <div class="fix-group switch-group">
    <template v-for="item in appMapTile" :key="item.name">
      <el-button @click="changeMapTile(item)">{{ item.name }}</el-button>
    </template>
    <el-button @click="setMapCenter">初始中心</el-button>
  </div>
  <div class="fix-group upload-group">
    <ImageUpolad :map="map"></ImageUpolad>
  </div>
  <Drawer></Drawer>
  <contentMenu :map="map"></contentMenu>
  <div class="fix-group group-info-group">
    <GroupInfo :map="map"></GroupInfo>
  </div>
</template>

<script setup>
import { onBeforeMount, onMounted, ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ImageUpolad from '@/components/imgUpload/Index.vue'
import Drawer from '@/components/drawer/Index.vue'
import contentMenu from '@/components/contentMenu/Index.vue'
import GroupInfo from '@/components/groupInfo/Index.vue'
import appMapTile from './appMapTile'
// 直接引用API可能还没有解析完成，所以在这里还是直接引入模块内的接口
import schemaHttp from '@/http/modules/schema'
import { useSchemaStore } from '@/store/schema'
import {
  addImageIconToMap,
  addGroupIconToMap,
  observeMapChangeToUpgradeMarker,
  updateVisibleMarkers,
  hiddenImageInfoDrawerMapClick,
  setView
} from '@/utils/map.js'
import { getGroupAndImageList, getAllImageIdInSchema, saveSchema } from '@/utils/schema.js'
import eventBus from '@/utils/eventBus'
import { useMapStore } from '../../store/map'

const schemaStore = useSchemaStore()
const currentMapTile = ref(appMapTile[0])
const map = ref(null)
const mapCenter = ref([30.2489634, 120.2052342])

function changeMapTile(item) {
  currentMapTile.value = item
  initTile()
}

/**
 * @description: 获取地图的schema
 * @return {*}
 */
async function initSchema() {
  const res = await schemaHttp.getSchema()
  if (res.code === 200) {
    const schema = JSON.parse(res.data)
    // 将schema信息保存到store中
    schemaStore.setSchema(JSON.parse(res.data))
    mapCenter.value = schema.mapInfo?.center
    const imagesId = getAllImageIdInSchema()
    // 将所有的图片id保存到uploadedImageIds中
    schemaStore.setUploadedImageIds(imagesId)
    initMarker()
  } else {
    console.error('获取schema失败')
  }
}

// 设置坐标
watch(() => mapCenter.value, (newVal) => {
  if (map.value) {
    setView(newVal[0], newVal[1], map.value)
  }
})

/**
 * @description: 初始化地图
 * @return {*}
 */
function initMap() {
  const mapStore = useMapStore()
  map.value = L.map('map', {
    zoom: 15, //初始缩放，因为在下文写了展示全地图，所以这里不设置，也可以设置
    minZoom: 3,
    maxZoom: 18,
    zoomControl: true, //缩放组件
    attributionControl: false //去掉右下角logol
  })
}

async function setMapCenter() {
  const { lat, lng } = map.value.getCenter()
  if (lat && lng) {
    schemaStore.setMapAttr('center', [lat, lng])
  }
  const res = await saveSchema()
  if (res.code === 200) {
    ElMessage.success('设置成功！')
    // 上传完成后，点击右键可以出现操作菜单
  }
}

const currentTileLayer = ref()

/**
 * @description: 初始化地图瓦片
 * @return {*}
 */
function initTile() {
  // 移除旧的图层
  if (currentTileLayer.value) {
    map.value.removeLayer(currentTileLayer.value)
  }
  currentTileLayer.value = L.tileLayer(`${currentMapTile.value.url}`, {
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
  observeMapChangeToUpgradeMarker(map.value)
  hiddenImageInfoDrawerMapClick(map.value)
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

.group-info-group {
  top: 100px;
  right: 15px;
}
</style>
