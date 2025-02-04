<template>
  <div :class="{ drawer: true, 'is-show': isShow }">
    <div class="hidden-button" @click="drawerHidden">
      <img src="@/assets/icon/关闭.png" alt="" />
    </div>
    <img alt="" />
  </div>
</template>

<script setup>
import eventBus from '@/utils/eventBus'
import { onMounted, onUnmounted, ref } from 'vue'
import { isExistInImageInfo } from '@/utils/schema.js'

const props = defineProps({})
const isShow = ref(false)

function drawerShow(event) {
  // 如果marker不在schema中，则说明是临时添加的，需要出现抽屉
  if (!isExistInImageInfo(event.target.options.id)) {
    return
  }
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
  eventBus.off('update-image-data', showImageData)
})
</script>

<style lang="scss" scoped>
.drawer {
  position: fixed;
  top: 100%;
  height: 400px;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.98);
  transition: 0.3s ease-in-out;
  opacity: 0;
  z-index: 9999;
}

.is-show {
  transform: translateY(-100%);
  opacity: 1;
}

.hidden-button {
  padding: 2px;
  position: fixed;
  top: 5px;
  right: 5px;
  height: 20px;
  width: 20px;
  pointer-events: all;
  border-radius: 4px;
  cursor: pointer;
  img {
    width: 100%;
  }
}
.hidden-button:hover {
  background-color: rgba(177, 174, 171, 0.2);
}
</style>
