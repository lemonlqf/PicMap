<template>
  <div class="basic-row">
    <div class="basic-item">
      <span class="label">{{ $t('distance') }}</span>
      <span class="value">{{ formatDistance(trackInfo?.distance) }}</span>
    </div>
    <div class="basic-item">
      <span class="label">{{ $t('startTime') }}</span>
      <span class="value">{{ formatDate(trackInfo?.startTime) }}</span>
    </div>
    <div class="basic-item">
      <span class="label">{{ $t('endTime') }}</span>
      <span class="value">{{ formatDate(trackInfo?.endTime) }}</span>
    </div>
    <div class="basic-item">
      <span class="label">{{ $t('track.movingTime') }}</span>
      <span class="value">{{ formatDuration(trackInfo?.movingTime) }}</span>
    </div>
    <div class="basic-item">
      <span class="label">{{ $t('track.totalTime') }}</span>
      <span class="value">{{ formatDuration(trackInfo?.totalTime) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TrackInfo {
  distance?: number
  startTime?: Date | string
  endTime?: Date | string
  movingTime?: number
  totalTime?: number
}

defineProps<{
  trackInfo: TrackInfo | null
}>()

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

function formatDate(date?: Date | string): string {
  if (!date) return '-'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.basic-row {
  display: flex;
  gap: 0;
  padding: 12px 16px;
  background: rgba(240, 248, 255, 0.89);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.basic-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  min-width: 0;
  white-space: nowrap;
}

.basic-item:first-child {
  padding-left: 0;
}

.basic-item:last-child {
  border-right: none;
}

.basic-item .label {
  font-size: 11px;
  color: #888;
}

.basic-item .value {
  font-size: 14px;
  color: #333;
  font-weight: 600;
}
</style>
