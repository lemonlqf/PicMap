<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 10:02:23
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 20:27:34
 * @FilePath: \Code\picMap_fontend\src\views\picMap\Index.vue
 * @Description: 
-->
<template>
  <div id="map"></div>
  <div v-show="!pureMode" class="fix-group switch-group">
    <MapSelector @changeMapTile="changeMapTile" v-model="currentMapTile"></MapSelector>
  </div>
  <div class="buttons">
    <el-button :icon="Reading" @click="switcPureMode" title="纯净模式" circle></el-button>
    <el-button v-show="!pureMode" class="button" :icon="MapLocation" @click="setMapCenter" title="初始化中心"
      circle></el-button>
    <el-button-group v-show="!pureMode" class="button">
      <el-button type="" title="放大地图" @click="zoomUp" :icon="Plus" round />
      <el-button type="" title="缩小地图" @click="zoomDown" :icon="Minus" round />
    </el-button-group>
  </div>
  <User v-show="!pureMode" class="user"></User>

  <!-- 上传按钮 -->
  <div v-show="!pureMode" class="fix-group upload-group">
    <ImageUpolad :map="map"></ImageUpolad>
  </div>
  <!-- 图片详情抽屉 -->
  <Drawer></Drawer>
  <!-- 鼠标右键菜单 -->
  <contentMenu :map="map"></contentMenu>
  <!-- 分组信息 -->
  <div v-show="!pureMode" class="fix-group group-info-group">
    <GroupInfo :map="map"></GroupInfo>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, onMounted, ref, watch, nextTick, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ImageUpolad from '@/components/imgUpload/Index.vue'
import Drawer from '@/components/drawer/Index.vue'
import contentMenu from '@/components/contentMenu/Index.vue'
import GroupInfo from '@/components/groupInfo/Index.vue'
import MapSelector from '@/components/mapSelector/Index.vue'
import User from '@/components/user/User.vue'
// 直接引用API可能还没有解析完成，所以在这里还是直接引入模块内的接口
import schemaHttp from '@/http/modules/schema'
import { useSchemaStore } from '@/store/schema'
import {
  addImageMarkerToMap,
  addGroupMarkerToMap,
  observeMapChangeToUpgradeMarker,
  updateVisibleMarkers,
  hiddenImageInfoDrawerMapClick,
  setViewByLatLng,
  MAX_ZOOM,
  MIN_ZOOM,
  observeClisterClick
} from '@/utils/map'
import { getGroupAndImageList, getAllImageIdInSchema, saveSchema, getAllGroupIdInSchema } from '@/utils/schema'
import eventBus from '@/utils/eventBus'
import { useMapStore } from '../../store/map'
import { MAP_INSTANCE, setMapInstance } from '@/utils/map'
import { Plus, Minus, MapLocation, Reading } from '@element-plus/icons-vue'

const schemaStore = useSchemaStore()
let currentMapTile = null
let map: L.map = null
const mapCenter = ref([30.2489634, 120.2052342])
const mapZoom = ref(10)

function changeMapTile() {
  initTile()
}

const pureMode = ref(false)

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
    mapCenter.value = schema.mapInfo?.center ?? [30.2489634, 120.2052342]
    mapZoom.value = schema.mapInfo?.zoom ?? 10
    const imagesIds = getAllImageIdInSchema()
    const groupIds = getAllGroupIdInSchema()
    // 将所有的图片id保存到uploadedImageIds中
    schemaStore.setUploadedImageIds([...imagesIds, ...groupIds])
  } else {
    console.error('获取schema失败')
  }
}

/**
 * @description: 初始化地图
 * @return {*}
 */
async function initMap() {
  const mapStore = useMapStore()
  map = L.map('map', {
    zoom: mapZoom.value, //初始缩放，因为在下文写了展示全地图，所以这里不设置，也可以设置
    minZoom: 3,
    maxZoom: 18, // 目前小于18不显示了
    center: mapCenter.value,
    zoomControl: false, //缩放组件
    attributionControl: false //去掉右下角logol
  })
  // 把地图实例保存一下，其他地方可以用
  setMapInstance(map)
}

async function setMapCenter() {
  const { lat, lng } = map.getCenter()
  const zoom = map.getZoom()
  if (lat && lng) {
    schemaStore.setMapAttr('center', [lat, lng])
    schemaStore.setMapAttr('zoom', zoom)
  }
  const res = await saveSchema()
  if (res.code === 200) {
    ElMessage.success('设置成功！')
    // 上传完成后，点击右键可以出现操作菜单
  }
}

function zoomUp() {
  const zoom = map.getZoom()
  map.setZoom(zoom + 1)
}

function zoomDown() {
  const zoom = map.getZoom()
  map.setZoom(zoom - 1)
}

function switcPureMode() {
  pureMode.value = !pureMode.value
}

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
  currentTileLayer = L.tileLayer(`${currentMapTile.url}`, {
    attribution: '&copy; <p>OpenStreetMap</p> contributors'
  }).addTo(map)
}

/**
 * @description: 初始化标记
 * @return {*}
 */
function initMarker() {
  const groupAndImageList = getGroupAndImageList()
  if (groupAndImageList?.length) {
    groupAndImageList.forEach(item => {
      if (item.showType === 'group') {
        addGroupMarkerToMap(item)
      } else if (item.showType === 'image') {
        addImageMarkerToMap(item)
      }
    })
  }
}

onBeforeMount(() => {
})

onMounted(async () => {
  await initSchema()
  initMap()
  initTile()
  initMarker()
  observeMapChangeToUpgradeMarker()
  hiddenImageInfoDrawerMapClick()
  // 监听簇点击
  observeClisterClick()
})
</script>

<style lang="scss" scoped>
#map {
  height: 100vh;
  width: 100vw;
}

.buttons {
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 1000;
}

.fix-group {
  position: fixed;
  z-index: 1000;
}

.switch-group {
  top: 10px;
  right: 15px;
}

.upload-group {
  top: 70px;
  left: 10px;
}

.group-info-group {
  top: 125px;
  right: 15px;
}

.button {
  margin-right: 15px;
}
.user {
  position: absolute;
  top: 17px;
  left: 225px;
  z-index: 1000;
}
</style>
