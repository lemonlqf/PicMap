<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 10:02:23
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-14 16:33:02
 * @FilePath: \picMap_fontend\src\views\picMap\index.vue
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
import { onMounted, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ImageUpolad from '@/components/imgUpload/Index.vue'
import appMapTile from './appMapTile'

const currentMapTile = ref(appMapTile[0])

function changeMapTile(item) {
  currentMapTile.value = item
  initTile()
}

const map = ref()

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

function initTile() {
  L.tileLayer(`${currentMapTile.value.url}`, {
    attribution: '&copy; <p>OpenStreetMap</p> contributors'
  }).addTo(map.value)
}

onMounted(() => {
  initMap()
  initTile()
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
