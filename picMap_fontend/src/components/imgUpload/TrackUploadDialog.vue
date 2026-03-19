<!--
 * @Author: Do not edit
 * @Date: 2026-03-19 10:46:16
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-19 17:00:25
 * @FilePath: \PicMap\picMap_fontend\src\components\imgUpload\TrackUploadDialog.vue
 * @Description: 
-->
<template>
  <el-dialog :z-index="9999" v-model="dialogVisible" :title="$t('uploadTrack')" width="800px">
    <div class="track-upload-content">
      <el-upload accept=".gpx" :auto-upload="false" :limit="1" :on-change="handleTrackFileChange" :file-list="trackFileList">
        <el-button type="primary">{{ $t('selectFile') }}</el-button>
      </el-upload>
      <div v-if="uploadedTrackName" class="track-file-name">
        <el-icon><Document /></el-icon>
        <span>{{ uploadedTrackName }}</span>
      </div>
      <div class="track-map-container">
        <MapComponent ref="trackMapRef"></MapComponent>
      </div>
    </div>
    <el-button type="primary" @click="submitTrackUpload">{{ $t('upload') }}</el-button>
    <el-button @click="cancel">{{ $t('cancel') }}</el-button>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import trackService from '@/services/track'
import mapService from '@/services/map'
import MapComponent from '@/components/map/Map.vue'

const { t } = useI18n()

const dialogVisible = defineModel<boolean>('modelValue', { required: true })

const trackFileList = ref<any[]>([])
const uploadedTrackName = ref('')
const trackMapRef = ref<any>(null)
// 上传文件的提交数据
const uploadFormData = ref({
  trackId: '',
  trackFile: null as File | null
})

function handleTrackFileChange(file: any) {
  if (file.raw) {
    uploadedTrackName.value = file.name
    const mapInstance = trackMapRef.value?.getMapInstance()
    // 添加轨迹到地图上
    const trackInstance = trackService.activeTrack(file.raw, mapInstance)
    // 获取id
    uploadFormData.value.trackId = trackInstance.getTrackId()
    // 存储文件数据，后续可以用于提交到后端
    uploadFormData.value.trackFile = file.raw

    // 调整地图视图以适应轨迹
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize()
      }
    }, 100)
  }
}

function cancel() {
  dialogVisible.value = false
  // 清理上传数据
  trackFileList.value = []
  uploadedTrackName.value = ''
  // 重置上传表单数据
  uploadFormData.value = {
    trackId: '',
    trackFile: null
  }
  // 清理地图上的轨迹
  trackService.deleteTracksInMap(trackMapRef.value?.getMapInstance())
}

function submitTrackUpload() {
  // 提交轨迹上传
}
</script>

<style scoped>
.track-upload-content {
  display: flex;
  flex-direction: column;
  height: 100%;
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
  height: 500px;
  margin-top: 15px;
}
</style>