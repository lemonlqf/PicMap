<!--
 * @Author: Do not edit
 * @Date: 2025-04-29 18:33:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-31 14:18:47
 * @FilePath: \Code\picMap_fontend\src\components\drawer\Index.vue
 * @Description: 
-->
<template>
  <div :class="{ drawer: true, 'is-show': isShow }">
    <el-scrollbar :max-height="DRAWER_HEIGHT">
      <div class="flex-box">
        <div class="hidden-button" @click="drawerHidden">
          <img src="@/assets/icon/关闭.png" alt="" />
        </div>
        <!-- 图片详情 -->
        <ImageDetail v-if="marker.showType === 'image'" :height="DRAWER_HEIGHT" :image-id="marker.id" />
        <GroupDetail v-if="marker.showType === 'group'" :height="DRAWER_HEIGHT" :group-id="marker.id" />
      </div>
    </el-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import eventBus from '@/utils/eventBus'
import { onMounted, onUnmounted, ref } from 'vue'
import { getSchemaInfoById } from '@/utils/schema'
import type { IMarker } from '@/type/image'
import ImageDetail from './ImageDetail.vue'
import GroupDetail from './GroupDetail.vue'
import { getImageUrl } from '@/utils/Image'
import { DRAWER_HEIGHT } from '@/utils/constant'

const isShow = ref(false)
const marker = ref<IMarker>({} as IMarker)

const height = DRAWER_HEIGHT - 10 + 'px'

function drawerShow(event) {
  // 如果marker不在schema中，则说明是临时添加的，需要出现抽屉
  // if (!judgeHadUploadImage(event.target.options.id)) {
  //   return
  // }

  isShow.value = true
}

function drawerHidden() {
  isShow.value = false
}

function drawerShowChange() {
  isShow.value = !isShow.value
}

/**
 * @description: 点击图片后出现抽屉并展示相关数据
 * @return {*}
 */
function showImageData(event) {
  const schemaInfo = getSchemaInfoById(event.target.options.id)
  marker.value = { ...schemaInfo } as IMarker
  console.log('marker', marker.value)
  if (!isShow.value) {
    drawerShow(event)
  }
  // TODO:更新图片信息的逻辑
}


onMounted(() => {
  eventBus.on('drawer-show', drawerShow)
  eventBus.on('drawer-hidden', drawerHidden)
  eventBus.on('show-image-data', showImageData)
})

onUnmounted(() => {
  eventBus.off('drawer-show', drawerShow)
  eventBus.off('drawer-hidden', drawerHidden)
  eventBus.off('show-image-data', showImageData)
})
</script>

<style lang="scss" scoped>
.drawer {
  position: fixed;
  top: 100%;
  width: 100%;
  height: 100%;
  // transition: all 0.3s ease-in-out;
  transition:
      top 0.5s cubic-bezier(0.22, 1.2, 0.36, 1), // 弹性曲线
      opacity 0.3s;
  opacity: 0;
  z-index: 9999;
  box-shadow: 0 20px 30px 30px rgba(0, 0, 0, 0.5);
  background-color: rgba(0, 0, 0, 0.5);

  .flex-box {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
  }
}

.is-show {
  top: calc(100% - v-bind('height'));
  opacity: 1;
}

.hidden-button {
  padding: 2px;
  position: absolute;
  top: 5px;
  right: 5px;
  height: 20px;
  width: 20px;
  pointer-events: all;
  border-radius: 4px;
  cursor: pointer;
  z-index: 9999;

  img {
    width: 100%;
  }
}

.hidden-button:hover {
  background-color: rgba(177, 174, 171, 0.2);
}
</style>
