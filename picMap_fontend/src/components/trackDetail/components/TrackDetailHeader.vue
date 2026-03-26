<template>
  <div class="panel-header">
    <div class="track-tabs">
      <button
        v-for="track in trackList"
        :key="track.instanceId"
        :class="['tab-item', { active: track.instanceId === currentTrackId }]"
        @click="emit('track-change', track.instanceId)"
      >
        {{ track.name || $t('track.unnamed') }}
      </button>
    </div>
    <button class="close-btn" @click="emit('close')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
interface TrackInfo {
  instanceId: string
  name?: string
}

defineProps<{
  trackList: TrackInfo[]
  currentTrackId: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'track-change', trackId: string): void
}>()
</script>

<style scoped>
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(240, 248, 255, 0.89);
}

.track-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  max-width: calc(100% - 40px);
}

.tab-item {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-item:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.tab-item.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #666;
}
</style>
