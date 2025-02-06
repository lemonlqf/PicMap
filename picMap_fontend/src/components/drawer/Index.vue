<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 12:09:21
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 13:08:50
 * @FilePath: \Code\picMap_fontend\src\components\drawer\index.vue
 * @Description: 
-->
<template>
  <div :class="{ drawer: true, 'is-show': isShow }">
    <div class="hidden-button" @click="drawerHidden">
      <img src="@/assets/icon/关闭.png" alt="" />
    </div>
    <div class="img-box">
      <img :alt="marker?.name" :src="marker?.url" height="300px" />
    </div>
    <div class="img-info-box">
      <keyValue v-if="marker.imageInfo" title="图片信息" :info="marker.imageInfo"></keyValue>
      <keyValue v-if="marker.cameraInfo" title="相机信息" :info="marker.cameraInfo"></keyValue>
      <keyValue v-if="marker.authorInfo" title="作者信息" :info="marker.authorInfo"></keyValue>
      <keyValue v-if="marker.GPSInfo" title="GPS信息" :info="marker.GPSInfo"></keyValue>
    </div>
  </div>
</template>

<script setup>
import eventBus from '@/utils/eventBus'
import { onMounted, onUnmounted, ref } from 'vue'
import { isExistInImageInfo, getSchemaInfoById } from '@/utils/schema.js'
import { calcMBSize } from '@/utils/Image'
import keyValue from './components/keyValue.vue'

const props = defineProps({})
const isShow = ref(false)
const marker = ref({})

function drawerShow(event) {
  // 如果marker不在schema中，则说明是临时添加的，需要出现抽屉
  if (!isExistInImageInfo(event.target.options.id)) {
    return
  }

  isShow.value = true
}

function drawerHidden() {
  isShow.value = false
}

function drawerShowChange() {
  isShow.value = !isShow.value
}

/**
 * @description: 点击图片后出现抽屉并展示相关数据
 * @return {*}
 */
function showImageData(event) {
  const schemaInfo = getSchemaInfoById(event.target.options.id)
  const url = event.target.options.icon.options.iconUrl
  marker.value = { ...schemaInfo, url }
  if (!isShow.value) {
    drawerShow(event)
  }
  // TODO:更新图片信息的逻辑
}

onMounted(() => {
  eventBus.on('drawer-show', drawerShow)
  eventBus.on('drawer-hidden', drawerHidden)
  eventBus.on('show-image-data', showImageData)
})

onUnmounted(() => {
  eventBus.off('drawer-show', drawerShow)
  eventBus.off('drawer-hidden', drawerHidden)
  eventBus.off('update-image-data', showImageData)
})
</script>

<style lang="scss" scoped>
.drawer {
  position: fixed;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  top: 100%;
  height: 300px;
  overflow: auto;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.98);
  transition: 0.3s ease-in-out;
  opacity: 0;
  z-index: 9999;
}

.is-show {
  transform: translateY(-100%);
  opacity: 1;
}

.hidden-button {
  padding: 2px;
  position: fixed;
  top: 5px;
  right: 5px;
  height: 20px;
  width: 20px;
  pointer-events: all;
  border-radius: 4px;
  cursor: pointer;
  img {
    width: 100%;
  }
}
.hidden-button:hover {
  background-color: rgba(177, 174, 171, 0.2);
}
.img-box {
  width: 700px;
  background-color: rgb(53, 53, 53);
  display: flex;
  justify-content: center;
}

.img-info-box {
  padding: 20px 30px;
  max-height: 260px;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
}
</style>
