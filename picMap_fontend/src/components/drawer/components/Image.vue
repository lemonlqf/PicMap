<!--
 * @Author: Do not edit
 * @Date: 2025-05-01 10:38:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-17 19:59:16
 * @FilePath: \Code\picMap_fontend\src\components\drawer\components\Image.vue
 * @Description: 
-->
<template>
  <div class="img-box">
    <div class="download-button" @click="downloadImage">
      <img src="@/assets/icon/下载.png" alt="" width="30px" title="下载原图" />
    </div>
    <el-image :key="imageId" alt="图片加载失败" :src="url" :teleported="true"
      :preview-src-list="perview ? [url] : []" />
    <div class="image-name" v-if="showName" :title="name">
      {{ name }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import API from '@/http/index'
import { fileToBase64 } from '@/utils/map'
import { DRAWER_HEIGHT } from '@/utils/constant'
import { getImageUrlById } from '@/utils/Image';
import { getSchemaInfoById } from '@/utils/schema'


const props = defineProps({
  imageObjFit: {
    type: String as () => 'contain' | 'scale-down',
    default: () => 'scale-down'
  },
  // 是否需要预览
  perview: {
    type: Boolean,
    default: () => true
  },
  imageId: {
    type: String,
    default: ''
  },
  showName: {
    type: Boolean,
    default: false
  }
})

const height = DRAWER_HEIGHT + 'px'
const url = ref('')
const name = ref('')

/**
 * @description: 通过imageId获取图片信息
 * @param {*} imageId
 * @return {*}
 */
async function setImageUrl(imageId: string) {
  // 取值
  const res = await getImageUrlById(imageId)
  const imageInfo = getSchemaInfoById(imageId) as any
  url.value = res
  name.value = imageInfo?.name
}

watch(() => props.imageId, () => {
  setImageUrl(props.imageId)
}, {
  immediate: true
})


/**
 * @description: 下载原图
 * @return {*}
 */
async function downloadImage() {
  const imageId = props.imageId
  const schemaInfo = getSchemaInfoById(imageId)
  if (imageId) {
    const res = await API.image.downloadImage({ imageId })
    const code = res.code
    if (code === 200) {
      const fileName = schemaInfo?.name ?? 'image.jpg'
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
  height: v-bind('height');
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

.image-name {
  cursor: pointer;
  position: absolute;
  bottom: 0px;
  left: 0px;
  background-color: rgba(240, 248, 255, 0.836);
  border-top-right-radius: 5px;
  font-size: 12px;
  width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 3px;
}
</style>