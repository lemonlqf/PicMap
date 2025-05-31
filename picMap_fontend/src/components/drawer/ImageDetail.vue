<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:35:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-31 12:35:45
 * @FilePath: \Code\picMap_fontend\src\components\drawer\ImageDetail.vue
 * @Description: 
-->
<template>
  <div class="flex-box">
    <Image style="flex: 1" :image-id="imageId"></Image>
    <div style="flex: 1" class="img-info-box">
      <keyValue v-if="imageInfo?.imageInfo" title="图片信息" :info="imageInfo?.imageInfo"></keyValue>
      <keyValue v-if="imageInfo?.cameraInfo" title="相机信息" :info="imageInfo?.cameraInfo"></keyValue>
      <keyValue v-if="imageInfo?.authorInfo" title="作者信息" :info="imageInfo?.authorInfo"></keyValue>
      <keyValue v-if="imageInfo?.GPSInfo" title="GPS信息" :info="imageInfo?.GPSInfo"></keyValue>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import keyValue from './components/keyValue.vue'
import Image from './components/Image.vue'
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
  padding: 15px 15px;
  max-height: v-bind('height');
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