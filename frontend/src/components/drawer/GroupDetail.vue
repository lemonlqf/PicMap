<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-23 16:31:44
 * @FilePath: \PicMap\picMap_fontend\src\components\drawer\GroupDetail.vue
 * @Description: 分组详情组件
 *   - 展示分组中的图片列表
 *   - 右上角显示小地图，以Leaflet展示图片位置
 *   - 提供图片详情弹框
-->
<template>
  <div class="flex-box">
    <!-- 小地图：使用与主地图相同的瓦片 -->
    <div class="img-map">
      <MapComponent :image-ids="groupNumbers" :track-ids="trackNumbers" :video-ids="videoNumbers"
        @marker-click="handleMarkerClick" @marker-context-menu="handleMarkerContextMenu" />
    </div>
    <!-- 图片列表 -->
    <el-scrollbar style="width: 100%" :max-height="height">
      <div class="img-boxs">
        <GroupLayout class="img-list" :group-id="groupId" :group-numbers="groupNumbers" :video-numbers="videoNumbers"
          @show-image-info="handleShowImageInfo" @play-video="playVideo"></GroupLayout>
      </div>
    </el-scrollbar>
    <!-- 图片信息弹框：统一在一个地方管理 -->
    <el-dialog class="image-info-dialog" width="760px" :show-close="false" v-model="imageInfoDialogShow">
      <div class="image-info-box">
        <Image class="image" :image-id="imageId" :key="imageId"></Image>
        <ImageInfoComponent :imageInfo="imageInfo"></ImageInfoComponent>
      </div>
    </el-dialog>
    <!-- 视频播放弹框（分组详情内不挂到 body，保持在抽屉层叠上下文内，避免被抽屉遮挡） -->
    <VideoPlayDialog v-model:visible="videoPlayShow" :video-id="videoPlayId" :append-to-body="false" />
    <!-- 小地图 marker 右键菜单：将对应图片/节点剔除出分组 -->
    <Transition name="pm-context-menu">
      <div v-if="contextMenu.visible" class="pm-context-menu marker-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @mousedown.stop>
        <div class="menu-item" @click="handleRemoveFromGroup">{{ $t('exitGroup') }}</div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, onBeforeUnmount } from 'vue';
import GroupLayout from './components/GroupLayout.vue';
import MapComponent from '@/components/map/Map.vue'
import { getSchemaInfoById } from '@/utils/schema';
import { DRAWER_HEIGHT } from '@/utils/constant'
import { getGroupInfoByGroupId, removeGroupImage } from '@/utils/group';
import { removeVideoFromGroup } from '@/utils/video';
import eventBus from '@/utils/eventBus'
import { useI18n } from 'vue-i18n'
import Image from './components/Image.vue';
import ImageInfoComponent from './components/ImageInfo.vue'
import VideoPlayDialog from '@/components/videoPlayer/VideoPlayDialog.vue'

const { t } = useI18n()

const props = defineProps({
  groupId: {
    type: String,
    default: () => ({})
  },
  height: {
    type: Number,
    default: () => DRAWER_HEIGHT
  }
})

const height = props.height + 'px'
const imageInfoDialogShow = ref(false)
const imageId = ref('')
const imageInfo = ref()

/**
 * 获取分组中的图片ID列表
 */
const groupNumbers = computed(() => {
  const markerId = props.groupId
  const groupNumbers = getGroupInfoByGroupId(markerId)?.groupNumbers ?? []
  // if (groupNumbers.length === 0) {
  //   eventBus.emit('drawer-hidden')
  // }
  return groupNumbers
})

const trackNumbers = computed(() => {
  const markerId = props.groupId
  const trackNumbers = getGroupInfoByGroupId(markerId)?.trackNumbers ?? []
  return trackNumbers
})

/**
 * 获取分组中的视频ID列表
 */
const videoNumbers = computed(() => {
  return getGroupInfoByGroupId(props.groupId)?.videoNumbers ?? []
})

// ---- 视频播放 ----
const videoPlayShow = ref(false)
const videoPlayId = ref('')

function playVideo(videoId: string) {
  videoPlayId.value = videoId
  videoPlayShow.value = true
}

/**
 * 显示图片详情弹框
 * @param id 图片ID
 */
function showImageInfoById(id: string) {
  imageInfoDialogShow.value = true
  imageId.value = id
  setImageInfo(id)
}

/**
 * 处理小地图marker点击事件（图片 → 详情弹框；视频 → 播放弹框）
 * @param markerId 图片/视频ID
 */
function handleMarkerClick(markerId: string) {
  if (videoNumbers.value.includes(markerId)) {
    playVideo(markerId)
    return
  }
  showImageInfoById(markerId)
}

/**
 * 处理GroupLayout组件发出的显示图片详情事件
 * @param imageId 图片ID
 */
function handleShowImageInfo(imageId: string) {
  showImageInfoById(imageId)
}

/**
 * 设置图片信息
 * @param imageId 图片ID
 */
async function setImageInfo(imageId: string) {
  const imageInfoDetail = getSchemaInfoById(imageId) as any
  imageInfo.value = imageInfoDetail
}

// ---- 小地图 marker 右键菜单 ----
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  markerId: ''
})

/**
 * 小地图 marker 右键：在鼠标位置弹出菜单
 */
function handleMarkerContextMenu(markerId: string, event: MouseEvent) {
  event.preventDefault()
  contextMenu.markerId = markerId
  // 与主地图右键菜单一致：相对鼠标位置偏移 15px（过渡用 transform，故偏移在坐标上）
  contextMenu.x = event.clientX + 15
  contextMenu.y = event.clientY + 15
  contextMenu.visible = true
}

function closeContextMenu() {
  contextMenu.visible = false
}

/**
 * 将右键对应的图片/视频剔除出当前分组
 */
function handleRemoveFromGroup() {
  const id = contextMenu.markerId
  if (!id) return
  if (videoNumbers.value.includes(id)) {
    removeVideoFromGroup(props.groupId, id)
  } else {
    removeGroupImage(props.groupId, id)
  }
  // 若详情弹框展示的正是被剔除的图片，一并关闭
  if (imageInfoDialogShow.value && imageId.value === id) {
    imageInfoDialogShow.value = false
  }
  closeContextMenu()
}

function onDocMouseDown() {
  if (contextMenu.visible) closeContextMenu()
}

onMounted(() => document.addEventListener('mousedown', onDocMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMouseDown))
</script>

<style scoped lang="scss">
.flex-box {
  width: 100%;
  height: v-bind('height');
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  background-color: rgba(240, 248, 255, 0.89);
  position: relative;
}

.img-map {
  position: absolute;
  top: 20px;
  right: 18px;
  width: 30%;
  height: 87%;
  border: 2px solid #dddddd;
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
  // box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.2), 0 2px 5px rgba(0, 0, 0, 0.15);
  transition: box-shadow 0.3s ease;

  // &:hover {
  //   box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3), 0 8px 20px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.2);
  // }
}

.img-boxs {
  width: 70%;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: space-between;
  position: relative;

  .img-list {
    flex: 1;
  }

  .image {
    border-radius: 3px;
    overflow: hidden;
    margin-top: 10px;
    margin-left: 10px;
  }
}

.marker-context-menu {
  position: fixed;
  z-index: 999999;
}
</style>

<style>
.image-info-dialog {
  margin-top: 3vh !important;
  margin-bottom: 0px !important;
  background-color: rgba(160, 160, 160, 0.938) !important;
}

.image-info-dialog .el-dialog__header {
  display: none !important;
}

.image-info-box .image {
  width: 100%;
  height: 300px;
  margin-bottom: 15px;
  border-radius: 8px;
}
</style>
