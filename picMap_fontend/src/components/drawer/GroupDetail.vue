<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-24 21:00:03
 * @FilePath: \Code\picMap_fontend\src\components\drawer\GroupDetail.vue
 * @Description: 
-->
<template>
  <div class="flex-box">
    <el-scrollbar style="width: 100%" :max-height="height">
      <!-- 图片展示 -->
      <!-- TODO:按照日期分类展示 -->
      <div class="img-boxs">
        <GroupLayout :group-id="groupId" :group-numbers="groupNumbers"></GroupLayout>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch, ref } from 'vue';
import GroupLayout from './components/GroupLayout.vue';
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
const imageInfoDialogShow = ref(false)
// 给弹框使用的
const url = ref('')
const imageId = ref('')
const imageInfo = ref()

// 动态更新
const groupNumbers = computed(() => {
  const markerId = props.groupId
  const groupNumbers = getGroupInfoByGroupId(markerId)?.groupNumbers ?? []
  if (groupNumbers.length === 0) {
    eventBus.emit('drawer-hidden')
  }
  // return [...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers, ...groupNumbers]
  return groupNumbers
})

function showImageInfo(e: MouseEvent, id: string) {
  const target = e.target as any
  // 如果是下载就不显示图片详情
  if (target?.title === '下载原图') {
    return
  }
  imageInfoDialogShow.value = true
  imageId.value = id
  setImageInfo(id)
  console.log(target.title)
}

/**
 * @description: 通过imageId获取图片信息
 * @param {*} imageId
 * @return {*}
 */
async function setImageInfo(imageId: string) {
  const imageInfoDetail = getSchemaInfoById(imageId) as any
  imageInfo.value = imageInfoDetail
}
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
  width: 100%;
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
