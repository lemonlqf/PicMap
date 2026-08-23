<!--
 * @Author: Do not edit
 * @Date: 2026-03-27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-27 18:45:37
 * @FilePath: \PicMap\picMap_fontend\src\components\trackUpload\index.vue
 * @Description: 轨迹上传组件，包含上传轨迹按钮和弹框
-->
<template>
  <div class="track-upload">
    <el-button :title="$t('trackManagement')" class="upload-track-button" circle type="primary"
      @click="dialogVisible = true">
      <TrackIcon style="height: 20px; width: 20px; color: white" />
    </el-button>
    <TrackUploadDialog v-model="dialogVisible"></TrackUploadDialog>
    <el-button :title="'上传轨迹视频'" class="upload-video-button" circle type="warning"
      @click="videoDialogVisible = true">
      <el-icon style="height: 20px; width: 20px; color: white"><VideoCamera /></el-icon>
    </el-button>
    <VideoUploadDialog v-model="videoDialogVisible"></VideoUploadDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { VideoCamera } from '@element-plus/icons-vue'
import TrackIcon from '@/assets/icon/轨迹.svg?component'
import TrackUploadDialog from './TrackUploadDialog.vue'
import VideoUploadDialog from './VideoUploadDialog.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const dialogVisible = ref(false)
const videoDialogVisible = ref(false)
</script>

<style lang="scss" scoped>
.track-upload {
  display: flex;
  gap: 8px;
}
</style>
