<template>
  <el-table ref="innerTableRef" :data="data" highlight-current-row show-overflow-tooltip height="50vh"
    @current-change="handleCurrentChange" :row-style="{ height: '35px' }" :row-class-name="tableRowClassName">
    <el-table-column prop="name" :label="$t('name')" width="150" />
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
    <el-table-column :label="$t('actions')" width="80">
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

type TrackData = {
  id: string
  name?: string
  distance?: string
  startTime?: string
  endTime?: string
  uploaded?: boolean
  file?: File | null
  groupIds?: string[]
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
}>()

const innerTableRef = ref<any>(null)

function setCurrentRow(row: TrackData | null) {
  innerTableRef.value?.setCurrentRow(row)
}

function handleCurrentChange(row: TrackData | null) {
  emit('row-change', row)
}

function tableRowClassName({ row }: { row: TrackData }) {
  return props.currentRowId === row.id ? 'current-row-highlight' : ''
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
</style>

<style>
.track-group-select-popper.el-popper {
  z-index: 3000 !important;
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16);
}
</style>
