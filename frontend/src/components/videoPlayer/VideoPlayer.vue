<!--
 * @Description: 视频播放器组件（基于 video.js）
 * - objectURL 由 utils/videoBlob 共享缓存提供，不再各自分块拼接
 * - 提供播放/暂停/进度条/seek 等完整控制
-->
<template>
  <div class="video-player">
    <video ref="videoEl" class="video-js vjs-big-play-centered" :poster="posterUrl"></video>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import { loadVideoAsObjectUrl } from '@/utils/videoBlob'

const props = defineProps({
  videoId: { type: String, required: true },
  posterUrl: { type: String, default: '' }
})

const videoEl = ref<HTMLVideoElement>()
let player: any = null

/**
 * @description: 初始化 video.js 播放器（objectURL 由 utils/videoBlob 共享缓存提供）
 */
async function initPlayer() {
  if (!videoEl.value) return
  // 销毁旧播放器
  if (player) {
    player.dispose()
    player = null
  }

  try {
    const url = await loadVideoAsObjectUrl(props.videoId)
    if (!url || !videoEl.value) {
      ElMessage.error('视频加载失败')
      return
    }
    player = videojs(videoEl.value, {
      controls: true,
      autoplay: false,
      fill: true,
      sources: [{ src: url, type: 'video/mp4' }],
      html5: {
        vhs: {
          overrideNative: true
        }
      }
    })
    player.on('error', () => {
      console.error('video.js 播放错误')
    })
  } catch (e) {
    console.error('初始化播放器失败', e)
    ElMessage.error('视频加载失败')
  }
}

watch(() => props.videoId, () => {
  if (props.videoId) initPlayer()
})

onMounted(() => {
  if (props.videoId) initPlayer()
})

onUnmounted(() => {
  if (player) {
    player.dispose()
    player = null
  }
})
</script>

<style scoped>
.video-player {
  width: 100%;
  height: 100%;
  background: #000;
}

.video-js {
  width: 100%;
  height: 100%;
}
</style>

<!-- video.js 生成的 DOM 不受 scoped 影响，单独全局样式保证整幅画面完整显示（不被裁切/拉伸） -->
<style>
.video-js .vjs-tech {
  object-fit: contain;
}
</style>
