<!--
 * @Description: 框选批量操作的右键菜单
-->
<template>
  <div class="multi-menu">
    <div class="menu-item" v-for="item in menuList" :key="item.label" @click="item.clickEvent()">
      <span>{{ item.label }}</span>
    </div>

    <!-- 批量加入分组的选择对话框 -->
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSelectStore } from '@/store/select'
import { batchDeleteImages } from '@/utils/Image'
import { batchAddImagesToGroups, getGroupIdAndNameLists } from '@/utils/group'
import { useSchemaStore } from '@/store/schema'
import markerService from '@/services/marker'
import eventBus from '@/utils/eventBus'

const { t } = useI18n()
const selectStore = useSelectStore()
const schemaStore = useSchemaStore()

const props = defineProps({
  selectedIds: {
    type: Array as () => string[],
    default: () => []
  }
})

// 分组 marker 的 id 集合（批量加入分组时过滤掉）
const groupMarkerIds = computed(() => {
  return schemaStore.getGroupInfo.map((g) => g.id)
})

// 仅图片 id（用于加入分组；批量删除则包括分组）
const selectedImageIds = computed(() => {
  return props.selectedIds.filter((id) => !groupMarkerIds.value.includes(id))
})

const groupDialogShow = ref(false)
const selectedGroupIds = ref<string[]>([])
const groupIdAndNameLists = ref<Array<{ id: string; name: string }>>([])

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
  const imageIds = selectedImageIds.value
  if (imageIds.length > 0) {
    await batchDeleteImages(imageIds)
  }
  // 清除选中集
  selectStore.clear()
  markerService.refreshSelection()
  menuHidden()
}

function handleOpenGroupDialog() {
  if (selectedImageIds.value.length === 0) {
    menuHidden()
    return
  }
  selectedGroupIds.value = []
  groupIdAndNameLists.value = getGroupIdAndNameLists()
  groupDialogShow.value = true
  menuHidden()
}

async function confirmAddGroup() {
  if (selectedGroupIds.value.length === 0) return
  await batchAddImagesToGroups(selectedImageIds.value, selectedGroupIds.value)
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
