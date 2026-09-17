<!--
 * @Description: 通用视频控制栏（播放/静音/音量/时间/进度/全屏）
 * - 纯展示 + 事件：不直接操作播放器，由父组件监听事件驱动底层实现（video.js / PSV）
 * - VideoPlayer 与 PanoramaVideoViewer 共用，保证控制栏逻辑与样式统一
 * - 预留 prev/next 插槽，供"上一个/下一个视频、自动播放等扩展
-->
<template>
  <div class="vp-controls" :class="{ 'vp-controls--hidden': !visible }">
    <!-- 上一项（扩展插槽，默认无） -->
    <slot name="prev"></slot>
    <!-- 播放/暂停：纯图形图标（无圆框），三角形播放 / 双竖条暂停 -->
    <el-icon class="vp-icon vp-play" :title="isPlaying ? '暂停' : '播放'" @click="emit('toggle-play')">
      <PauseIcon v-if="isPlaying" />
      <PlayIcon v-else />
    </el-icon>
    <!-- 音量：纯喇叭图标（无圆框） -->
    <el-icon class="vp-icon" :title="muted ? '取消静音' : '静音'" @click="emit('toggle-mute')">
      <MuteIcon v-if="muted || volume <= 0" />
      <VolumeIcon v-else />
    </el-icon>
    <el-slider :model-value="volume" class="vp-volume" :min="0" :max="1" :step="0.01" :show-tooltip="false"
      @input="handleVolumeInput" />
    <span class="vp-time">{{ formatTime(currentTime) }}</span>
    <el-slider class="vp-progress" :model-value="currentTime" :min="0" :max="duration || 0" :step="0.1"
      :disabled="!duration" :show-tooltip="false" @input="handleSeekInput" />
    <span class="vp-time">{{ formatTime(duration) }}</span>
    <!-- 附加控件（如自动播放下一个开关），位于全屏按钮左侧 -->
    <slot name="extra"></slot>
    <el-icon class="vp-icon" :title="isFullscreen ? '退出全屏' : '全屏'" @click="emit('toggle-fullscreen')">
      <FullScreen />
    </el-icon>
    <!-- 下一项（扩展插槽，默认无） -->
    <slot name="next"></slot>
  </div>
</template>

<script lang="ts" setup>
import { FullScreen } from '@element-plus/icons-vue'
import PlayIcon from '@/assets/icon/视频播放.svg?component'
import PauseIcon from '@/assets/icon/视频暂停.svg?component'
import VolumeIcon from '@/assets/icon/音量.svg?component'
import MuteIcon from '@/assets/icon/静音.svg?component'

withDefaults(defineProps<{
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  isFullscreen: boolean
  visible?: boolean
}>(), {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  isFullscreen: false,
  visible: true
})

const emit = defineEmits<{
  (e: 'toggle-play'): void
  (e: 'toggle-mute'): void
  (e: 'toggle-fullscreen'): void
  (e: 'volume-change', value: number): void
  (e: 'seek', value: number): void
}>()

function handleVolumeInput(val: number | number[]) {
  emit('volume-change', Array.isArray(val) ? val[0] : val)
}

function handleSeekInput(val: number | number[]) {
  emit('seek', Array.isArray(val) ? val[0] : val)
}

/**
 * @description: 秒 → 时间文本（H:MM:SS 或 MM:SS）
 */
function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return '00:00'
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
</script>

<style scoped>
.vp-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0));
  color: #fff;
  transition: opacity 0.3s ease;
}

/* 全屏空闲时隐藏控制栏（由父组件通过 visible 控制） */
.vp-controls--hidden {
  opacity: 0;
  pointer-events: none;
}

/* ---- 播放按钮：与 vp-icon 同款纯图标（无边框无背景），但更大 ---- */
.vp-play {
  font-size: 44px;
}

/* ---- 图标（播放/静音 / 全屏） ---- */
.vp-icon {
  flex-shrink: 0;
  font-size: 17px;
  color: #fff;
  cursor: pointer;
  transition: color 0.15s ease, transform 0.15s ease;
}

.vp-icon:hover {
  color: #409eff;
  transform: scale(1.1);
}

.vp-time {
  flex-shrink: 0;
  min-width: 42px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.vp-progress {
  flex: 1;
}

.vp-volume {
  flex-shrink: 0;
  width: 76px;
}

/* ---- 统一精简 slider：直接像素覆盖（不依赖 EP 变量），节点垂直居中 ---- */
.vp-progress :deep(.el-slider),
.vp-volume :deep(.el-slider) {
  height: 20px;
  align-items: center;
}

.vp-progress :deep(.el-slider__runway),
.vp-volume :deep(.el-slider__runway) {
  margin: 0;
  height: 3px !important;
  border-radius: 2px;
  background-color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
}

.vp-progress :deep(.el-slider__bar),
.vp-volume :deep(.el-slider__bar) {
  height: 3px !important;
  border-radius: 2px;
  background-color: #409eff;
}

/* 节点容器：36px，相对轨道垂直居中 */
.vp-progress :deep(.el-slider__button-wrapper),
.vp-volume :deep(.el-slider__button-wrapper) {
  top: -16.5px;               /* -(36-3)/2，使 wrapper 中心对齐轨道中心 */
  width: 36px;
  height: 36px;
}

/* 节点本身：小圆点，!important 确保覆盖 EP 默认规则 */
.vp-progress :deep(.el-slider__button),
.vp-volume :deep(.el-slider__button) {
  width: 6px !important;
  height: 6px !important;
  border: 1px solid #409eff !important;
  background-color: #fff !important;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

/* hover / 拖动：节点轻微放大 + 柔和光晕 */
.vp-progress :deep(.el-slider__button-wrapper:hover .el-slider__button),
.vp-volume :deep(.el-slider__button-wrapper:hover .el-slider__button),
.vp-progress :deep(.el-slider__button-wrapper.dragging .el-slider__button),
.vp-volume :deep(.el-slider__button-wrapper.dragging .el-slider__button) {
  transform: scale(1.4);
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.25);
}

/* 禁用态（进度未知） */
.vp-progress :deep(.el-slider__runway.is-disabled .el-slider__bar) {
  background-color: rgba(255, 255, 255, 0.5);
}
</style>
