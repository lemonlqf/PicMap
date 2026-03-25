<!--
 * @Author: Do not edit
 * @Date: 2026-03-19 10:46:16
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-25 19:10:04
 * @FilePath: \PicMap\picMap_fontend\src\components\trackUpload\TrackUploadDialog.vue
 * @Description: 轨迹上传弹窗组件
-->
<template>
  <el-dialog :append-to-body="true" :z-index="1000" v-model="dialogVisible" :title="$t('uploadTrack')" width="80vw"
    height="80vh" :before-close="handleBeforeClose">
    <div class="track-upload-content">
      <div class="input-search-box">
        <!-- 搜索框 -->
        <el-input v-model="searchKeyword" :placeholder="$t('description.searchPlaceholder')" clearable
          class="search-input" />
        <!-- 轨迹文件上传组件 -->
        <el-upload accept=".gpx" :auto-upload="false" :on-change="handleTrackFileChange" :file-list="trackFileList"
          :on-remove="handleFileRemove" :show-file-list="false">
          <el-button type="primary">{{ $t('selectFile') }}</el-button>
        </el-upload>
      </div>
      <div class="content-box">
        <TrackUploadTable ref="tableRef" class="table" :data="filteredTableData" :group-list="groupList"
          :current-row-id="currentRow?.id" @row-change="handleRowChange" @group-change="handleGroupChange"
          @upload-row="uploadRow" @delete-row="deleteRow" @color-change="handleColorChange" />
        <div class="track-map-container">
          <!-- 地图组件，用于显示轨迹 -->
          <MapComponent ref="trackMapRef" :track-ids="activeTrackIds"></MapComponent>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch, nextTick, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import trackService from '@/services/track'
import { updateTrackSchema, deleteTrackFromSchema, formatTrackInfo, formatDistance, getDefaultLineColor } from '@/utils/track'
import { formatDate } from '@/utils/date'
import MapComponent from '@/components/map/Map.vue'
import TrackUploadTable from './TrackUploadTable.vue'
import { useSchemaStore } from '@/store/schema'
import type { ITrackInfo } from '@/type/schema'
import { getGroupIdAndNameLists, updateGroupInfoToSchema } from '@/utils/group'
import { editSchemaAttrAndSave } from '@/utils/schema'

const { t } = useI18n()
const schemaStore = useSchemaStore()

// 弹窗可见性
const dialogVisible = defineModel<boolean>('modelValue', { required: true })

// 上传组件的文件列表
const trackFileList = ref<any[]>([])
// 地图组件引用
const trackMapRef = ref<any>(null)
// 当前选中的行数据
const currentRow = ref<TrackData | null>(null)
// 当前地图应显示的轨迹ID
const activeTrackIds = ref<string[]>([])
// 表格组件引用
const tableRef = ref<any>(null)
// 搜索关键词
const searchKeyword = ref('')

const groupList = computed(() => {
  const res = getGroupIdAndNameLists();
  return res
})

// 过滤后的表格数据
const filteredTableData = computed(() => {
  if (!searchKeyword.value) {
    return tableData.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return tableData.value.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(keyword)
    const startTimeMatch = item.startTime.toString().toLowerCase().includes(keyword)
    const endTimeMatch = item.endTime.toString().toLowerCase().includes(keyword)
    return nameMatch || startTimeMatch || endTimeMatch
  })
})

// 监听弹窗打开/关闭
watch(dialogVisible, (val) => {
  if (val) {
    // 弹窗打开时从schema加载已保存的轨迹数据
    loadTableDataFromSchema()
  }
})

/**
 * @description: 从schema加载已上传的轨迹数据到表格
 */
function loadTableDataFromSchema() {
  const trackInfoList = schemaStore.getSchema.trackInfo || []
  const groupInfoList = schemaStore.getGroupInfo
  tableData.value = trackInfoList.map((trackInfo: ITrackInfo) => {
    const groupIds: string[] = []
    groupInfoList.forEach(group => {
      if (group.trackNumbers?.includes(trackInfo.id)) {
        groupIds.push(group.id)
      }
    })
    return {
      ...formatTrackInfo(trackInfo),
      uploaded: true,
      file: null,
      groupIds,
      setting: {
        lineColor: getDefaultLineColor(),
        ...trackInfo.setting
      }
    }
  })
  // 如果有数据，自动选中第一行并加载轨迹到地图
  if (tableData.value.length > 0) {
    nextTick(() => {
      const firstRow = tableData.value[0]
      currentRow.value = firstRow
      activeTrackIds.value = [firstRow.id]
      tableRef.value?.setCurrentRow(firstRow)
    })
  } else {
    activeTrackIds.value = []
  }
}

// 表格数据类型定义
type TrackData = {
  id: string
  name: string
  distance: string
  startTime: string
  endTime: string
  uploaded: boolean
  file: File | null
  [key: string]: any
}

// 表格数据
const tableData = ref<TrackData[]>([])

/**
 * @description: 处理表格行选中事件，选中已上传的轨迹时加载到地图
 */
async function handleRowChange(row: TrackData | null) {
  currentRow.value = row
  // 仅通过trackIds驱动地图轨迹显示
  activeTrackIds.value = row && (row.file || row.uploaded) ? [row.id] : []
}

/**
 * @description: 处理文件选择事件，将选择的文件添加到表格
 */
async function handleTrackFileChange(file: any) {
  if (file.raw) {
    const trackInstance = trackService.activeTrack(file.raw)
    const id = trackInstance.getTrackId()

    // 检查schema中是否已存在该轨迹
    const existingTrack = schemaStore.getSchema.trackInfo?.find((track: any) => track.id === id)

    // 如果已存在，提示用户确认
    if (existingTrack) {
      try {
        await ElMessageBox.confirm(
          t('description.trackExistConfirm'),
          t('description.warning'),
          {
            confirmButtonText: t('confirm'),
            cancelButtonText: t('cancel'),
            type: 'warning'
          }
        )
      } catch {
        // 用户取消选择，从trackService中移除该实例
        trackService.deleteTrack(id)
        return
      }
    }

    // 检查该trackId是否已在表格中存在（针对已上传的行）
    const existingRow = tableData.value.find(item => item.id === id && item.uploaded)

    if (existingRow) {
      // 如果已存在，用新文件数据更新该行，保留setting
      existingRow.file = file.raw
      existingRow.uploaded = false
      currentRow.value = existingRow
      nextTick(() => {
        tableRef.value?.setCurrentRow(existingRow)
      })
    } else {
      // 如果不存在，创建新行
      const rowId = `${id}`
      const newRow: TrackData = {
        id: rowId,
        name: file.name,
        distance: '-',
        startTime: '-',
        endTime: '-',
        uploaded: false,
        file: file.raw,
        setting: {
          lineColor: getDefaultLineColor(),
          ...existingTrack?.setting
        },
      }
      tableData.value.unshift(newRow)
      currentRow.value = newRow
      activeTrackIds.value = [newRow.id]
      nextTick(() => {
        tableRef.value?.setCurrentRow(newRow)
      })
    }

    if (existingRow) {
      activeTrackIds.value = [existingRow.id]
    }

    // 等待轨迹信息加载完成后更新表格数据和适配边界
    trackInstance.onTrackInfoReady((trackInfo: any) => {
      const row = existingRow || tableData.value.find(item => item.id === id && !item.uploaded)
      if (row) {
        row.name = trackInfo.name || id
        row.distance = formatDistance(trackInfo.distance) || '-'
        row.startTime = trackInfo.startTime ? formatDate(trackInfo.startTime) : '-'
        row.endTime = trackInfo.endTime ? formatDate(trackInfo.endTime) : '-'
      }
      // 轨迹信息加载完成后适配边界
      setTimeout(() => {
        trackMapRef.value?.fitAllBounds()
        trackMapRef.value?.getMapInstance()?.invalidateSize()
      }, 100)
    })
  }
}

/**
 * @description: 处理文件从上传列表中移除事件
 */
function handleFileRemove(file: any) {
  const row = tableData.value.find(item => item.file === file.raw)
  if (row) {
    const wasSelected = currentRow.value?.id === row.id
    tableData.value = tableData.value.filter(item => item.id !== row.id)
    // 如果移除的是选中行，选中新的第一行
    if (wasSelected && tableData.value.length > 0) {
      const newSelectedRow = tableData.value[0]
      currentRow.value = newSelectedRow
      activeTrackIds.value = [newSelectedRow.id]
      nextTick(() => {
        tableRef.value?.setCurrentRow(newSelectedRow)
      })
    } else if (wasSelected) {
      activeTrackIds.value = []
    }
  }
}

/**
 * @description: 上传轨迹到后端
 */
async function uploadRow(row: TrackData) {
  if (!row.file) {
    ElMessage.warning(t('description.selectFileFirst'))
    return
  }

  const fileToRemove = row.file
  try {
    const res = await trackService.uploadTrack(row.file)
    if (res.code === 200) {
      // 更新schema中的轨迹信息
      await updateTrackSchema(row.id)
      // 如果行数据中有颜色设置，则保存到schema
      if (row.setting?.lineColor) {
        const trackInfoList = [...(schemaStore.getSchema.trackInfo || [])]
        const trackIndex = trackInfoList.findIndex((track: any) => track.id === row.id)
        if (trackIndex >= 0) {
          if (!trackInfoList[trackIndex].setting) {
            trackInfoList[trackIndex].setting = {}
          }
          trackInfoList[trackIndex].setting!.lineColor = row.setting.lineColor
          await editSchemaAttrAndSave('trackInfo', trackInfoList)
        }
      }
      row.uploaded = true
      row.file = null
      // 从上传列表中移除已上传的文件
      trackFileList.value = trackFileList.value.filter(item => item.raw !== fileToRemove)
      ElMessage.success(t('description.trackUploadedSuccess'))
    }
  } catch (error) {
    console.error('上传轨迹失败:', error)
    ElMessage.error(t('description.uploadFailed'))
  }
}

/**
 * @description: 删除已上传的轨迹
 */
async function deleteRow(row: TrackData) {
  try {
    // 从schema和后端删除轨迹
    await deleteTrackFromSchema(row.id)
    tableData.value = tableData.value.filter(item => item.id !== row.id)
    // 如果删除的是选中行，选中新的第一行
    if (currentRow.value?.id === row.id && tableData.value.length > 0) {
      const newSelectedRow = tableData.value[0]
      currentRow.value = newSelectedRow
      activeTrackIds.value = [newSelectedRow.id]
      nextTick(() => {
        tableRef.value?.setCurrentRow(newSelectedRow)
      })
    } else if (currentRow.value?.id === row.id) {
      activeTrackIds.value = []
    }
    ElMessage.success(t('description.deleteSuccess'))
  } catch (error) {
    console.error('删除轨迹失败:', error)
    ElMessage.error(t('description.deleteFailed'))
  }
}

/**
 * @description: 处理轨迹分组变化
 */
async function handleGroupChange(row: TrackData) {
  try {
    const groupInfoList = schemaStore.getGroupInfo
    const selectedGroupIds = row.groupIds || []

    for (const group of groupInfoList) {
      const hasTrack = group.trackNumbers?.includes(row.id) || false
      const isSelected = selectedGroupIds.includes(group.id)

      if (hasTrack && !isSelected) {
        group.trackNumbers = group.trackNumbers?.filter(id => id !== row.id) || []
        await updateGroupInfoToSchema(group.id, group)
      } else if (!hasTrack && isSelected) {
        if (!group.trackNumbers) {
          group.trackNumbers = []
        }
        group.trackNumbers.push(row.id)
        await updateGroupInfoToSchema(group.id, group)
      }
    }
    ElMessage.success(t('description.updateSuccess'))
  } catch (error) {
    console.error('更新轨迹分组失败:', error)
    ElMessage.error(t('description.updateFailed'))
  }
}

/**
 * @description: 处理轨迹颜色变化
 * 当用户在颜色选择器中选择新颜色时调用，同时保存到schema并更新地图上轨迹的颜色
 * @param {TrackData} row - 轨迹行数据，包含id和setting.lineColor
 */
async function handleColorChange(row: TrackData) {
  try {
    const trackInfoList = [...(schemaStore.getSchema.trackInfo || [])]
    const trackIndex = trackInfoList.findIndex((track: any) => track.id === row.id)
    if (trackIndex >= 0) {
      if (!trackInfoList[trackIndex].setting) {
        trackInfoList[trackIndex].setting = {}
      }
      trackInfoList[trackIndex].setting!.lineColor = row.setting?.lineColor
      // 保存到schema持久化
      await editSchemaAttrAndSave('trackInfo', trackInfoList)
    }
    // 更新地图上轨迹的颜色
    trackService.updateTrackColor(row.id, row.setting?.lineColor || '')
  } catch (error) {
    console.error('更新轨迹颜色失败:', error)
    ElMessage.error(t('description.updateFailed'))
  }
}

/**
 * @description: 关闭弹窗前检查是否有未上传的数据
 */
async function handleBeforeClose(done: () => void) {
  const hasUnuploadedData = tableData.value.some(row => !row.uploaded)
  if (hasUnuploadedData) {
    try {
      await ElMessageBox.confirm(
        t('description.closeUploadTrackConfirm'),
        t('description.warning'),
        {
          confirmButtonText: t('confirm'),
          cancelButtonText: t('cancel'),
          type: 'warning'
        }
      )
      resetState()
      done()
    } catch {
      // 用户取消，阻止关闭
    }
  } else {
    resetState()
    done()
  }
}

/**
 * @description: 重置弹窗状态
 */
function resetState() {
  trackFileList.value = []
  searchKeyword.value = ''
  activeTrackIds.value = []
  tableData.value = tableData.value.filter(row => row.uploaded)
}
</script>

<style scoped>
.track-upload-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.input-search-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  margin-bottom: 10px;
}

.content-box {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.table {
  flex: 0 0 58%;
  min-width: 560px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 8px;
}

.search-input {
  margin-bottom: 0;
  width: 300px;
}

.track-file-name {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  color: #409eff;
}

.track-map-container {
  flex: 1 1 42%;
  min-width: 320px;
  overflow: hidden;
  height: 54vh;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}

:deep(.current-row-highlight>td) {
  background-color: #66b1ff !important;
  color: #fff !important;
}

@media (max-width: 1280px) {
  .content-box {
    flex-direction: column;
  }

  .table,
  .track-map-container {
    min-width: 0;
    width: 100%;
  }

  .track-map-container {
    height: 42vh;
    margin-top: 0;
  }
}
</style>