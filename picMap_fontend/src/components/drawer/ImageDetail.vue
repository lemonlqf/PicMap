<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:35:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-17 19:21:58
 * @FilePath: \Code\picMap_fontend\src\components\drawer\ImageDetail.vue
 * @Description: 
-->
<template>
  <div class="flex-box">
    <Image style="flex: 1" :image-id="imageId"></Image>
    <div style="flex: 1" class="img-info-box">
      <ImageInfoComponent :image-info="imageInfo">
      </ImageInfoComponent>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Image from './components/Image.vue'
import ImageInfoComponent from './components/ImageInfo.vue'
import { DRAWER_HEIGHT } from '@/utils/constant'
import { getSchemaInfoById } from '@/utils/schema'
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

</script>

<style scoped lang="scss">
.flex-box {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
}

.img-info-box {
  background-color: rgba(255, 255, 255, 0.95);
  padding: 15px 15px;
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