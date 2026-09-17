<!--
 * @Description: 视频节点右键菜单（删除节点 / 全景标记 / 设置分组）
-->
<template>
  <div class="image-menu">
    <div class="menu-item" v-for="item in menuList" :key="item.label" @click="item.clickEvent(props.videoId)">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus'
import { deleteVideos } from '@/utils/video'
import { getVideoInfoById, setVideoPanoramaAndSave } from '@/utils/schema'
import { canDragMenu } from './markerOperate'
import markerService from '@/services/marker'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  videoId: {
    type: String,
    default: () => ''
  }
})

// 右键项：根据 isPanorama 显示"设为全景/取消全景"。
// 注意：该组件在右键菜单中常驻（仅非 CSS 显隐），computed 会缓存首次结果，
// 切换全景后不会自动重算，故用 refreshKey 在切换后强制刷新菜单项。
const refreshKey = ref(0)
const menuList = computed(() => {
  // 依赖 refreshKey，切换全景后主动触发重算
  void refreshKey.value
  const isPanorama = !!getVideoInfoById(props.videoId)?.isPanorama
  return [
    {
      label: isPanorama ? t('cancelPanorama') : t('setPanorama'),
      clickEvent: async () => {
        await setVideoPanoramaAndSave(props.videoId, !isPanorama)
        // 切换后即时刷新 marker 图标（显示/移除全景角标）
        markerService.refreshMarkerIconById(props.videoId)
        // 强制刷新菜单项，使"设为/取消全景"状态可再次切换
        refreshKey.value++
        menuHidden()
      }
    },
    {
      label: t('setGroup'),
      clickEvent: async () => {
        // 打开分组设置弹框（由 UploadPanel 统一承载）
        eventBus.emit('edit-group-video', props.videoId)
        menuHidden()
      }
    },
    {
      label: t('deleteVideo'),
      clickEvent: async () => {
        await deleteVideos([props.videoId])
        ElMessage.success(t('deleteSuccess'))
        menuHidden()
      }
    },
    canDragMenu()
  ]
})

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
