<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-01 20:55:13
 * @FilePath: \Code\picMap_fontend\src\components\drawer\GroupDetail.vue
 * @Description: 
-->
<template>
  <div class="flex-box">
    <el-scrollbar :max-height="drawerHeight">
      <!-- 图片展示 -->
      <div class="img-boxs">
        <template v-for="id in marker.groupNumbers" :key="id">
          <Image class="image" :perview="false" image-obj-fit="contain" :image-info="imageInfo(id)" style="height: 100px; width: 100px"></Image>
        </template>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import Image from './components/Image.vue';
import { IMarker } from '@/type/image';
import { getSchemaInfoById } from '@/utils/schema';
import { getImageUrl } from '@/utils/Image';

const props = defineProps({
  marker: {
    type: Object,
    default: () => ({})
  }
})

const drawerHeight = '300px'

/**
 * @description: 通过imageId获取图片信息
 * @param {*} imageId
 * @return {*}
 */
function imageInfo(imageId) {
  let res: IMarker;
  const schemaInfo = getSchemaInfoById(imageId)
  const url = getImageUrl(imageId)
  res = { ...schemaInfo, url } as IMarker
  return res
}


watch(() => props.marker, (newVal) => {
  console.log('marker changed:', newVal);
}, { immediate: true });
</script>

<style scoped lang="scss">
.flex-box {
  width: 100%;
  height: 300px;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  background-color: rgba(240, 248, 255, 0.89);
}

.img-boxs {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  .image {
    margin-top: 5px;
    margin-left: 5px;
  }
}
</style>