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
import { getSchemaInfoById } from '@/utils/schema'
import { getFullImageUrlById } from '@/utils/Image'

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

watch(() => props.imageId, async () => {
  if (imageInfo.value?.isPanorama) {
    panoramaUrl.value = ''
    panoramaType.value = imageInfo.value?.panoramaType ?? ''
    panoramaLoading.value = true
    const url = await getFullImageUrlById(props.imageId)
    panoramaLoading.value = false
    panoramaUrl.value = url
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