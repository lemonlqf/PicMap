<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-28 14:48:46
 * @FilePath: \PicMap\picMap_fontend\src\components\drawer\components\GroupLayout.vue
 * @Description: 分组布局组件
 *   - 按时间分组展示图片与视频
 *   - 通过emit事件通知父组件显示图片详情 / 播放视频
-->
<template>
  <div>
    <div class="group-layout">
      <div class="button-box">
        <TimePrecision class="precision" v-model="precision"></TimePrecision>
        <Sort class="sort" v-model="sort"></Sort>
      </div>
      <!-- 按时间分组（图片与视频混排） -->
      <div v-for="key in groupImageSortMap.keys()" :key="key">
        <!-- 时间 -->
        <h1>{{ key }}</h1>
        <!-- 媒体项 -->
        <div class="flex-box">
          <template v-for="item in (groupImageSortMap.get(key) as any[])">
            <!-- 图片 -->
            <div v-if="item.type === 'image'" class="image-card" :key="item.id">
              <!-- 点击图片触发showImageInfo事件，由父组件统一处理弹框 -->
              <Image @click="(e) => handleImageClick(e, item.id)" :show-name="true" class="image" :perview="false"
                :thumbnail="true" :image-id="item.id">
              </Image>
              <!-- 退出分组 -->
              <div class="exit-group" @click="clickExitGroup($event, groupId, item.id)">
                <img src="@/assets/icon/退出.png" alt="" width="30px" :title="$t('exitGroup')" />
              </div>
            </div>
            <!-- 视频 -->
            <div v-else class="image-card" :key="item.id">
              <div class="video-thumb" @click="emit('playVideo', item.id)" :title="getVideoName(item.id)">
                <img v-if="videoCoverMap[item.id]" class="thumb-img" :src="videoCoverMap[item.id]" alt="" />
                <VideoIcon v-else class="video-icon" />
                <span class="play-badge">▶</span>
              </div>
              <!-- 视频名称（与图片名称标签一致） -->
              <el-tooltip :content="getVideoName(item.id)" placement="top">
                <div class="image-name">{{ getVideoName(item.id) }}</div>
              </el-tooltip>
              <!-- 退出分组 -->
              <div class="exit-group" @click="clickExitGroupVideo($event, groupId, item.id)">
                <img src="@/assets/icon/退出.png" alt="" width="30px" :title="$t('exitGroup')" />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType, computed, ref, watch } from 'vue'
import { groupSorting, TimeType, SortType, removeGroupImage } from '@/utils/group'
import { getSchemaInfoById } from '@/utils/schema'
import { getVideoThumbnailUrl, getVideoStartMs, removeVideoFromGroup, parseVideoNameTimeMs } from '@/utils/video'
import { VideoCamera as VideoIcon } from '@element-plus/icons-vue'
import Image from '@/components/drawer/components/Image.vue';
import Sort from './Sort.vue'
import TimePrecision from './TimePrecision.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  groupNumbers: {
    type: Object as PropType<string[]>,
    default: () => ([])
  },
  videoNumbers: {
    type: Object as PropType<string[]>,
    default: () => ([])
  },
  groupId: {
    type: String,
    default: ''
  }
})

// 定义事件：通知父组件显示图片详情 / 播放视频
const emit = defineEmits<{
  (e: 'showImageInfo', imageId: string): void
  (e: 'playVideo', videoId: string): void
}>()

// 分组的时间精度
const precision = ref<TimeType>(TimeType.YEAR)
const sort = ref<SortType>(SortType.DES)

// 视频封面缓存
const videoCoverMap = ref<Record<string, string>>({})

async function loadVideoCover(videoId: string) {
  if (videoCoverMap.value[videoId]) return
  const url = await getVideoThumbnailUrl(videoId)
  if (url) videoCoverMap.value[videoId] = url
}

function getVideoName(videoId: string): string {
  return getSchemaInfoById(videoId)?.name || videoId
}

// 图片 + 视频混合列表（统一带 time 字段，供按时间排序/分组）
const mediaInfos = computed(() => {
  const images = props.groupNumbers.map((imageId: string) => {
    const imageInfo = getSchemaInfoById(imageId) as any
    return { id: imageInfo?.id ?? imageId, type: 'image', time: imageInfo?.authorInfo?.DateTime }
  })
  const videos = props.videoNumbers.map((videoId: string) => {
    const videoInfo = getSchemaInfoById(videoId) as any
    // 视频时间：文件解析起始时刻 > 文件名解析 > 文件修改时间
    const startMs = getVideoStartMs({ ...videoInfo, name: videoInfo?.name })
      || parseVideoNameTimeMs(videoInfo?.name)
      || videoInfo?.lastModified
    return { id: videoInfo?.id ?? videoId, type: 'video', time: startMs }
  })
  return [...images, ...videos]
})

// 经过排序分组的媒体项（图片与视频混排）
const groupImageSortMap = computed<Map<string, any[]>>(() => {
  return groupSorting(mediaInfos.value, precision.value, sort.value)
})

// 视频变化时加载封面
watch(() => props.videoNumbers, (ids) => {
  ids.forEach(id => loadVideoCover(id))
}, { immediate: true })

/**
 * 处理图片点击事件
 * @param e 鼠标事件
 * @param id 图片ID
 */
function handleImageClick(e: MouseEvent, id: string) {
  const target = e.target as any
  // 如果是下载就不显示图片详情
  if (target?.title === t('downloadPicture')) {
    return
  }
  // 通知父组件显示图片详情
  emit('showImageInfo', id)
}

function clickExitGroup(e: MouseEvent, groupId: string, imageId: string) {
  e.stopPropagation() // 阻止事件冒泡，避免触发图片预览
  removeGroupImage(groupId, imageId)
}

function clickExitGroupVideo(e: MouseEvent, groupId: string, videoId: string) {
  e.stopPropagation()
  removeVideoFromGroup(groupId, videoId)
}
</script>

<style lang="scss" scoped>
.group-layout {
  padding: 0 20px 20px 20px;

  .button-box {
    z-index: 1;
    position: sticky;
    top: 8px;
    margin-top: 10px;
    padding: 3px;
    display: flex;
    align-items: center;

    .sort {
      margin-left: 5px;
      ;
    }
  }

  h1 {
    height: 17px;
    color: rgb(0, 0, 0);
    font-size: 17px;
    line-height: 17px;
  }
}

.flex-box {
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  position: relative;
  gap: 10px;

  .image-card {
    position: relative;

    .image {
      border-radius: 3px;
      overflow: hidden;
      height: 120px;
      width: 170px;
    }

    .video-thumb {
      position: relative;
      height: 120px;
      width: 170px;
      border-radius: 3px;
      overflow: hidden;
      cursor: pointer;
      background-color: #000;
      display: flex;
      align-items: center;
      justify-content: center;

      .thumb-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .video-icon {
        width: 40px;
        height: 40px;
        color: #fff;
      }

      .play-badge {
        position: absolute;
        right: 6px;
        bottom: 4px;
        color: #fff;
        font-size: 14px;
        text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
      }
    }

    .exit-group {
      position: absolute;
      // height: fit-content;
      right: 5px;
      bottom: 0px;
      transition: all 0.2s;
      position: absolute;
      cursor: pointer;
      pointer-events: all;
      opacity: 0;
    }

    .exit-group:hover {
      opacity: 1 !important;
    }

    // 视频名称标签：与图片名称标签保持一致的视觉
    .image-name {
      cursor: pointer;
      position: absolute;
      bottom: 0px;
      left: 0px;
      background-color: rgba(240, 248, 255, 0.836);
      border-top-right-radius: 5px;
      font-size: 12px;
      width: 50%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 2px 3px;
    }
  }

  .image-card:hover {
    .exit-group {
      opacity: 0.7;
    }
  }
}
</style>
