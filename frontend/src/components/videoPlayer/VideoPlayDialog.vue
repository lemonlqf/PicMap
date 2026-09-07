<!--
 * @Description: 视频播放弹窗（居中的 el-dialog）
 * - 根据视频 isPanorama 分流：全景 → PanoramaVideoViewer；普通 → VideoPlayer（video.js）
 * - 关闭时销毁播放器并 revoke 共享 objectURL，避免内存泄漏
 * - 采用暗色无边框样式，右上角提供关闭按钮
 -->
<template>
  <el-dialog :model-value="visible" append-to-body :close-on-click-modal="true" :show-close="false"
    :destroy-on-close="false" top="5vh" width="80vw" class="video-play-dialog"
    @update:model-value="onVisibleChange" @close="handleClose">
    <template #header>
      <div class="video-play-header">
        <span class="video-play-title" :title="videoName">{{ videoName || '视频预览' }}</span>
        <span class="video-play-subtitle">{{ isPanoramaVideo ? '全景视频' : '视频' }}</span>
        <el-icon class="video-close-btn" @click="closeDialog">
          <Close />
        </el-icon>
      </div>
    </template>
    <div v-if="visible && videoId" class="video-play-body">
      <PanoramaVideoViewer v-if="isPanoramaVideo" :key="videoId" :video-id="videoId" />
      <VideoPlayer v-else :key="videoId" :video-id="videoId" />
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { Close } from '@element-plus/icons-vue'
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
const videoName = computed(() => getVideoInfoById(props.videoId)?.name || '')

function onVisibleChange(v: boolean) {
  emit('update:visible', v)
}

function closeDialog() {
  emit('update:visible', false)
}

function handleClose() {
  // 释放该视频缓存的 objectURL，避免大视频驻留内存
  if (props.videoId) revokeVideoObjectUrl(props.videoId)
  emit('update:visible', false)
}
</script>

<style scoped>
.video-play-header {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 16px;
}

.video-play-title {
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-play-subtitle {
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 12px;
  color: #bcc0c4;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 4px;
}

.video-close-btn {
  margin-left: auto;
  font-size: 20px;
  color: #d0d0d0;
  cursor: pointer;
  border-radius: 6px;
  padding: 6px;
  transition: background 0.2s, color 0.2s;
}

.video-close-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
}

.video-play-body {
  width: 100%;
  height: 70vh;
  background: #000;
  position: relative;
  overflow: hidden;
}
</style>

<style lang="scss">
/* 暗色无边框弹框：覆盖 el-dialog 根元素自带的白色背景与内边距（EP 2.9+ padding 在根元素上） */
.el-dialog.video-play-dialog {
  --el-dialog-bg-color: transparent;
  --el-dialog-padding-primary: 0;

  z-index: 99999;
  padding: 0;
  background: transparent;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);

  .el-dialog__header {
    padding: 0;
    margin: 0;
    background: #1f2124;
  }

  .el-dialog__body {
    padding: 0;
    background: #000;
  }
}
</style>
