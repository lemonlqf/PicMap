<!--
 * @Author: Do not edit
 * @Date: 2025-06-17 19:12:19
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-15 21:18:23
 * @FilePath: \Code\picMap_fontend\src\components\drawer\components\ImageInfo.vue
 * @Description: 
-->
<template>
  <div class="grid-box">
    <KeyValue class="image-info" v-if="imageInfo?.imageInfo" :title="$t('pictureInfo')" :info="imageInfo?.imageInfo" />
    <KeyValue class="author-info" v-if="imageInfo?.authorInfo" title="时间信息" :info="imageInfo?.authorInfo" />
    <KeyValue class="GPS-info" v-if="imageInfo?.GPSInfo" title="GPS信息" :info="imageInfo?.GPSInfo" />
    <KeyValue class="camera-info" v-if="imageInfo?.cameraInfo" title="相机信息" :info="imageInfo?.cameraInfo" />
    <Description class="other" :description="imageInfo?.description" :id="imageInfo.id"></Description>
  </div>
</template>

<script setup>
import KeyValue from './keyValue.vue'
import Description from '@/components/description/Description.vue'
const props = defineProps({
  imageInfo: {
    type: Object,
    default: () => ({})
  }
})

</script>

<style lang="scss" scoped>
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


.author-info {
  grid-area: author;
}

.image-info {
  grid-area: info;
}

.GPS-info {
  grid-area: gps;
}

.other {
  grid-area: other;
}

.camera-info {
  grid-area: camera;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
}
</style>