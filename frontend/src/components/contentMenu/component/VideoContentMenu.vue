<!--
 * @Description: 视频节点右键菜单（当前仅实现删除节点）
-->
<template>
  <div class="image-menu">
    <div class="menu-item" v-for="item in menuList" :key="item.label" @click="item.clickEvent(props.videoId)">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus'
import { deleteVideos } from '@/utils/video'
import { canDragMenu } from './markerOperate'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  videoId: {
    type: String,
    default: () => ''
  }
})

const menuList = ref([
  {
    label: t('deleteVideo'),
    clickEvent: async () => {
      await deleteVideos([props.videoId])
      ElMessage.success(t('deleteSuccess'))
      menuHidden()
    }
  },
  canDragMenu()
])

function menuHidden() {
  eventBus.emit('hidden-content-menu')
}
</script>

<style lang="scss" scoped>
* {
  user-select: none;
}

.image-menu {
  display: inline-block;
  background-color: rgba(255, 255, 255, 1);

  .menu-item {
    border-color: rgb(104, 104, 228);
    padding: 2px 13px 5px 13px;
    cursor: pointer;
    pointer-events: none;

    span {
      font-size: 14px;
      position: relative;
      text-overflow: ellipsis;
      color: rgb(96, 98, 102);
      height: 25px;
      box-sizing: border-box;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
    }
  }

  .menu-item:hover {
    background-color: rgb(226, 226, 226);
  }

  .menu-item:last-child {
    border-bottom: 0px;
  }
}

.is-show {
  opacity: 1;
  z-index: 999999;

  .menu-item {
    pointer-events: all;
  }
}
</style>
