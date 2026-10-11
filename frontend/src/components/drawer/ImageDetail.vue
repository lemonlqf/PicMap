<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:35:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-08-16 20:50:21
 * @FilePath: \picmap-go\frontend\src\components\drawer\ImageDetail.vue
 * @Description: 
-->
<template>
  <div class="flex-box">
    <div class="img-container" style="flex: 1" v-loading="panoramaLoading">
      <PanoramaViewer v-if="imageInfo?.isPanorama" :src="panoramaUrl" :panorama-type="panoramaType"></PanoramaViewer>
      <Image v-else :image-id="imageId"></Image>
    </div>
    <div style="flex: 1" class="img-info-box">
      <ImageInfoComponent :image-info="imageInfo">
      </ImageInfoComponent>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Image from './components/Image.vue'
import ImageInfoComponent from './components/ImageInfo.vue'
import PanoramaViewer from '@/components/imagePreview/PanoramaViewer.vue'
import { DRAWER_HEIGHT } from '@/utils/constant'
import { getSchemaInfoById, judgeHadUploadImage } from '@/utils/schema'
import { getFullImageUrlById, getImageUrl } from '@/utils/Image'

const props = defineProps({
  imageId: {
    type: String,
    default: () => ({})
  },
  height: {
    type: Number,
    default: () => DRAWER_HEIGHT
  }
})

const height = props.height - 20 + 'px'

const imageInfo = computed(() => {
  return getSchemaInfoById(props.imageId)
})

const panoramaUrl = ref('')
const panoramaType = ref('')
const panoramaLoading = ref(false)

watch(() => props.imageId, async (imageId) => {
  if (imageInfo.value?.isPanorama) {
    panoramaUrl.value = ''
    panoramaType.value = imageInfo.value?.panoramaType ?? ''
    panoramaLoading.value = true
    try {
      // 待上传图片尚未导入用户目录，服务端的全景图不存在（按 id 请求会失败），
      // 因此未上传时回退到解析预览（内存中的 base64）作为全景源
      const url = judgeHadUploadImage(imageId)
        ? await getFullImageUrlById(imageId)
        : (getImageUrl(imageId) || (imageInfo.value as any)?.url || '')
      // 请求期间可能已切换到其他图片，避免旧结果覆盖
      if (props.imageId !== imageId) return
      panoramaUrl.value = url
    } catch (e) {
      console.error('加载全景原图失败', e)
    } finally {
      // 无论成功/失败/异常都要关闭 loading，避免一直转圈
      if (props.imageId === imageId) panoramaLoading.value = false
    }
  } else {
    panoramaUrl.value = ''
    panoramaLoading.value = false
  }
}, { immediate: true })

</script>

<style scoped lang="scss">
.flex-box {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
}

.img-container {
  position: relative;
  height: 370px;
}

.img-info-box {
  background-color: rgba(255, 255, 255, 0.95);
  padding: 13px 15px;
  max-height: 400px;

  /* 或 v-bind('height')，但纯 CSS 不支持 v-bind */
  .grid-box {
    width: fit-content;
    display: grid;
    grid-template-areas:
      "info gps camera camera"
      "info gps camera camera"
      "author other other other";
    grid-gap: 12px;
    grid-template-rows: 120px 80px 120px;
    grid-template-columns: 130px 130px 130px 300px;
  }
}

.author-info {
  grid-area: author;
}

.image-info {
  grid-area: info;
}

.GPS-info {
  grid-area: gps;
}

.camera-info {
  grid-area: camera;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
}

.other {
  grid-area: other;
}
</style>