<template>
  <el-table ref="innerTableRef" :data="data" highlight-current-row show-overflow-tooltip max-height="50vh"
    @current-change="handleCurrentChange" :row-style="{ height: '35px' }" :row-class-name="tableRowClassName">
    <el-table-column :label="$t('name')" width="150" fixed="left">
      <template #default="{ row }">
        <div class="name-cell">
          <el-input
            v-if="editingRowId === row.id"
            v-model="editingName"
            size="small"
            @keyup.enter="confirmRename(row)"
            @blur="confirmRename(row)"
            @keyup.escape="cancelRename"
          />
          <span v-else class="track-name" @dblclick="startRename(row)">{{ row.name }}</span>
          <el-icon class="edit-icon" @click="startRename(row)"><Edit /></el-icon>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="distance" :label="$t('distance')" width="100" />
    <el-table-column prop="startTime" :label="$t('startTime')" width="160" />
    <el-table-column prop="endTime" :label="$t('endTime')" width="160" />
    <el-table-column :label="$t('group')" width="200">
      <template #default="{ row }">
        <el-select v-if="row.uploaded" v-model="row.groupIds" multiple collapse-tags collapse-tags-limit="1"
          popper-class="track-group-select-popper" append-to="body" :placeholder="$t('placeholder.selectGroup')"
          class="track-group-select" size="small" @change="emit('group-change', row)">
          <el-option v-for="group in groupList" :key="group.id" :label="group.name" :value="group.id">
            {{ group.name }}
          </el-option>
        </el-select>
        <span v-else>-</span>
      </template>
    </el-table-column>
    <el-table-column :label="$t('trackColor')" width="100">
      <template #default="{ row }">
        <div class="color-picker-wrapper">
          <ColorPicker :pureColor="row.setting?.lineColor"
            @update:pureColor="(color: string) => { if (!row.setting) row.setting = {}; row.setting.lineColor = color; emit('color-change', row) }" />
        </div>
      </template>
    </el-table-column>
    <el-table-column :label="$t('icon.startIcon')" width="64" align="center">
      <template #default="{ row }">
        <el-tooltip :content="$t('icon.startIcon')" placement="top">
          <div v-if="row.uploaded" class="edge-icon" @click="openIconSelect(row, 'start')">
            <img v-if="edgeIconUrl(row, 'start')" :src="edgeIconUrl(row, 'start')" alt="" />
            <span v-else class="edge-icon-empty">-</span>
          </div>
          <span v-else>-</span>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column :label="$t('icon.endIcon')" width="64" align="center">
      <template #default="{ row }">
        <el-tooltip :content="$t('icon.endIcon')" placement="top">
          <div v-if="row.uploaded" class="edge-icon" @click="openIconSelect(row, 'end')">
            <img v-if="edgeIconUrl(row, 'end')" :src="edgeIconUrl(row, 'end')" alt="" />
            <span v-else class="edge-icon-empty">-</span>
          </div>
          <span v-else>-</span>
        </el-tooltip>
      </template>
    </el-table-column>
    <el-table-column :label="$t('track.showOnMainMap')" width="120" align="center">
      <template #default="{ row }">
        <el-switch v-if="row.uploaded" :model-value="row.setting?.showOnMainMap"
          @change="(val: string | number | boolean) => { if (!row.setting) row.setting = {}; row.setting.showOnMainMap = !!val; emit('main-map-change', row) }" />
        <span v-else>-</span>
      </template>
    </el-table-column>
    <el-table-column :label="$t('actions')" width="80" fixed="right">
      <template #default="{ row }">
        <el-button v-if="!row.uploaded" type="primary" size="small" @click="emit('upload-row', row)">
          {{ $t('upload') }}
        </el-button>
        <el-button v-else type="danger" size="small" @click="emit('delete-row', row)">
          {{ $t('delete') }}
        </el-button>
      </template>
    </el-table-column>
  </el-table>
  <IconSelector v-model:visible="iconSelectorVisible" category="track" :current-id="iconSelectorCurrentId"
    :title="iconSelectorTitle" @select="handleIconSelect" @closed="iconTarget = null" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { ColorPicker } from 'vue3-colorpicker'
import { Edit } from '@element-plus/icons-vue'
import 'vue3-colorpicker/style.css'
import IconSelector from '@/components/iconSelector/IconSelector.vue'
import { getIconItemById, resolveIconUrl } from '@/utils/icon'
import type { IIconItem } from '@/type/appSchema'

type TrackData = {
  id: string
  name?: string
  distance?: string
  startTime?: string
  endTime?: string
  uploaded?: boolean
  file?: File | null
  groupIds?: string[]
  setting?: {
    lineColor?: string
    showOnMainMap?: boolean
    startIconId?: string
    endIconId?: string
  }
  [key: string]: any
}

type GroupItem = {
  id: string
  name: string
}

const props = defineProps<{
  data: TrackData[]
  groupList: GroupItem[]
  currentRowId?: string
}>()

const emit = defineEmits<{
  (e: 'row-change', row: any): void
  (e: 'upload-row', row: any): void
  (e: 'delete-row', row: any): void
  (e: 'group-change', row: any): void
  (e: 'color-change', row: any): void
  (e: 'main-map-change', row: any): void
  (e: 'icon-change', row: any, type: 'start' | 'end', iconId: string): void
  (e: 'name-change', row: any, newName: string): void
}>()

// 图标选择弹窗状态
const iconSelectorVisible = ref(false)
const iconSelectorCurrentId = ref('')
const iconSelectorTitle = ref('')
const iconTarget = ref<{ row: TrackData; type: 'start' | 'end' } | null>(null)
// 图标 URL 缓存：key = row.id + type，值 = resolved url
const iconUrlCache = ref<Record<string, string>>({})

function openIconSelect(row: TrackData, type: 'start' | 'end') {
  iconTarget.value = { row, type }
  iconSelectorTitle.value = type === 'start' ? '起点图标' : '终点图标'
  const iconId = type === 'start' ? row.setting?.startIconId : row.setting?.endIconId
  iconSelectorCurrentId.value = iconId || ''
  iconSelectorVisible.value = true
  // 预加载当前选中图标的 URL
  if (iconId) {
    resolveIconUrl(iconId, 'track').then((url) => {
      if (url) iconUrlCache.value[`${row.id}_${type}`] = url
    })
  }
}

function handleIconSelect(item: IIconItem) {
  const target = iconTarget.value
  if (!target) return
  const { row, type } = target
  if (!row.setting) row.setting = {}
  if (type === 'start') {
    row.setting.startIconId = item.id
  } else {
    row.setting.endIconId = item.id
  }
  iconUrlCache.value[`${row.id}_${type}`] = item.url
  emit('icon-change', row, type, item.id)
}

function edgeIconUrl(row: TrackData, type: 'start' | 'end') {
  const iconId = type === 'start' ? row.setting?.startIconId : row.setting?.endIconId
  if (!iconId) return ''
  const cached = iconUrlCache.value[`${row.id}_${type}`]
  if (cached) return cached
  // 预设图标直接从库中取 URL（同步）
  const presetItem = getIconItemById(iconId, 'track')
  if (presetItem?.source === 'preset') {
    return presetItem.url
  }
  // 自定义图标异步解析后缓存
  resolveIconUrl(iconId, 'track').then((url) => {
    if (url) iconUrlCache.value[`${row.id}_${type}`] = url
  })
  return ''
}

const innerTableRef = ref<any>(null)
const editingRowId = ref<string | null>(null)
const editingName = ref('')

function setCurrentRow(row: TrackData | null) {
  innerTableRef.value?.setCurrentRow(row)
}

function handleCurrentChange(row: TrackData | null) {
  emit('row-change', row)
}

function tableRowClassName({ row }: { row: TrackData }) {
  return props.currentRowId === row.id ? 'current-row-highlight' : ''
}

function startRename(row: TrackData) {
  editingRowId.value = row.id
  editingName.value = row.name || ''
}

function confirmRename(row: TrackData) {
  if (editingName.value.trim() && editingName.value !== row.name) {
    emit('name-change', row, editingName.value.trim())
  }
  cancelRename()
}

function cancelRename() {
  editingRowId.value = null
  editingName.value = ''
}

defineExpose({
  setCurrentRow
})
</script>

<style scoped>
:deep(.track-group-select) {
  width: 100%;
}

:deep(.track-group-select .el-select__wrapper) {
  min-height: 28px;
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
}

.track-name {
  cursor: pointer;
}

.track-name:hover {
  color: #637141;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.name-cell .track-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-cell .edit-icon {
  opacity: 0;
  cursor: pointer;
  color: #909399;
  transition: opacity 0.2s;
}

.name-cell:hover .edit-icon {
  opacity: 1;
}

.name-cell .edit-icon:hover {
  color: #637141;
}

.edge-icon {
  width: 32px;
  height: 32px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;

  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  &:hover {
    border-color: #542de2;
  }
}

.edge-icon-empty {
  color: #909399;
  font-size: 14px;
}
</style>

<style>
.track-group-select-popper.el-popper {
  z-index: 3000 !important;
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
}
</style>
