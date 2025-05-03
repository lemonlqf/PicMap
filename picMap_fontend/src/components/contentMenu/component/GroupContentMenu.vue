<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-03 12:09:40
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\GroupContentMenu.vue
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
import { deleteGroupById, dissolveGroupById } from '@/utils/group'
import { ElMessage } from 'element-plus'
import { judgeHadUploadImage, saveSchema } from '@/utils/schema'
import { deleteMarkerInMap, MAP_INSTANCE } from '@/utils/map'

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
  }
])



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
