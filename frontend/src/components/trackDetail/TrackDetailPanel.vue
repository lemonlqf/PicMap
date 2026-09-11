<!--
 * @Author: Do not edit
 * @Date: 2026-03-25
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-26 22:07:58
 * @FilePath: \PicMap\picMap_fontend\src\components\trackDetail\TrackDetailPanel.vue
 * @Description: 轨迹详情卡片组件，全屏时底部居中显示完整信息
-->
<template>
  <Transition name="slide-up">
    <div v-if="visible" class="track-detail-panel">
      <div class="panel-content">
        <TrackDetailHeader
          :track-list="trackList"
          :current-track-id="currentTrackId"
          :current-videos="currentVideos"
          @close="handleClose"
          @video-focus="handleVideoFocus"
        />

        <div class="panel-body">
          <TrackBasicInfo :track-info="trackInfo" />

          <div class="detail-row">
            <TrackInfoSection
              :title="$t('track.speedData')"
              :items="speedItems"
              :highlight-index="0"
            />
            <TrackInfoSection
              :title="$t('track.elevationData')"
              :items="elevationItems"
            />
            <TrackInfoSection
              :title="$t('track.healthData')"
              :items="healthItems"
            />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TrackDetailHeader from './components/TrackDetailHeader.vue'
import TrackBasicInfo from './components/TrackBasicInfo.vue'
import TrackInfoSection from './components/TrackInfoSection.vue'
import { useSchemaStore } from '@/store/schema'
import { getVideoColor } from '@/utils/videoNode'

const { t } = useI18n()
const schemaStore = useSchemaStore()

interface TrackInfo {
  id?: string
  name?: string
  distance?: number
  startTime?: Date | string
  endTime?: Date | string
  movingTime?: number
  totalTime?: number
  movingSpeed?: number
  totalSpeed?: number
  speedMax?: number
  movingPace?: number
  elevationMax?: number
  elevationMin?: number
  elevationGain?: number
  elevationLoss?: number
  averageHr?: number | null
  averageCadence?: number | null
  averageTemp?: number | null
}

const props = defineProps<{
  visible: boolean
  trackList: (TrackInfo & { instanceId: string })[]
  currentTrackId: string
  trackInfo: TrackInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'video-focus', videoId: string, instanceId: string): void
}>()

// 当前轨迹绑定的视频列表（来自 schema.trackInfo[].videos，名称取自 schema.videoInfo）
const currentVideos = computed(() => {
  const trackId = (props.trackInfo as any)?.id
  if (!trackId) return []
  const normalize = (id: string) => String(id).replace(/\.gpx$/i, '').toLowerCase()
  const track = (schemaStore.getSchema.trackInfo || []).find(
    (item: any) => normalize(item.id) === normalize(trackId)
  )
  const videoInfoList = schemaStore.getSchema.videoInfo || []
  return (track?.videos || []).map((ref, idx) => ({
    videoId: ref.videoId,
    name: videoInfoList.find((v) => v.id === ref.videoId)?.name || ref.videoId,
    instanceId: props.currentTrackId,
    trackId: track?.id,
    color: getVideoColor(idx),
  }))
})

function handleVideoFocus(videoId: string, instanceId: string) {
  emit('video-focus', videoId, instanceId)
}

function handleClose() {
  emit('update:visible', false)
}

function formatSpeed(speed?: number): string {
  if (speed === null || speed === undefined) return '-'
  return speed.toFixed(2) + ' km/h'
}

function formatPace(paceSecondsPerKm?: number): string {
  if (paceSecondsPerKm === null || paceSecondsPerKm === undefined) return '-'
  const totalSeconds = Math.floor(paceSecondsPerKm)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}'${String(seconds).padStart(2, '0')}" /km`
}

function formatElevation(elevation?: number): string {
  if (elevation === null || elevation === undefined) return '-'
  return elevation.toFixed(0) + ' m'
}

function formatHr(hr?: number | null): string {
  if (hr === null || hr === undefined) return '-'
  if (Number.isNaN(hr)) return '-'
  return Math.round(hr) + ' bpm'
}

function formatCadence(cadence?: number | null): string {
  if (cadence === null || cadence === undefined) return '-'
  if (Number.isNaN(cadence)) return '-'
  return Math.round(cadence) + ' rpm'
}

function formatTemp(temp?: number | null): string {
  if (temp === null || temp === undefined) return '-'
  if (Number.isNaN(temp)) return '-'
  return Math.round(temp) + ' °C'
}

const speedItems = computed(() => [
  { label: t('track.movingSpeed'), value: formatSpeed(props.trackInfo?.movingSpeed) },
  { label: t('track.totalSpeed'), value: formatSpeed(props.trackInfo?.totalSpeed) },
  { label: t('track.maxSpeed'), value: formatSpeed(props.trackInfo?.speedMax) },
  { label: t('track.movingPace'), value: formatPace(props.trackInfo?.movingPace) },
])

const elevationItems = computed(() => [
  { label: t('track.elevationMax'), value: formatElevation(props.trackInfo?.elevationMax) },
  { label: t('track.elevationMin'), value: formatElevation(props.trackInfo?.elevationMin) },
  { label: t('track.elevationGain'), value: formatElevation(props.trackInfo?.elevationGain) },
  { label: t('track.elevationLoss'), value: formatElevation(props.trackInfo?.elevationLoss) },
])

const healthItems = computed(() => [
  { label: t('track.averageHr'), value: formatHr(props.trackInfo?.averageHr) },
  { label: t('track.averageCadence'), value: formatCadence(props.trackInfo?.averageCadence) },
  { label: t('track.averageTemp'), value: formatTemp(props.trackInfo?.averageTemp) },
])
</script>

<style scoped>
.track-detail-panel {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 90vw;
  min-width: 70vw;
  border-radius: 10px 10px 0 0;
  overflow: hidden;
}

.panel-content {
  background: rgba(240, 248, 255, 0.89);
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
}

.panel-body {
  padding: 0;
  max-height: none;
  overflow: visible;
}

.detail-row {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  max-height: none;
  overflow: visible;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.22, 1.2, 0.36, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(100%);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
