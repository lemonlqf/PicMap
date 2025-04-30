<template>
  <div class="flex-box">
    <div class="img-box">
      <div class="download-button" @click="downloadImage">
        <img src="@/assets/icon/下载.png" alt="" width="30px" title="下载原图" />
      </div>
      <el-image :key="marker?.url" :alt="marker?.name" :src="marker?.url" :teleported="true"
        :preview-src-list="[marker?.url]" />
    </div>
    <div class="img-info-box">
      <keyValue v-if="marker.imageInfo" title="图片信息" :info="marker.imageInfo"></keyValue>
      <keyValue v-if="marker.cameraInfo" title="相机信息" :info="marker.cameraInfo"></keyValue>
      <keyValue v-if="marker.authorInfo" title="作者信息" :info="marker.authorInfo"></keyValue>
      <keyValue v-if="marker.GPSInfo" title="GPS信息" :info="marker.GPSInfo"></keyValue>
    </div>
  </div>
</template>

<script setup lang="ts">
import API from '@/http/index'
import { fileToBase64 } from '@/utils/map'
import keyValue from './components/keyValue.vue'

const props = defineProps({
  marker: {
    type: Object,
    default: () => ({})
  }
})


/**
 * @description: 下载原图
 * @return {*}
 */
async function downloadImage() {
  const imageId = props.marker.id
  if (imageId) {
    const res = await API.image.downloadImage({ imageId })
    const code = res.code
    if (code === 200) {
      const fileName = props.marker.name ?? 'image.jpg'
      const fileUrl = fileToBase64(res.data.file)
      let a = document.createElement('a');
      a.download = fileName;
      a.href = fileUrl;
      a.click();
    }
  }
}
</script>

<style scoped lang="scss">
.flex-box {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
}

.img-box {
  max-width: 900px;
  position: relative;
  flex: 1;
  background-color: rgba(53, 53, 53, 0.95);
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
    height: 300px;
    transition: opacity 0.5s ease, transform 0.5s ease;

    img {
      transition: all 0.3s;
      object-fit: scale-down;
      background-color: rgba(53, 53, 53, 0.95);
    }
    .el-image__error {
      background-color: rgba(53, 53, 53, 0.95);
    }
  }
}

.img-info-box {
  flex: 1;
  padding: 15px 15px;
  max-height: 280px;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  background-color: rgba(255, 255, 255, 00.95);
}

@media screen and (max-width: 600px) {
  .img-info-box {
    display: flex;
    max-height: unset;
    flex-direction: column;
  }
}
</style>