<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-31 11:33:10
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\Index.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <!-- 将图片右键和分组右键拆分一下 -->
  <div :class="{ menu: true, 'is-show': isShow }">
    <ImageContentMenu v-if="markerType === 'image'" :imageId="marker.options.id"></ImageContentMenu>
    <GroupContentMenu v-else-if="markerType === 'group'" :groupId="marker.options.id"></GroupContentMenu>
    <!-- 其他情况都是临时节点 -->
    <TemporaryMarkerContentMenu v-else-if="markerType?.includes('temporary')" :markerId="marker.options.id"></TemporaryMarkerContentMenu>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import eventBus from '@/utils/eventBus'
import ImageContentMenu from './component/ImageContentMenu.vue'
import GroupContentMenu from './component/GroupContentMenu.vue'
import TemporaryMarkerContentMenu from './component/TemporaryMarkerContentMenu.vue'
import type { IShowType } from '@/type/image.ts'

const isShow = ref(false)
const marker = ref({})
const markerType = ref<IShowType>()
const postionInfo = ref({
  left: '10px',
  top: '0px'
})

function getPxValue(value) {
  if (typeof value === 'string') {
    return value
  } else {
    return `${value}px`
  }
}

function menuShow(event) {
  // 根据不同的节点类型展示不同的右键菜单内容
  markerType.value = event.target.options.type
  console.log(event)
  const { x, y } = event.originalEvent
  marker.value = event.target
  postionInfo.value.left = getPxValue(x ?? 0)
  postionInfo.value.top = getPxValue(y ?? 0)
  isShow.value = true
}

function menuHidden() {
  isShow.value = false
}


function menuShowChange() {
  isShow.value = !isShow.value
}

onMounted(() => {
  eventBus.on('show-content-menu', menuShow)
  eventBus.on('hidden-content-menu', menuHidden)
})

onUnmounted(() => {
  eventBus.off('show-content-menu', menuShow)
  eventBus.off('hidden-content-menu', menuHidden)
})
</script>

<style lang="scss" scoped>
.menu {
  display: inline-block;
  position: fixed;
  transform: translate(15px, 15px) scale(0.7);
  top: 0;
  left: v-bind('postionInfo.left');
  top: v-bind('postionInfo.top');
  opacity: 0;
  // z-index: -1;
  z-index: 999999;
}

.is-show {
  opacity: 1;
  transform: translate(15px, 15px) scale(1);
}

// 分别设置进入和离开动画时长
.menu {
  transition: opacity 0.15s, transform 0.253s;
}

.menu.is-show {
  transition: opacity 0.15s, transform 0.25s;
}

.menu:not(.is-show) {
  transition: opacity 0.1s, transform 0.1s;
}
</style>
