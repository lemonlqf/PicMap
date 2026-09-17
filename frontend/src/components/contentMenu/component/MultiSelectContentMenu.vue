<!--
 * @Description: 框选批量操作的右键菜单
-->
<template>
  <div class="multi-menu">
    <div class="menu-item" v-for="item in menuList" :key="item.label" @click="item.clickEvent()">
      <span>{{ item.label }}</span>
    </div>

    <!-- 复用单条添加到分组的弹框 -->
    <GroupInfoDialog v-model="groupDialogShow" :imageIds="selectedImageIds" :videoIds="selectedVideoIds"
      @group-setup-complete="handleGroupSetupComplete" />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSelectStore } from '@/store/select'
import { batchDeleteImages } from '@/utils/Image'
import { deleteVideos } from '@/utils/video'
import { getVideoInfoById } from '@/utils/schema'
import { useSchemaStore } from '@/store/schema'
import markerService from '@/services/marker'
import eventBus from '@/utils/eventBus'
import GroupInfoDialog from '@/components/groupInfo/groupEdit/GroupInfoDialog.vue'

const { t } = useI18n()
const selectStore = useSelectStore()
const schemaStore = useSchemaStore()

const props = defineProps({
  selectedIds: {
    type: Array as () => string[],
    default: () => []
  }
})

// 分组 marker 的 id 集合（批量操作时过滤掉）
const groupMarkerIds = computed(() => {
  return schemaStore.getGroupInfo.map((g) => g.id)
})

// 选中的节点（排除分组），再按图片/视频拆分
const selectedNodeIds = computed(() => {
  return props.selectedIds.filter((id) => !groupMarkerIds.value.includes(id))
})
const selectedVideoIds = computed(() => selectedNodeIds.value.filter((id) => !!getVideoInfoById(id)))
const selectedImageIds = computed(() => selectedNodeIds.value.filter((id) => !getVideoInfoById(id)))

const groupDialogShow = ref(false)

const menuList = computed(() => [
  {
    label: t('batchDeleteImages'),
    clickEvent: handleBatchDelete
  },
  {
    label: t('batchAddToGroup'),
    clickEvent: handleOpenGroupDialog
  }
])

function menuHidden() {
  eventBus.emit('hidden-content-menu')
}

async function handleBatchDelete() {
  if (selectedImageIds.value.length > 0) {
    await batchDeleteImages(selectedImageIds.value)
  }
  if (selectedVideoIds.value.length > 0) {
    await deleteVideos(selectedVideoIds.value)
  }
  // 清除选中集
  selectStore.clear()
  markerService.refreshSelection()
  menuHidden()
}

function handleOpenGroupDialog() {
  if (selectedImageIds.value.length === 0 && selectedVideoIds.value.length === 0) {
    menuHidden()
    return
  }
  groupDialogShow.value = true
  menuHidden()
}

// 弹框内已完成分组写入/节点隐藏/持久化，这里只需清空选中态
function handleGroupSetupComplete() {
  groupDialogShow.value = false
  // 清空选中（加入分组后节点位置可能变化，避免残留高亮）
  selectStore.clear()
  markerService.refreshSelection()
}
</script>

<style lang="scss" scoped>
* {
  user-select: none;
}

.multi-menu {
  display: inline-block;
  background-color: rgba(255, 255, 255, 1);
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);

  .menu-item {
    padding: 2px 13px 5px 13px;
    cursor: pointer;

    span {
      font-size: 14px;
      color: rgb(96, 98, 102);
      height: 25px;
      box-sizing: border-box;
      cursor: pointer;
      white-space: nowrap;
    }
  }

  .menu-item:hover {
    background-color: rgb(226, 226, 226);
  }

  .menu-item:last-child {
    border-bottom: 0;
  }
}
</style>
