<!--
 * @Author: Do not edit
 * @Date: 2026-03-25
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-09-11 19:17:20
 * @FilePath: \picmap-go\frontend\src\components\trackDetail\components\TrackDetailHeader.vue
 * @Description: 轨迹详情头部：轨迹标签页切换 + 当前轨迹关联视频列表 + 播放按钮（打开独立空弹框）
-->
<template>
  <div class="panel-header">
    <div class="header-area">
      <!-- 当前轨迹名称标题 -->
      <div class="track-title" :title="currentTrackName">
        {{ currentTrackName || $t('track.unnamed') }}
      </div>

      <!-- 当前轨迹绑定的视频列表（仅名称文本，点击聚焦并高亮所属轨迹；悬浮显示播放按钮打开弹框） -->
      <div v-if="currentVideos.length" class="track-videos-wrap">
        <span class="videos-label">{{ $t('track.boundVideos') }}:</span>
        <el-scrollbar ref="videosScrollbarRef" class="track-videos-scroll">
          <div class="track-videos">
            <div
              v-for="video in currentVideos"
              :key="video.videoId"
              class="video-tag"
              :data-video-id="video.videoId"
            >
              <button
                class="video-item"
                :title="video.name"
                :style="{ background: video.color, borderColor: video.color, color: '#fff' }"
                @click="emit('video-focus', video.videoId, video.instanceId)"
              >
                <span class="video-item-name">{{ video.name }}</span>
                <span
                  class="video-hover-play"
                  :title="$t('track.videoPlay')"
                  @click.stop="openPlayDialog(video)"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 1.5L10 6L2.5 10.5V1.5Z" fill="currentColor"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </el-scrollbar>
      </div>
    </div>

    <button class="close-btn" @click="emit('close')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- 轨迹视频播放弹框（视频播放 + 轨迹地图 + 共同进度条联动） -->
  <TrackVideoPlayDialog
    v-model:visible="playDialogVisible"
    :track-name="currentTrackName"
    :video-name="playVideoName"
    :video-id="playVideoId"
    :track-id="playTrackId"
    @update:video-id="playVideoId = $event"
    @update:video-name="playVideoName = $event"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import TrackVideoPlayDialog from './TrackVideoPlayDialog.vue'
import eventBus from '@/utils/eventBus'

interface TrackVideoItem {
  videoId: string
  name: string
  instanceId: string
  trackId?: string
  color: string
}

interface TrackInfo {
  instanceId: string
  name?: string
}

const props = defineProps<{
  trackList: TrackInfo[]
  currentTrackId: string
  currentVideos?: TrackVideoItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'video-focus', videoId: string, instanceId: string): void
}>()

const currentVideos = computed(() => props.currentVideos ?? [])

const currentTrackName = computed(
  () => props.trackList.find((t) => t.instanceId === props.currentTrackId)?.name
)

const playDialogVisible = ref(false)
const playVideoName = ref('')
const playVideoId = ref('')
const playTrackId = ref('')
const videosScrollbarRef = ref<any>(null)

function openPlayDialog(video?: TrackVideoItem) {
  playVideoName.value = video?.name ?? ''
  playVideoId.value = video?.videoId ?? ''
  playTrackId.value = video?.trackId ?? ''
  playDialogVisible.value = true
}

// 点击地图视频弧段时，将对应视频标签滚动到可视区并高亮闪烁
function handleTagScrollTo(payload: { videoId: string }) {
  const videoId = payload?.videoId
  if (!videoId) return
  if (!currentVideos.value.some((v) => v.videoId === videoId)) return
  nextTick(() => {
    const scrollbar = videosScrollbarRef.value
    const rootEl: HTMLElement | undefined = scrollbar?.$el ?? scrollbar?.wrapRef
    const wrapEl = (rootEl?.querySelector?.('.el-scrollbar__wrap') ?? rootEl) as HTMLElement | undefined
    const tagEl = wrapEl?.querySelector(`.video-tag[data-video-id="${videoId}"]`) as HTMLElement | null
    if (!wrapEl || !tagEl) return
    const targetLeft = tagEl.offsetLeft - (wrapEl.clientWidth - tagEl.clientWidth) / 2
    const maxLeft = wrapEl.scrollWidth - wrapEl.clientWidth
    const left = Math.max(0, Math.min(targetLeft, maxLeft))
    if (scrollbar?.setScrollLeft) {
      scrollbar.setScrollLeft(left)
    } else {
      wrapEl.scrollTo({ left, behavior: 'smooth' })
    }
    tagEl.classList.remove('video-tag-flash')
    void tagEl.offsetWidth
    tagEl.classList.add('video-tag-flash')
    setTimeout(() => tagEl.classList.remove('video-tag-flash'), 1200)
  })
}

onMounted(() => {
  eventBus.on('video-tag-scroll-to', handleTagScrollTo)
})

onUnmounted(() => {
  eventBus.off('video-tag-scroll-to', handleTagScrollTo)
})
</script>

<style scoped>
.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(240, 248, 255, 0.89);
}

.header-area {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100% - 40px);
}

.track-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-videos-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.track-videos-scroll {
  flex: 1;
  min-width: 0;
  max-width: 1000px;
}

.track-videos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  font-size: 12px;
  padding-bottom: 7px;
}

.videos-label {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

.video-tag {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.video-tag-flash .video-item {
  animation: video-tag-flash 0.4s ease-in-out 3;
}

@keyframes video-tag-flash {
  0%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0 0 0 rgba(64, 158, 255, 0);
  }
  50% {
    transform: translateY(-1px);
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.6);
  }
}

.video-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  border: 1px solid #c6e2ff;
  border-radius: 4px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  max-width: 150px;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

.video-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: filter 0.15s ease, opacity 0.15s ease;
}

.video-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  filter: brightness(1.1);
}

/* 悬浮时文字右端渐隐，为播放按钮让出视觉空间 */
.video-item:hover .video-item-name {
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 16px), transparent 100%);
  mask-image: linear-gradient(to right, #000 calc(100% - 16px), transparent 100%);
}

/* 悬浮视频标签时在标签右侧显示的播放按钮 */
.video-hover-play {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%) scale(0.7);
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  color: #303133;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
}

.video-item:hover .video-hover-play {
  opacity: 1;
  transform: translateY(-50%) scale(1);
  pointer-events: auto;
}

.video-hover-play:hover {
  background: #409eff;
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
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #666;
}
</style>
