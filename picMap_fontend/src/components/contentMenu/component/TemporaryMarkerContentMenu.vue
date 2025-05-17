<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-17 21:22:24
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\TemporaryMarkerContentMenu.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <div class="image-menu">
    <div class="menu-item" v-for="item in menuList" @click="item.clickEvent">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import eventBus from '@/utils/eventBus'
import API from '@/http/index'
import { useSchemaStore } from '@/store/schema'
import { ElMessage } from 'element-plus'
import { deleteImageById } from '@/utils/Image'
import { editSchemaAndSave, saveSchema } from '@/utils/schema'
import { deleteMarkerInMap, MAP_INSTANCE, getMarkerById, getPermanentType, getGPSInfoByMarkerInstance } from '@/utils/map'

const props = defineProps({
  markerId: {
    type: String,
    default: () => ''
  },
})
const schemaStore = useSchemaStore()
const marker = ref({})
const postionInfo = ref({
  left: '10px',
  top: '0px'
})
const menuList = ref([
  {
    label: '确定位置',
    clickEvent: async () => {
      // 让marker变为不可以移动
      temporaryMarkerToPermanent(props.markerId)
    }
  }
])

/**
 * @description: 
 * @param {*} markerId
 * @return {*}
 */
function temporaryMarkerToPermanent(markerId: string) {
  const marker = getMarkerById(markerId)
  const markerType = marker.options.type
  // 改变marker类型
  marker.options.type = getPermanentType(markerType)
  // 变为不可拖拽
  marker.dragging.disable();
  const GPSInfo = getGPSInfoByMarkerInstance(marker)
  // 更新schema中的GPSInfo数据
  editSchemaAndSave(marker.options.id, "GPSInfo", GPSInfo)
}


function menuHidden() {
  eventBus.emit('hidden-content-menu')
}


</script>

<style lang="scss" scoped>
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
