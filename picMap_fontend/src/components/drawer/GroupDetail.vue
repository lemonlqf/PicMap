<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-16 21:40:54
 * @FilePath: \Code\picMap_fontend\src\components\drawer\GroupDetail.vue
 * @Description: 
-->
<template>
  <div class="flex-box">
    <el-scrollbar :max-height="height">
      <!-- 图片展示 -->
      <div class="img-boxs">
        <template v-for="id in groupNumbers" :key="id">
          <Image :show-name="true" class="image" :perview="false" :image-id="id" style="height: 120px; width: 170px"></Image>
        </template>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import Image from './components/Image.vue';
import type { IMarker } from '@/type/image';
import { getSchemaInfoById } from '@/utils/schema';
import { getImageUrlById } from '@/utils/Image';
import { DRAWER_HEIGHT } from '@/utils/constant'
import { getGroupInfoByGroupId } from '@/utils/group';
import eventBus from '@/utils/eventBus'


const props = defineProps({
  groupId: {
    type: String,
    default: () => ({})
  },
  height: {
    type: Number,
    default: () => DRAWER_HEIGHT
  }
})

const height = props.height + 'px'


// 动态更新
const groupNumbers = computed(() => {
  const markerId = props.groupId
  const groupNumbers = getGroupInfoByGroupId(markerId)?.groupNumbers ?? []
  if (groupNumbers.length === 0) {
    eventBus.emit('drawer-hidden')
  }
  return groupNumbers
})
</script>

<style scoped lang="scss">
.flex-box {
  width: 100%;
  height: v-bind('height');
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
    border-radius: 3px;
    overflow: hidden;
    margin-top: 10px;
    margin-left: 10px;
  }
}
</style>