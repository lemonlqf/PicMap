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
  color: #303133;
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-play-subtitle {
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 12px;
  color: #409eff;
  background: rgba(64, 158, 255, 0.12);
  border-radius: 4px;
}

.video-close-btn {
  margin-left: auto;
  font-size: 20px;
  color: #606266;
  cursor: pointer;
  border-radius: 6px;
  padding: 6px;
  transition: background 0.2s, color 0.2s;
}

.video-close-btn:hover {
  color: #303133;
  background: rgba(0, 0, 0, 0.06);
}

.video-play-body {
  position: relative;
  width: 100%;
  height: 70vh;
  background: radial-gradient(circle at 50% 40%, #2b2f36 0%, #14161a 100%);
  overflow: hidden;
}
</style>

<style lang="scss">
/* 浅色毛玻璃弹框：半透明背景 + 模糊，与轨迹视频弹框风格统一（EP 2.9+ padding 在根元素上） */
.el-dialog.video-play-dialog {
  --el-dialog-bg-color: transparent;
  --el-dialog-padding-primary: 0;

  z-index: 99999;
  padding: 0;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);

  .el-dialog__header {
    padding: 0;
    margin: 0;
    background: rgba(255, 255, 255, 0.5);
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .el-dialog__body {
    padding: 0;
    background: transparent;
  }
}
</style>
