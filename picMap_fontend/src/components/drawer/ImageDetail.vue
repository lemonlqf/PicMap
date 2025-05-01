<template>
  <div class="flex-box">
    <Image style="flex: 1" :image-info="marker"></Image>
    <div style="flex: 1" class="img-info-box">
      <keyValue v-if="marker.imageInfo" title="图片信息" :info="marker.imageInfo"></keyValue>
      <keyValue v-if="marker.cameraInfo" title="相机信息" :info="marker.cameraInfo"></keyValue>
      <keyValue v-if="marker.authorInfo" title="作者信息" :info="marker.authorInfo"></keyValue>
      <keyValue v-if="marker.GPSInfo" title="GPS信息" :info="marker.GPSInfo"></keyValue>
    </div>
  </div>
</template>

<script setup lang="ts">
import keyValue from './components/keyValue.vue'
import Image from './components/Image.vue'

const props = defineProps({
  marker: {
    type: Object,
    default: () => ({})
  }
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