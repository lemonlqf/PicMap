<!--
 * @Author: Do not edit
 * @Date: 2025-05-01 10:38:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-01 13:51:41
 * @FilePath: \Code\picMap_fontend\src\components\drawer\components\Image.vue
 * @Description: 
-->
<template>
  <div class="img-box" style="width: 300px;height: 300px;">
    <div class="download-button" @click="downloadImage">
      <img src="@/assets/icon/下载.png" alt="" width="30px" title="下载原图" />
    </div>
    <el-image :key="imageInfo?.url" :alt="imageInfo?.name" :src="imageInfo?.url" :teleported="true"
      :preview-src-list="[imageInfo?.url]" />
  </div>
</template>

<script setup lang="ts">
import API from '@/http/index'
import { fileToBase64 } from '@/utils/map'
const props = defineProps({
  imageInfo: {
    type: Object,
    default: () => ({})
  },
  imageObjFit: {
    type: String,
    default: () => 'scale-down'
  }
})

/**
 * @description: 下载原图
 * @return {*}
 */
async function downloadImage() {
  const imageId = props.imageInfo.id
  if (imageId) {
    const res = await API.image.downloadImage({ imageId })
    const code = res.code
    if (code === 200) {
      const fileName = props.imageInfo.name ?? 'image.jpg'
      const fileUrl = fileToBase64(res.data.file)
      let a = document.createElement('a');
      a.download = fileName;
      a.href = fileUrl;
      a.click();
    }
  }
}
</script>

<style scoped>
.img-box {
  max-width: 900px;
  position: relative;
  background-color: rgba(53, 53, 53, 0.95);
  display: flex;
  justify-content: center;

  .download-button {
    transition: all 0.2s;
    position: absolute;
    top: 5px;
    right: 5px;
    cursor: pointer;
    pointer-events: all;
    opacity: 0;
    z-index: 999;
  }

  .download-button:hover {
    opacity: 1 !important;
  }
}

.img-box:hover {
  .download-button {
    opacity: 0.6;
  }
}

:deep(.el-image) {
  height: 100%;
  transition: opacity 0.5s ease, transform 0.5s ease;

  img {
    transition: all 0.3s;
    object-fit: v-bind("props.imageObjFit");
    background-color: rgba(53, 53, 53, 0.95);
  }

  .el-image__error {
    background-color: rgba(53, 53, 53, 0.95);
  }
}
</style>