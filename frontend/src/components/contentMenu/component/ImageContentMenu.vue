<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-09-13 18:43:00
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\ImageContentMenu.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <div class="image-menu">
    <div class="menu-item" v-for="item in menuList" @click="item.clickEvent(props.imageId)">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import eventBus from '@/utils/eventBus'
import API from '@/wails/api'
import { useSchemaStore } from '@/store/schema'
import { ElMessage } from 'element-plus'
import { deleteImageById } from '@/utils/Image'
import { judgeHadUploadImage, getSchemaInfoById, editSchemaAndSave } from '@/utils/schema'
import { canDragMenu } from './markerOperate'
import markerService from '@/services/marker'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  imageId: {
    type: String,
    default: () => ''
  }
})

const deleteAndDragList = [
  {
    label: t('deletePicture'),
    clickEvent: async () => {
      // 删除图片
      deleteImageById(props.imageId)
      // 删除后隐藏右键菜单
      menuHidden()
    }
  },
  canDragMenu()
]

const setGroupList = [
  {
    label: t('setGroup'),
    clickEvent: async () => {
      // 编辑分组信息
      eventBus.emit('edit-group', props.imageId)
      // 删除后隐藏右键菜单
      menuHidden()
    }
  }
]

const isImageUploaded = computed(() => {
  return judgeHadUploadImage(props.imageId)
})

// 菜单列表：常驻组件（仅 CSS 显隐），computed 会缓存首次结果，
// 故用 refreshKey 在切换全景后强制刷新，保证"设为/取消全景"可反复切换
const refreshKey = ref(0)
const menuList = computed(() => {
  void refreshKey.value
  if (!isImageUploaded.value) {
    return [...deleteAndDragList]
  }
  const isPanorama = !!getSchemaInfoById(props.imageId)?.isPanorama
  return [
    ...deleteAndDragList,
    ...setGroupList,
    {
      label: isPanorama ? t('cancelPanorama') : t('setPanorama'),
      clickEvent: async () => {
        await editSchemaAndSave(props.imageId, 'isPanorama', !isPanorama)
        // 切换后即时刷新 marker 图标（显示/移除全景角标）
        markerService.refreshMarkerIconById(props.imageId)
        // 强制刷新菜单项，使状态可再次切换
        refreshKey.value++
        menuHidden()
      }
    }
  ]
})

const schemaStore = useSchemaStore()
const marker = ref({})
const postionInfo = ref({
  left: '10px',
  top: '0px'
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
