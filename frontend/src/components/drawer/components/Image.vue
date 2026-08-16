<!--
 * @Author: Do not edit
 * @Date: 2025-05-01 10:38:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-08-16 20:19:44
 * @FilePath: \picmap-go\frontend\src\components\drawer\components\Image.vue
 * @Description: 
-->
<template>
  <div class="img-box" v-loading="isLoading">
    <div class="download-button" @click="downloadImage">
      <el-tooltip :content="$t('downloadPicture')" placement="top">
        <img src="@/assets/icon/下载.png" alt="" width="30px" />
      </el-tooltip>
    </div>
    <el-image :key="imageId" :alt="$t('pictureLoadFailed')" :src="url" :teleported="true"
      :preview-src-list="perview ? [url] : []" />
    <el-tooltip v-if="showName" :content="name" placement="top">
      <div class="image-name">
        {{ name }}
      </div>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import API from '@/wails/api'
import { fileToBase64 } from '@/utils/map'
import { getImageUrlById, getImageUrl, isImageExist, getMarkerImageUrl, getMarkerImageUrlById } from '@/utils/Image';
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
  },
  // 缩略图模式：使用 120px 小图（分组列表用），默认加载大图（详情用）
  thumbnail: {
    type: Boolean,
    default: false
  }
})

// 详情模式填充父容器高度，缩略图模式固定 120px
const height = computed(() => props.thumbnail ? '120px' : '100%')
const url = ref('')
const name = ref('')
const isLoading = ref(false)

/**
 * @description: 通过imageId获取图片信息
 * @param {*} imageId
 * @return {*}
 */
async function setImageUrl(imageId: string) {
  const imageInfo = getSchemaInfoById(imageId) as any
  name.value = imageInfo?.name

  // 缩略图模式：用 120px 小图（分组列表）
  if (props.thumbnail) {
    const cached = getMarkerImageUrl(imageId)
    if (cached) {
      url.value = cached
      isLoading.value = false
      return
    }
    url.value = ''
    isLoading.value = true
    const res = await getMarkerImageUrlById(imageId)
    url.value = res
    isLoading.value = false
    return
  }

  // 图片已缓存：直接切换，不显示加载动画
  if (isImageExist(imageId)) {
    url.value = getImageUrl(imageId) ?? ''
    isLoading.value = false
    return
  }

  // 未缓存：先清空旧图并显示 loading，避免展示上一张图片
  url.value = ''
  isLoading.value = true
  const res = await getImageUrlById(imageId)
  url.value = res
  isLoading.value = false
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
async function downloadImage(e: MouseEvent) {
  e.stopPropagation() // 阻止事件冒泡，避免触发图片预览
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
  height: 370px;
  position: relative;
  background-color: rgba(53, 53, 53, 0.95);
  display: flex;
  justify-content: center;
  cursor: pointer;

  .download-button {
    transition: all 0.2s;
    position: absolute;
    top: 5px;
    right: 5px;
    cursor: pointer;
    pointer-events: all;
    opacity: 0;
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