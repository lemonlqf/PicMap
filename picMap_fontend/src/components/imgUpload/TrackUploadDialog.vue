<!--
 * @Author: Do not edit
 * @Date: 2026-03-19 10:46:16
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-23 12:56:57
 * @FilePath: \PicMap\picMap_fontend\src\components\imgUpload\TrackUploadDialog.vue
 * @Description: 轨迹上传弹窗组件
-->
<template>
  <el-dialog :append-to-body="true" :z-index="9999" v-model="dialogVisible" :title="$t('uploadTrack')" width="80vw" height="80vh">
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
        <div class="table">
          <!-- 轨迹信息表格，支持单选 highlight-current-row -->
          <el-table :data="filteredTableData" highlight-current-row show-overflow-tooltip height="50vh"
            @current-change="handleRowChange" ref="tableRef" :row-style="{ height: '35px' }" :row-class-name="tableRowClassName">
            <el-table-column prop="name" :label="$t('name')" width="150" />
            <el-table-column prop="distance" :label="$t('distance')" width="100" />
            <el-table-column prop="startTime" :label="$t('startTime')" width="160" />
            <el-table-column prop="endTime" :label="$t('endTime')" width="160" />
            <el-table-column :label="$t('actions')" width="80">
              <template #default="{ row }">
                <!-- 未上传的行显示上传按钮，已上传的行显示删除按钮 -->
                <el-button v-if="!row.uploaded" type="primary" size="small" @click="uploadRow(row)">{{ $t('upload')
                  }}</el-button>
                <el-button v-else type="danger" size="small" @click="deleteRow(row)">{{ $t('delete') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="track-map-container">
          <!-- 地图组件，用于显示轨迹 -->
          <MapComponent ref="trackMapRef"></MapComponent>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, watch, nextTick, computed } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import trackService from '@/services/track'
import { updateTrackSchema, deleteTrackFromSchema, formatTrackInfo, formatDistance } from '@/utils/track'
import { formatDate } from '@/utils/date'
import mapService from '@/services/map'
import trackApi from '@/http/modules/track'
import MapComponent from '@/components/map/Map.vue'
import { useSchemaStore } from '@/store/schema'
import type { ITrackInfo } from '@/type/schema'

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
// 表格组件引用
const tableRef = ref<any>(null)
// 搜索关键词
const searchKeyword = ref('')

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
  tableData.value = trackInfoList.map((trackInfo: ITrackInfo) => ({
    ...formatTrackInfo(trackInfo),
    uploaded: true,
    file: null
  }))
  // 如果有数据，自动选中第一行并加载轨迹到地图
  if (tableData.value.length > 0) {
    nextTick(() => {
      const firstRow = tableData.value[0]
      currentRow.value = firstRow
      tableRef.value?.setCurrentRow(firstRow)
      if (firstRow.uploaded) {
        loadTrackToMap(firstRow)
      }
    })
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

// 表格行样式类名，当前选中行更显眼
function tableRowClassName({ row }: { row: TrackData }) {
  return currentRow.value?.id === row.id ? 'current-row-highlight' : ''
}

/**
 * @description: 处理表格行选中事件，选中已上传的轨迹时加载到地图
 */
async function handleRowChange(row: TrackData | null) {
  currentRow.value = row
  // 当选中行有文件（未上传）或者已上传时，都在地图上显示轨迹
  if (row && (row.file || row.uploaded)) {
    await loadTrackToMap(row)
  }
}

/**
 * @description: 从后端加载轨迹文件并在地图上显示
 */
async function loadTrackToMap(row: TrackData) {
  try {
    const mapInstance = trackMapRef.value?.getMapInstance()
    if (!mapInstance) {
      console.error('mapInstance is undefined or null')
      return
    }

    console.log('loadTrackToMap row.id:', row.id, 'mapInstance:', mapInstance)

    // 不清除轨迹实例，而是隐藏原来有的轨迹实例
    trackService.hideAllTracks(mapInstance)

    // 根据id获取轨迹实例，如果有的话，将轨迹实例添加到地图上，如果没有实例的话则请求后端
    const existingInstance = trackService.getTrackInstanceById(row.id)
    console.log('existingInstance:', existingInstance)
    if (existingInstance) {
      console.log('calling existingInstance.addMap with mapInstance:', mapInstance)
      existingInstance.addMap(mapInstance)
      setTimeout(() => {
        trackMapRef.value?.fitAllBounds()
        mapInstance.invalidateSize()
      }, 100)
      return
    }

    // 从后端获取轨迹文件
    const res = await trackApi.getTrack(row.id)
    if (res.code === 200 && res.data.fileContent) {
      const gpxContent = res.data.fileContent
      const blob = new Blob([gpxContent], { type: 'application/gpx+xml' })
      const fileName = row.id.includes('.gpx') ? row.id : `${row.id}.gpx`
      const file = new File([blob], fileName, { type: 'application/gpx+xml' })
      const trackInstance = trackService.activeTrack(file, mapInstance)
      // 等待轨迹信息加载完成后适配边界
      trackInstance.onTrackInfoReady(() => {
        setTimeout(() => {
          trackMapRef.value?.fitAllBounds()
          mapInstance.invalidateSize()
        }, 100)
      })
    }
  } catch (error) {
    console.error('加载轨迹失败:', error)
    ElMessage.error(t('description.loadTrackFailed'))
  }
}

/**
 * @description: 处理文件选择事件，将选择的文件添加到表格
 */
async function handleTrackFileChange(file: any) {
  if (file.raw) {
    const mapInstance = trackMapRef.value?.getMapInstance()
    const trackInstance = trackService.activeTrack(file.raw, mapInstance)
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
      // 如果已存在，用新文件数据更新该行
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
      }
      tableData.value.unshift(newRow)
      currentRow.value = newRow
      nextTick(() => {
        tableRef.value?.setCurrentRow(newRow)
      })
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
        mapInstance?.invalidateSize()
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
      nextTick(() => {
        tableRef.value?.setCurrentRow(newSelectedRow)
      })
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
      nextTick(() => {
        tableRef.value?.setCurrentRow(newSelectedRow)
      })
    }
    ElMessage.success(t('description.deleteSuccess'))
  } catch (error) {
    console.error('删除轨迹失败:', error)
    ElMessage.error(t('description.deleteFailed'))
  }
}

/**
 * @description: 关闭弹窗，重置状态
 */
function cancel() {
  dialogVisible.value = false
  trackFileList.value = []
  searchKeyword.value = ''
  // 清空弹窗地图上的所有轨迹（保留实例）
  const mapInstance = trackMapRef.value?.getMapInstance()
  if (mapInstance) {
    trackService.hideAllTracks(mapInstance)
  }
  // 只保留已上传的数据
  tableData.value = tableData.value.filter(row => row.uploaded)
}
</script>

<style scoped>
.track-upload-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  /* width: 100%; */
}

.input-search-box {
  display: flex;
  gap: 20px;
}

.content-box {
  display: flex;
  gap: 20px;
  flex: 1;
}

.table {
  /* flex: 1; */
  overflow-y: auto;
}

.search-input {
  margin-bottom: 10px;
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
  flex: 1;
  overflow: hidden;
  height: 48vh;
  margin-top: 15px;
}

:deep(.current-row-highlight>td) {
  background-color: #66b1ff !important;
  color: #fff !important;
}
</style>