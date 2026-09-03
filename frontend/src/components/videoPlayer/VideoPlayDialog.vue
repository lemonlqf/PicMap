<!--
 * @Description: 视频播放弹窗（居中的 el-dialog）
 * - 根据视频 isPanorama 分流：全景 → PanoramaVideoViewer；普通 → VideoPlayer（video.js）
 * - 关闭时销毁播放器并 revoke 共享 objectURL，避免内存泄漏
-->
<template>
  <el-dialog :model-value="visible" append-to-body :close-on-click-modal="true" :show-close="true"
    :destroy-on-close="false" top="5vh" width="80vw" class="video-play-dialog"
    @update:model-value="onVisibleChange" @close="handleClose">
    <div v-if="visible && videoId" class="video-play-body">
      <PanoramaVideoViewer v-if="isPanoramaVideo" :key="videoId" :video-id="videoId" />
      <VideoPlayer v-else :key="videoId" :video-id="videoId" />
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import VideoPlayer from './VideoPlayer.vue'
import PanoramaVideoViewer from './PanoramaVideoViewer.vue'
import { getVideoInfoById } from '@/utils/schema'
import { revokeVideoObjectUrl } from '@/utils/videoBlob'

const props = defineProps<{
  visible: boolean
  videoId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const isPanoramaVideo = computed(() => !!getVideoInfoById(props.videoId)?.isPanorama)

function onVisibleChange(v: boolean) {
  emit('update:visible', v)
}

function handleClose() {
  // 释放该视频缓存的 objectURL，避免大视频驻留内存
  if (props.videoId) revokeVideoObjectUrl(props.videoId)
  emit('update:visible', false)
}
</script>

<style scoped>
.video-play-body {
  width: 100%;
  height: 70vh;
  background: #000;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}
</style>

<style lang="scss">
.video-play-dialog {
  z-index: 99999;
  background: rgba(0, 0, 0, 0.92);

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }
}
</style>
