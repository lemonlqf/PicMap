<!--
 * @Author: Do not edit
 * @Date: 2026-03-27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-27
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
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import TrackIcon from '@/assets/icon/轨迹.svg?component'
import TrackUploadDialog from './TrackUploadDialog.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const dialogVisible = ref(false)
</script>

<style lang="scss" scoped>
.track-upload {
  display: inline-block;
}

.upload-track-button {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
