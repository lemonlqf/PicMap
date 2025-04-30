<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 12:09:21
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-16 17:34:38
 * @FilePath: \Code\picMap_fontend\src\components\drawer\index.vue
 * @Description: 
-->
<template>
  <div :class="{ drawer: true, 'is-show': isShow }">
    <el-scrollbar :max-height="drawerHeight">
      <div class="flex-box">
        <div class="hidden-button" @click="drawerHidden">
          <img src="@/assets/icon/关闭.png" alt="" />
        </div>
        <div class="img-box">
          <div class="download-button" @click="downloadImage">
            <img src="@/assets/icon/下载.png" alt="" width="30px" title="下载原图" />
          </div>
          <el-image :alt="marker?.name" :src="marker?.url" :teleported="true" style="width: 100%; height: 300px"
            :preview-src-list="[marker?.url]" />
        </div>
        <div class="img-info-box">
          <keyValue v-if="marker.imageInfo" title="图片信息" :info="marker.imageInfo"></keyValue>
          <keyValue v-if="marker.cameraInfo" title="相机信息" :info="marker.cameraInfo"></keyValue>
          <keyValue v-if="marker.authorInfo" title="作者信息" :info="marker.authorInfo"></keyValue>
          <keyValue v-if="marker.GPSInfo" title="GPS信息" :info="marker.GPSInfo"></keyValue>
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import eventBus from '@/utils/eventBus'
import { fileToBase64 } from '@/utils/map'
import { onMounted, onUnmounted, ref } from 'vue'
import { judgeHadUploadImage, getSchemaInfoById } from '@/utils/schema'
import { calcMBSize } from '@/utils/Image'
import keyValue from './components/keyValue.vue'
import API from '@/http/index'

const props = defineProps({})
const isShow = ref(false)
const marker = ref({})
const drawerHeight = '300px'
const imageRef = ref()

function drawerShow(event) {
  // 如果marker不在schema中，则说明是临时添加的，需要出现抽屉
  // if (!judgeHadUploadImage(event.target.options.id)) {
  //   return
  // }

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

/**
 * @description: 下载原图
 * @return {*}
 */
async function downloadImage() {
  const imageId = marker.value.id
  if (imageId) {
    const res = await API.image.downloadImage({ imageId })
    const code = res.code
    if (code === 200) {
      const fileName = marker.value.name ?? 'image.jpg'
      const fileUrl = fileToBase64(res.data.file)
      let a = document.createElement('a');
      a.download = fileName;
      a.href = fileUrl;
      a.click();
    }
  }
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
  top: 100%;
  width: 100%;
  transition: all 0.3s ease-in-out;
  opacity: 0;
  z-index: 9999;
  box-shadow: 0 20px 30px 30px rgba(0, 0, 0, 0.5);

  .flex-box {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    background-color: rgba(255, 255, 255, 0.98);
  }
}

.is-show {
  top: calc(100% - 300px);
  opacity: 1;
}

.hidden-button {
  padding: 2px;
  position: absolute;
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
  max-width: 900px;
  min-width: 200px;
  position: relative;
  flex: 1;
  background-color: rgb(53, 53, 53);
  display: flex;
  justify-content: center;

  .download-button {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    pointer-events: all;
    opacity: 0.6;
    z-index: 999;
  }

  .download-button:hover {
    opacity: 1;
  }

  :deep(.el-image) {
    img {
      object-fit: scale-down;
    }
  }
}

.img-info-box {
  padding: 15px 15px;
  max-height: 280px;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
}

@media screen and (max-width: 600px) {
  .img-info-box {
    display: flex;
    max-height: unset;
    flex-direction: column;
  }
}
</style>
