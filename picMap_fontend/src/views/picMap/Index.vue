<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 10:02:23
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-27 17:02:27
 * @FilePath: \PicMap\picMap_fontend\src\views\picMap\Index.vue
 * @Description: 首页
-->
<template>
  <div class="home-page">
   <!-- 地图 -->
    <Map :tileLayer="currentMapTile" :mapCenter="mapCenter" :mapZoom="mapZoom" ref="mapRef"></Map>
    <div :class="['fix-group switch-group', getAnimateClass('switch')]">
      <!-- 瓦片选择器 -->
      <MapSelector @changeMapTile="changeMapTile" v-model="currentMapTile"></MapSelector>
    </div>
    <div class="buttons">
      <el-button :icon="Reading" @click="switcPureMode" :title="$t('pureMode')" circle></el-button>
      <el-button :class="['button', getAnimateClass('location')]" :icon="MapLocation" @click="setMapCenter"
        :title="$t('initializationCenter')" circle></el-button>
      <el-button-group :class="['button', getAnimateClass('zoom')]">
        <el-button type="" :title="$t('zoomUpMap')" @click="zoomUp" :icon="Plus" round />
        <el-button type="" :title="$t('zoomDownMap')" @click="zoomDown" :icon="Minus" round />
      </el-button-group>
    </div>
    <!-- 用户 -->
    <User @changeUser="init" :class="['user', getAnimateClass('user')]"></User>

    <!-- 上传按钮 -->
    <div :class="['fix-group upload-group', getAnimateClass('upload')]">
      <!-- 图片上传组件 -->
      <ImageUpolad ref="imageUploadRef" :map="map"></ImageUpolad>
      <!-- 轨迹上传组件 -->
      <TrackUpload></TrackUpload>
    </div>
    <!-- 图片详情抽屉 -->
    <Drawer ref="drawerRef"></Drawer>
    <!-- 鼠标右键菜单 -->
    <contentMenu :map="map"></contentMenu>
    <!-- 分组信息 -->
    <div :class="['fix-group group-info-group', getAnimateClass('group')]">
      <GroupInfo :map="map"></GroupInfo>
    </div>
    <!-- 时间轴 -->
    <div :class="['time-line', getAnimateClass('timeline')]">
      <TimeLine ref="timeLineRef" @change="timeChange" :mode="TimeType.DAY" :data="timeLineData"></TimeLine>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeMount, onMounted, ref, watch, nextTick, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import 'leaflet/dist/leaflet.css'
import ImageUpolad from '@/components/imgUpload/Index.vue'
import TrackUpload from '@/components/trackUpload/index.vue'
import Drawer from '@/components/drawer/Index.vue'
import contentMenu from '@/components/contentMenu/Index.vue'
import GroupInfo from '@/components/groupInfo/Index.vue'
import MapSelector from '@/components/mapSelector/Index.vue'
import User from '@/components/user/User.vue'
// 直接引用API可能还没有解析完成，所以在这里还是直接引入模块内的接口
import schemaHttp from '@/http/modules/schema'
import { useSchemaStore } from '@/store/schema'
import { getGroupAndImageList, getAllImageIdInSchema, saveSchema, getAllGroupIdInSchema } from '@/utils/schema'
import { Plus, Minus, MapLocation, Reading } from '@element-plus/icons-vue'
import Map from './Map.vue'
import TimeLine from '@/components/timeLine/TimeLine.vue'
import markerService from '@/services/marker'
import { TimeType } from '@/utils/group'
import type { TimeLineDataPoint } from '@/type/map'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/utils/constant'

const schemaStore = useSchemaStore()
let currentMapTile = ref()
const mapCenter = ref(DEFAULT_CENTER)
const mapZoom = ref(DEFAULT_ZOOM)
const mapRef = ref()
const timeRanges = ref({
  min: new Date('2000-01-01').getTime(),
  max: new Date().getTime()
})

const timeLineRef = ref()
const minAndMaxTime = ref(timeRanges.value)
const timeLineData = ref<TimeLineDataPoint[]>([])

function timeChange(dataRange: { min: number; max: number }) {
  timeRanges.value = dataRange
  // console.log('父组件接收到时间范围了', timeRanges.value)
  // 根据时间范围过滤marker
  markerService.filterMarkersByTimeRange(timeRanges.value)
  // 请求一下可见marker的图片
  markerService.updateVisibleMarkers();
}

/**
 * @description: 切换地图瓦片
 * @return {*}
 */
function changeMapTile() {
  nextTick(() => {
    mapRef.value.initTile()
  })
}

const pureMode = ref(true)

const animateState = reactive<Record<string, string>>({
  switch: 'animate__fadeIn',
  location: 'animate__fadeIn',
  zoom: 'animate__fadeIn',
  user: 'animate__fadeIn',
  upload: 'animate__fadeIn',
  group: 'animate__fadeIn',
  timeline: 'animate__fadeIn'
})

watch(pureMode, (newVal) => {
  const animates = ['switch', 'location', 'zoom', 'user', 'upload', 'group', 'timeline']
  if (newVal) {
    animates.forEach(key => {
      animateState[key] = 'animate__animated  animate__fadeIn'
    })
    setTimeout(() => {
      animates.forEach(key => {
        animateState[key] = ''
      })
    }, 300)
  } else {
    animates.forEach(key => {
      animateState[key] = 'animate__animated animate__fadeOut no-pointer-events'
    })
  }
})

function getAnimateClass(key: string) {
  return animateState[key]
}

// 获取所有图片的时间数据，构造成时间轴组件需要的格式
function getAllImageTimeTimeLineData(): TimeLineDataPoint[] {
  const imageList = getGroupAndImageList()
  if (!imageList) return []
  // 提取所有图片的时间戳，并过滤掉没有时间戳的图片
  const times = imageList.map((item: any) => {
    return item?.authorInfo?.DateTime
  }).filter((time: any) => time)
  if (times.length === 0) return []
  const timeValueMap: Record<number, number> = {}
  // 如果有一样的时间戳，就把value加1，表示在这个时间点有多张图片
  times.forEach((time: string) => {
    const timestamp = new Date(time).getTime()
    if (timeValueMap[timestamp]) {
      timeValueMap[timestamp] += 1
    } else {
      timeValueMap[timestamp] = 1
    }
  })
  // 构造成时间轴组件需要的格式
  const timeLineData: TimeLineDataPoint[] = Object.keys(timeValueMap).map(key => {
    return {
      timestamp: Number(key),
      value: timeValueMap[Number(key)]
    }
  })
  return timeLineData
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
    mapCenter.value = schema.mapInfo?.center ?? DEFAULT_CENTER
    mapZoom.value = schema.mapInfo?.zoom ?? 10
    timeLineData.value = getAllImageTimeTimeLineData()
    const imagesIds = getAllImageIdInSchema()
    const groupIds = getAllGroupIdInSchema()
    // 将所有的图片id保存到uploadedImageIds中
    schemaStore.setUploadedImageIds([...imagesIds, ...groupIds])
  } else {
    console.error('获取schema失败')
  }
}

const map = ref()

/**
 * @description: 把地图实例保存到map中，方便后续操作
 * @return {*}
 */
function initMapInstance() {
  map.value = mapRef.value.getMapInstance()
}

async function setMapCenter() {
  const { lat, lng } = map.value.getCenter()
  const zoom = map.value.getZoom()
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
  const zoom = map.value.getZoom()
  map.value.setZoom(zoom + 1)
}

function zoomDown() {
  const zoom = map.value.getZoom()
  map.value.setZoom(zoom - 1)
}

function switcPureMode() {
  pureMode.value = !pureMode.value
}

const drawerRef = ref()
const imageUploadRef = ref()

async function init() {
  await initSchema()

  // 因为要先请求schema，然后再初始化，所以地图组件初始化放在这里执行
  mapRef.value.init()

  // 保存一下地图实例
  initMapInstance()
  // 隐藏抽屉
  drawerRef?.value?.drawerHidden()
  // 清空上传组件中的图片
  imageUploadRef.value.deleteAll()
}

onMounted(() => {
  init()
})
</script>

<style lang="scss" scoped>
.home-page {
  height: 100vh;
  width: 100vw; 
  position: relative; 
  overflow: hidden;
}

#map {
  height: 100vh;
  width: 100vw;
}

.buttons {
  position: absolute;
  left: 20px;
  top: 20px;
  z-index: 800;
}

.fix-group {
  position: fixed;
  z-index: 800;
}

.switch-group {
  top: 10px;
  right: 15px;
}

.upload-group {
  top: 70px;
  left: 10px;
  display: flex;
  gap: 10px;
}

.group-info-group {
  top: 125px;
  right: 15px;
  z-index: 800;
}

.button {
  margin-right: 15px;
}

.user {
  position: absolute;
  top: 17px;
  left: 225px;
  z-index: 801;
}

.time-line {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 50vw;
  box-sizing: border-box;
  z-index: 800;
}

.no-pointer-events {
  pointer-events: none;
}
</style>
