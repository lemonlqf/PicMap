<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-28 20:10:15
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\GroupContentMenu.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <div class="image-menu">
    <!-- 没定位信息的分组允许定位 -->
    <div class="menu-item" v-if="!GPSInfoExist" @click="addManualLocateGroup">
      <span>定位分组</span>
    </div>
    <div class="menu-item" v-for="item in menuList" @click="editorGroup(item)">
      <span>{{ item.label }}</span>
    </div>
  </div>
  <el-dialog :append-to-body="true" width="410" v-model="groupEditDialog" :z-index="9999" :title="item.title"
    @closed="initItem">
    <span>{{ item?.description }}</span>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="hidden">取消</el-button>
        <el-button type="danger" @click="item.clickEvent" :loading="loading">
          确认
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import eventBus from '@/utils/eventBus'
import { deleteGroupById, dissolveGroupById, getGroupInfoByGroupId, updateGroupInfoToSchema } from '@/utils/group'
import { addManualLocateGroupToMap, getGPSInfoByMarkerInstance, GPSInfoLegality } from '@/utils/map'
import { canDragMenu } from './markerOperate'
import { ElMessage } from 'element-plus'

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
const loading = ref(false)
const item = ref<any>({})
const groupEditDialog = ref(false)
function editorGroup(editItem: any) {
  // 如果是重新定位，不需要弹框二次确认
  if (editItem.label === '重新定位') {
    editItem.clickEvent()
    return
  }
  groupEditDialog.value = true
  item.value = editItem
}

function hidden() {
  groupEditDialog.value = false
}

function initItem() {
  item.value = {}
}

const menuList = ref([
  // {
  //   label: '编辑分组',
  //   clickEvent: async () => {
  //     const groupId = props.groupId
  //     // TODO:待实现编辑分组信息
  //   }
  // },
  {
    label: '解散分组',
    title: '解散分组',
    description: '确定要解散分组吗？该分组将会被解散，组内图片任然保留！',
    clickEvent: async () => {
      loading.value = true
      const groupId = props.groupId
      // 删除schema中的分组信息
      await dissolveGroupById(groupId)
      ElMessage.success('解散成功！')
      loading.value = false
      hidden()
      // 隐藏右键菜单
      menuHidden()
    }
  },
  {
    label: '删除分组',
    title: '删除分组',
    description: '确定要删除分组吗？该分组以及分组内的图片将被删除！',
    clickEvent: async () => {
      loading.value = true
      const groupId = props.groupId
      // 删除schema中的分组信息
      await deleteGroupById(groupId)
      ElMessage.success('删除成功！')
      loading.value = false
      hidden()
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
