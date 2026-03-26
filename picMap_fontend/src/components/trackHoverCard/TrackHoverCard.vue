<!--
 * @Author: Do not edit
 * @Date: 2026-03-25
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-25 20:13:45
 * @FilePath: \PicMap\picMap_fontend\src\components\trackHoverCard\TrackHoverCard.vue
 * @Description: 轨迹悬浮卡片组件，鼠标悬浮时显示关键信息
-->
<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="track-hover-card"
      :style="cardStyle"
    >
      <div class="card-content">
        <div class="card-title">{{ trackInfo?.name || $t('track.unnamed') }}</div>
        <div class="card-row">
          <span class="label">{{ $t('distance') }}:</span>
          <span class="value">{{ formatDistance(trackInfo?.distance) }}</span>
        </div>
        <div class="card-row">
          <span class="label">{{ $t('track.totalTime') }}:</span>
          <span class="value">{{ formatDuration(trackInfo?.totalTime) }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface TrackInfo {
  name?: string
  distance?: number
  totalTime?: number
}

const props = defineProps<{
  visible: boolean
  trackInfo: TrackInfo | null
  position: { x: number; y: number }
}>()

const cardStyle = computed(() => ({
  left: `${props.position.x + 15}px`,
  top: `${props.position.y + 15}px`
}))

function formatDistance(distance?: number): string {
  if (distance === null || distance === undefined) return '-'
  return (distance / 1000).toFixed(2) + ' km'
}

function formatDuration(ms?: number): string {
  if (ms === null || ms === undefined) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
</script>

<style scoped>
.track-hover-card {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
}

.card-content {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 160px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  margin-bottom: 4px;
}

.card-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #666;
}

.value {
  color: #333;
  font-weight: 500;
}

.card-arrow {
  position: absolute;
  bottom: -6px;
  left: 20px;
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.95);
  transform: rotate(45deg);
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
