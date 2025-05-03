<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-03 12:12:57
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\Index.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <!-- 将图片右键和分组右键拆分一下 -->
  <div :class="{ menu: true, 'is-show': isShow }">
    <ImageContentMenu v-if="markerType === 'image'" :imageId="marker.options.id"></ImageContentMenu>
    <GroupContentMenu v-if="markerType === 'group'" :groupId="marker.options.id"></GroupContentMenu>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import eventBus from '@/utils/eventBus'
import { judgeHadUploadImage, saveSchema } from '@/utils/schema'
import ImageContentMenu from './component/ImageContentMenu.vue'
import GroupContentMenu from './component/GroupContentMenu.vue'

const isShow = ref(false)
const marker = ref({})
const markerType = ref<"image" | "group">()
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
  // 如果marker不在schema中，则说明是临时添加的，不需要出现右键的菜单
  if (!judgeHadUploadImage(event.target.options.id)) {
    return
  }
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
  transform: translate(15px, 15px);
  top: 0;
  left: v-bind('postionInfo.left');
  top: v-bind('postionInfo.top');
  opacity: 0;
  z-index: -1;
}

.is-show {
  opacity: 1;
  z-index: 999999;
}
</style>
