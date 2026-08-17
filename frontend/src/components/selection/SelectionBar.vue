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

    <el-dialog :z-index="999999" v-model="groupDialogShow" :title="$t('batchUploadToGroup')" width="440px" append-to-body>
      <el-select v-model="selectedGroupIds" multiple :placeholder="$t('placeholder.selectGroup')" style="width: 100%;">
        <el-option v-for="item in groupIdAndNameLists" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="groupDialogShow = false">{{ $t('cancel') }}</el-button>
          <el-button type="primary" @click="confirmAddGroup" :disabled="selectedGroupIds.length === 0">
            {{ $t('confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSelectStore } from '@/store/select'
import markerService from '@/services/marker'
import { batchDeleteImages } from '@/utils/Image'
import { batchAddImagesToGroups, getGroupIdAndNameLists } from '@/utils/group'
import { useSchemaStore } from '@/store/schema'
import eventBus from '@/utils/eventBus'

const selectStore = useSelectStore()
const schemaStore = useSchemaStore()

const count = computed(() => selectStore.getSelectedCount())
const selectedIds = computed(() => selectStore.getSelectedIds())
const pos = ref({ left: '12px', top: '12px' })

// 分组 marker id 集合（加入分组时过滤）
const groupMarkerIds = computed(() => {
  return schemaStore.getGroupInfo.map((g) => g.id)
})
const selectedImageIds = computed(() => {
  return selectedIds.value.filter((id) => !groupMarkerIds.value.includes(id))
})

// 批量加分组对话框状态
const groupDialogShow = ref(false)
const selectedGroupIds = ref<string[]>([])
const groupIdAndNameLists = ref<Array<{ id: string; name: string }>>([])

async function handleDelete() {
  const imageIds = selectedImageIds.value
  if (imageIds.length === 0) return
  await batchDeleteImages(imageIds)
  selectStore.clear()
  markerService.refreshSelection()
}

function handleAddGroup() {
  if (selectedImageIds.value.length === 0) return
  selectedGroupIds.value = []
  groupIdAndNameLists.value = getGroupIdAndNameLists()
  groupDialogShow.value = true
}

async function confirmAddGroup() {
  if (selectedGroupIds.value.length === 0) return
  await batchAddImagesToGroups(selectedImageIds.value, selectedGroupIds.value)
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
