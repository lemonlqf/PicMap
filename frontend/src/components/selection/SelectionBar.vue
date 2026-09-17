<!--
 * @Description: 框选结果操作栏：显示选中数量，提供批量删除/加入分组/清空
-->
<template>
  <div v-if="count > 0" class="selection-bar" :style="{ left: pos.left, top: pos.top }">
    <span class="count">{{ $t('selectedCount') }} {{ count }} {{ $t('nodes') }}</span>
    <el-divider direction="vertical" />
    <span class="action" @click="handleDelete">{{ $t('batchDeleteImages') }}</span>
    <span class="action" @click="handleAddGroup">{{ $t('batchAddToGroup') }}</span>
    <span class="action" @click="handleClear">{{ $t('clear') }}</span>

    <!-- 复用单条添加到分组的弹框 -->
    <GroupInfoDialog v-model="groupDialogShow" :imageIds="selectedImageIds" :videoIds="selectedVideoIds"
      @group-setup-complete="handleGroupSetupComplete" />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSelectStore } from '@/store/select'
import markerService from '@/services/marker'
import { batchDeleteImages } from '@/utils/Image'
import { deleteVideos } from '@/utils/video'
import { getVideoInfoById } from '@/utils/schema'
import { useSchemaStore } from '@/store/schema'
import eventBus from '@/utils/eventBus'
import GroupInfoDialog from '@/components/groupInfo/groupEdit/GroupInfoDialog.vue'

const selectStore = useSelectStore()
const schemaStore = useSchemaStore()

const count = computed(() => selectStore.getSelectedCount())
const selectedIds = computed(() => selectStore.getSelectedIds())
const pos = ref({ top: '12px' })

// 分组 marker id 集合（加入分组时过滤）
const groupMarkerIds = computed(() => {
  return schemaStore.getGroupInfo.map((g) => g.id)
})
// 选中的节点（排除分组），再按图片/视频拆分
const selectedNodeIds = computed(() => {
  return selectedIds.value.filter((id) => !groupMarkerIds.value.includes(id))
})
const selectedVideoIds = computed(() => selectedNodeIds.value.filter((id) => !!getVideoInfoById(id)))
const selectedImageIds = computed(() => selectedNodeIds.value.filter((id) => !getVideoInfoById(id)))

// 批量加分组对话框状态（复用单条添加到分组的弹框）
const groupDialogShow = ref(false)

async function handleDelete() {
  if (selectedImageIds.value.length > 0) {
    await batchDeleteImages(selectedImageIds.value)
  }
  if (selectedVideoIds.value.length > 0) {
    await deleteVideos(selectedVideoIds.value)
  }
  selectStore.clear()
  markerService.refreshSelection()
}

function handleAddGroup() {
  if (selectedImageIds.value.length === 0 && selectedVideoIds.value.length === 0) return
  groupDialogShow.value = true
}

// 弹框内已完成分组写入/节点隐藏/持久化，这里只需清空选中态
function handleGroupSetupComplete() {
  groupDialogShow.value = false
  selectStore.clear()
  markerService.refreshSelection()
}

function handleClear() {
  selectStore.clear()
  markerService.refreshSelection()
}

function onClearSelection() {
  handleClear()
}

onMounted(() => {
  eventBus.on('clear-selection', onClearSelection)
})

onUnmounted(() => {
  eventBus.off('clear-selection', onClearSelection)
})
</script>

<style lang="scss" scoped>
.selection-bar {
  position: fixed;
  z-index: 1200;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #409eff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  color: #333;

  .count {
    font-weight: bold;
    color: #409eff;
  }

  .action {
    cursor: pointer;
    color: #409eff;
    white-space: nowrap;

    &:hover {
      color: #79bbff;
      text-decoration: underline;
    }
  }
}
</style>
