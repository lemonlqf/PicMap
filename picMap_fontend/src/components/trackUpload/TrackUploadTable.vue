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
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { ColorPicker } from 'vue3-colorpicker'
import { Edit } from '@element-plus/icons-vue'
import 'vue3-colorpicker/style.css'

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
  (e: 'name-change', row: any, newName: string): void
}>()

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
</style>

<style>
.track-group-select-popper.el-popper {
  z-index: 3000 !important;
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
}
</style>
