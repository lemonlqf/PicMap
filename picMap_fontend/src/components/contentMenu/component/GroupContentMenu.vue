<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-31 11:46:32
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\GroupContentMenu.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <div class="image-menu">
    <!-- 没定位信息的分组允许定位 -->
    <div class="menu-item" v-if="!GPSInfoExist" @click="addManualLocateGroup">
      <span>定位分组</span>
    </div>
    <div class="menu-item" v-for="item in menuList" @click="item.clickEvent">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import eventBus from '@/utils/eventBus'
import { deleteGroupById, dissolveGroupById, getGroupInfoByGroupId, updateGroupInfoToSchema } from '@/utils/group'
import { addManualLocateGroupToMap, getGPSInfoByMarkerInstance, GPSInfoLegality } from '@/utils/map'
import { canDragMenu } from './markerOperate'

const props = defineProps({
  groupId: {
    type: String,
    default: () => ''
  }
})
const marker = ref({})
const postionInfo = ref({
  left: '10px',
  top: '0px'
})
const menuList = ref([
  {
    label: '编辑分组',
    clickEvent: async () => {
      const groupId = props.groupId
      // TODO:待实现编辑分组信息
    }
  },
  {
    label: '解散分组',
    clickEvent: async () => {
      const groupId = props.groupId
      // 删除schema中的分组信息
      await dissolveGroupById(groupId)
      // 隐藏右键菜单
      menuHidden()
    }
  },
  {
    label: '删除分组',
    clickEvent: async () => {
      const groupId = props.groupId
      // 删除schema中的分组信息
      await deleteGroupById(groupId)
      // 隐藏右键菜单
      menuHidden()
    }
  },
  canDragMenu(props.groupId)
])

const GPSInfoExist = computed(() => {
  const groupInfo = getGroupInfoByGroupId(props.groupId)
  return GPSInfoLegality(groupInfo?.GPSInfo)
})

function menuHidden() {
  eventBus.emit('hidden-content-menu')
}

async function addManualLocateGroup() {
  const groupInfo = getGroupInfoByGroupId(props.groupId)
  // 确定定位后才保存
  const marker = await addManualLocateGroupToMap(groupInfo)
  // TODO: 移动marke更新分组的位置
  // marker.on('moveend', async () => {
  //   const GPSInfo = getGPSInfoByMarkerInstance(marker)
  //   groupInfo.GPSInfo = GPSInfo
  //   await updateGroupInfoToSchema(props.groupId, groupInfo)
  // })
}

</script>

<style lang="scss" scoped>
.image-menu {
  background-color: rgba(255, 255, 255, 1);

  .menu-item {
    border-color: rgb(104, 104, 228);
    padding: 2px 13px 5px 13px;
    cursor: pointer;
    // pointer-events: none;

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
  .menu-item {
    pointer-events: all;
  }
}
</style>
