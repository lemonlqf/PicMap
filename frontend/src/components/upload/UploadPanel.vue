<!--
 * @Description: 共用上传面板：图片 + 视频统一入口
 * - 两个独立入口按钮（选择图片 / 选择视频）
 * - 待上传列表混合展示图片项与视频项
 * - 已上传分两个子区（图片区 / 视频区）
-->
<template>
  <div class="upload-panel">
    <!-- 双入口工具栏 -->
    <div class="toolbar">
      <el-button class="toolbar-btn" type="primary" :disabled="imageParsing || imageUploading" @click="selectImages">
        {{ $t('uploadPicture') }}
        <el-icon v-if="imageParsing" class="is-loading" style="margin-left: 4px;">
          <Loading />
        </el-icon>
      </el-button>
      <el-button class="toolbar-btn" type="warning" :disabled="videoParsing || videoImporting" @click="selectVideos">
        {{ $t('uploadVideo') }}
        <el-icon v-if="videoParsing" class="is-loading" style="margin-left: 4px;">
          <Loading />
        </el-icon>
      </el-button>
    </div>

    <!-- 解析/上传进度 -->
    <div v-if="totalProgress.total > 0 && totalProgress.processed < totalProgress.total" class="progress">
      <el-progress :percentage="Math.round(totalProgress.processed / totalProgress.total * 100)"
        :format="() => `${totalProgress.processed}/${totalProgress.total}`" />
    </div>

    <el-scrollbar style="height: calc(100% - 50px)" v-if="hasContent" max-height="55vh">
      <!-- 已上传 - 图片与视频混合区 -->
      <div v-if="uploadedImageList.length || uploadedVideoList.length" class="section">
        <h3 class="section-title">{{ $t('uploadedPicture') }}</h3>
        <div class="uploaded-list">
          <div class="uploaded-card" v-for="item in uploadedImageList" :key="item.id">
            <el-tooltip :show-after="500" :content="item.name" placement="top">
              <img class="thumb" :src="item.blobUrl ?? item.url" alt="" loading="lazy"
                @click="markerService.setViewByMarkerId(item.id)" @dblclick="previewImage(item)" />
            </el-tooltip>
          </div>
          <div class="uploaded-card" v-for="video in uploadedVideoList" :key="video.id">
            <el-tooltip :show-after="500" :content="video.name" placement="top">
              <div class="video-card" @click="locateUploadedVideo(video)">
                <img v-if="videoCoverMap[video.id]" class="thumb" :src="videoCoverMap[video.id]" alt="" />
                <div v-else class="video-thumb">
                  <VideoCamera class="video-icon" />
                </div>
                <span class="play-badge">▶</span>
              </div>
            </el-tooltip>
          </div>
        </div>
      </div>

      <!-- 待上传列表（混合） -->
      <div v-if="pendingImageList.length || pendingVideoList.length" class="section">
        <h3 class="section-title">{{ $t('pictureToBeUploaded') }}</h3>
        <!-- 图片项 -->
        <div v-for="item in pendingImageList" :key="item.id" class="upload-item">
          <div class="item-info">
            <img class="thumb" :src="item.blobUrl ?? item.url" alt="" loading="lazy"
              @click="markerService.setViewByMarkerId(item.id)" @dblclick="previewImage(item)" />
            <div class="info-text">
              <el-tooltip :show-after="500" :content="item.name" placement="top">
                <span class="name-text">{{ item.name }}</span>
              </el-tooltip>
              <span class="meta-text">
                {{ item?.GPSInfo?.GPSLatitude ? `${item.GPSInfo.GPSLatitude}, ${item.GPSInfo.GPSLongitude}` :
                $t('noData') }}
              </span>
            </div>
          </div>
          <div class="item-actions">
            <div v-if="!item?.GPSInfo?.GPSLatitude || !item?.GPSInfo?.GPSLongitude" :title="$t('locate')"
              class="action-btn locate" @click="showImageLocate(item.name)">
              <img src="@/assets/icon/定位(白色).png" alt="">
            </div>
            <div v-else :title="$t('upload')" class="action-btn upload" @click="uploadImage(item.name)">
              <img src="@/assets/icon/上传 (白色).png" alt="">
            </div>
            <div :title="$t('group')"
              :class="['action-btn', 'group', { disabled: !item?.GPSInfo?.GPSLatitude || !item?.GPSInfo?.GPSLongitude }]"
              @click="item?.GPSInfo?.GPSLatitude && item?.GPSInfo?.GPSLongitude && showImageGroupDialog(item.id)">
              <img src="@/assets/icon/分组（白色）.png" alt="">
            </div>
            <div :title="item.isPanorama ? $t('cancelPanorama') : $t('setPanorama')"
              :class="['action-btn', 'panorama', { active: item.isPanorama }]" @click="togglePanorama(item)">
              <span class="panorama-text">360</span>
            </div>
            <div :title="$t('delete')" class="action-btn delete" @click="deleteImage(item.name)">
              <img src="@/assets/icon/删除 (白色).png" alt="">
            </div>
          </div>
        </div>
        <!-- 视频项 -->
        <div v-for="video in pendingVideoList" :key="video.id" class="upload-item">
          <div class="item-info">
            <div class="video-thumb" :class="video.hasGpsData || manualGpsMap[video.id] ? '' : 'no-gps'"
              @click="locatePendingVideo(video)">
              <img v-if="videoCoverMap[video.id]" class="thumb-img" :src="videoCoverMap[video.id]" alt="" />
              <VideoCamera v-else class="video-icon" />
              <span class="play-badge">▶</span>
            </div>
            <div class="info-text">
              <span class="name-text">{{ video.name }}</span>
              <span class="meta-text">
                {{ getVideoCoordText(video) }}
              </span>
            </div>
          </div>
          <div class="item-actions">
            <div :title="manualGpsMap[video.id] ? '已定位' : $t('locate')"
              :class="['action-btn', 'locate', { active: manualGpsMap[video.id] }]" @click="showVideoLocate(video.id)">
              <img src="@/assets/icon/定位(白色).png" alt="">
            </div>
            <div :title="linkedTrackMap[video.id] ? '已关联' : '关联轨迹'"
              :class="['action-btn', 'locate', { active: !!linkedTrackMap[video.id] }]" @click="openTrackAssociation(video)">
              <img :src="linkTrackIcon" alt="">
            </div>
            <div :title="$t('upload')" class="action-btn upload" @click="handleImport(video)">
              <img src="@/assets/icon/上传 (白色).png" alt="">
            </div>
            <div :title="$t('delete')" class="action-btn delete" @click="handleRemoveVideo(video.id)">
              <img src="@/assets/icon/删除 (白色).png" alt="">
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>

    <!-- 面板底部批量操作（固定在面板底部，滚动列表时始终可见） -->
    <div v-if="pendingImageList.length || pendingVideoList.length" class="panel-actions">
      <el-button size="small" :loading="imageUploading || videoImporting" @click="handleBatchUploadAll">
        {{ $t('batchUpload') }}
      </el-button>
      <el-button size="small" @click="handleClearAll">{{ $t('clear') }}</el-button>
    </div>
  </div>

  <!-- 图片定位弹框 -->
  <LocateDialog v-model="imageLocateShow" :image-id="imageLocateId" @confirm="handleImageLocateConfirm"
    @manual-locate="handleImageLocateManual" />
  <!-- 视频定位弹框 -->
  <LocateDialog v-model="videoLocateShow" :image-id="videoLocateId" @confirm="handleVideoLocateConfirm"
    @manual-locate="handleVideoLocateManual" />
  <!-- 受限轨迹管理表格（关联待上传视频） -->
  <TrackUploadDialog v-model="trackDialogVisible" :pending-video="pendingAssociateVideo"
    @track-linked="handleTrackLinked" />
  <!-- 图片分组设置弹框 -->
  <GroupInfoDialog v-model="imageGroupShow" :imageIds="editImageIds"
    @group-setup-complete="handleImageGroupSetupComplete" />
  <!-- 图片预览 -->
  <ImagePreview v-model:visible="imagePreviewShow" :src="imagePreviewSrc" />
  <!-- 全景 360 预览 -->
  <el-dialog v-model="panoramaShow" append-to-body :close-on-click-modal="true" :show-close="true" width="80vw"
    top="5vh" class="panorama-preview-dialog" destroy-on-close>
    <div class="panorama-container" v-loading="panoramaLoading">
      <PanoramaViewer :src="panoramaSrc" :panorama-type="panoramaType" />
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, VideoCamera } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { cloneDeep } from 'lodash-es'
import API from '@/wails/api'
import { useSchemaStore } from '@/store/schema'
import { useMapStore } from '@/store/map'
import { saveSchema } from '@/utils/schema'
import { uploadImages as UploadImages, addImageUrl, getFullImageUrlById } from '@/utils/Image'
import { pushVideoToSchema, getVideoFramePreviewUrl, getVideoThumbnailUrl } from '@/utils/video'
import LocateDialog from '@/components/imgUpload/LocateDialog.vue'
import GroupInfoDialog from '@/components/groupInfo/groupEdit/GroupInfoDialog.vue'
import ImagePreview from '@/components/imagePreview/ImagePreview.vue'
import PanoramaViewer from '@/components/imagePreview/PanoramaViewer.vue'
import TrackUploadDialog from '@/components/trackUpload/TrackUploadDialog.vue'
import markerService from '@/services/marker'
import mapService from '@/services/map'
import linkTrackIcon from '@/assets/icon/30H轨迹.png'
import type { IImageDetailInfo } from '@/type/image'
import type { ISelectedVideo } from '@/type/video'
import type { IVideoInfo } from '@/type/schema'

const { t } = useI18n()
const schemaStore = useSchemaStore()

const props = defineProps({
  map: {
    type: Object,
    default: null
  }
})

const emit = defineEmits<{
  (e: 'uploadSuccess'): void
}>()

// ---- 图片状态 ----
const imageList = ref<IImageDetailInfo[]>([])
const imageParsing = ref(false)
const imageUploading = ref(false)
const imageProgress = ref({ processed: 0, total: 0 })
const imageLocateShow = ref(false)
const imageLocateId = ref<string | null>(null)
const imageGroupShow = ref(false)
const editImageIds = ref<string[]>([])
const imagePreviewShow = ref(false)
const imagePreviewSrc = ref('')
const panoramaShow = ref(false)
const panoramaSrc = ref('')
const panoramaType = ref('')
const panoramaLoading = ref(false)
const displayTimers: ReturnType<typeof setTimeout>[] = []

// ---- 视频状态 ----
const videoList = ref<ISelectedVideo[]>([])
const videoParsing = ref(false)
const videoImporting = ref(false)
const videoProgress = ref({ processed: 0, total: 0 })
const importingMap = ref<Record<string, boolean>>({})
const manualGpsMap = ref<Record<string, { lat: number; lng: number }>>({})
const videoLocateShow = ref(false)
const videoLocateId = ref<string | null>(null)
// 关联轨迹：videoId -> trackId（幂等叠加，不影响独立定位/上传）
const linkedTrackMap = ref<Record<string, string>>({})
// 当前要关联轨迹的待上传视频
const pendingAssociateVideo = ref<ISelectedVideo | null>(null)
// 受限的轨迹管理表格弹框可见性
const trackDialogVisible = ref(false)
// 视频封面：videoId/path -> data URL（待上传用原路径，已上传用 videoId）
const videoCoverMap = ref<Record<string, string>>({})

/**
 * @description: 加载视频封面到 videoCoverMap（失败静默留空）
 */
async function loadVideoCover(key: string, loader: () => Promise<string>) {
  if (videoCoverMap.value[key]) return
  try {
    const url = await loader()
    if (url) videoCoverMap.value[key] = url
  } catch (e) {
    console.error('加载视频封面失败', key, e)
  }
}

/**
 * @description: 加载待上传视频封面（原路径提取首帧）
 */
function loadPendingVideoCover(video: ISelectedVideo) {
  loadVideoCover(video.id, () => getVideoFramePreviewUrl(video.path))
}

/**
 * @description: 加载已上传视频封面（用户目录按 videoId 提取）
 */
function loadUploadedVideoCover(video: IVideoInfo) {
  if (!video.id) return
  loadVideoCover(video.id, () => getVideoThumbnailUrl(video.id))
}

// ---- 进度合并展示 ----
const totalProgress = computed(() => {
  const p = imageProgress.value
  const v = videoProgress.value
  const total = p.total + v.total
  const processed = p.processed + v.processed
  return { processed, total }
})

// ---- 图片列表计算 ----
const pendingImageList = computed(() => imageList.value.filter(item => !isImageUploaded(item.id)))
const uploadedImageList = computed(() => imageList.value.filter(item => isImageUploaded(item.id)))

function isImageUploaded(id: string) {
  return schemaStore.getUploadedImageIds.includes(id)
}

// ---- 视频列表计算 ----
// 已上传判断以内存中的 uploadedVideoIds 为准（与图片 isImageUploaded 逻辑一致）
function isVideoUploaded(id: string) {
  return schemaStore.getUploadedVideoIds.includes(id)
}
const pendingVideoList = computed(() => videoList.value.filter(v => !isVideoUploaded(v.id)))
const uploadedVideoList = computed(() => videoList.value.filter(v => isVideoUploaded(v.id)))

// 是否有任何待上传/已上传内容（控制面板是否展开列表，无内容时只显示工具栏）
const hasContent = computed(() =>
  pendingImageList.value.length > 0 ||
  pendingVideoList.value.length > 0 ||
  uploadedImageList.value.length > 0 ||
  uploadedVideoList.value.length > 0
)

// ================= 图片逻辑 =================

async function selectImages() {
  imageParsing.value = true
  try {
    const res = await API.image.selectImages()
    if (res.code !== 200) {
      imageParsing.value = false
      ElMessage.error(res.msg || t('description.parsePictureFailed'))
      return
    }
    const total = res.data?.total ?? 0
    imageProgress.value = { processed: 0, total }
    if (total === 0) imageParsing.value = false
  } catch (e) {
    console.error('选择图片失败', e)
    imageParsing.value = false
    ElMessage.error(t('description.parsePictureFailed'))
  }
}

function handleImageParsedBatch(images: any[]) {
  const pending: IImageDetailInfo[] = []
  for (const img of images) {
    if (imageList.value.some(item => item.id === img.id)) continue
    const previewUrl = img.preview ? `data:image/jpeg;base64,${img.preview}` : ''
    const data: IImageDetailInfo = { ...img, url: previewUrl, blobUrl: previewUrl }
    addImageUrl(img.id, previewUrl)
    pending.push(data)
  }
  pending.forEach((data, index) => {
    const timer = setTimeout(() => {
      imageList.value.push(data)
      // 图片加入 schema.imageInfo（与图片上传组件一致），供刷新后从 schema 加载 marker
      schemaStore.pushImagesToImageInfo([data])
      if (data.GPSInfo?.GPSLatitude && data.GPSInfo?.GPSLongitude) {
        !isImageUploaded(data.id) && markerService.addImageMarkerToMap(data)
      }
    }, index * 150)
    displayTimers.push(timer)
  })
}

async function uploadImage(name: string) {
  const data = pendingImageList.value.filter(item => item.id === name)
  if (data[0]?.GPSInfo?.GPSLongitude != null && data[0]?.GPSInfo?.GPSLatitude != null) {
    await UploadImages(data)
    await saveSchema()
    emit('uploadSuccess')
  } else {
    ElMessage.error(t('description.needGPSInfo'))
  }
}

async function handleBatchUploadImages() {
  const locateImageInfos = cloneDeep(pendingImageList.value).filter(item => item.GPSInfo.GPSLatitude && item.GPSInfo.GPSLongitude)
  if (locateImageInfos.length < 1) {
    ElMessage.warning(t('description.noPictureCanUpload'))
    return
  }
  imageUploading.value = true
  imageProgress.value = { processed: 0, total: locateImageInfos.length }
  const onProgress = (current: number, total: number) => { imageProgress.value = { processed: current, total } }
  const res1 = await UploadImages(locateImageInfos, onProgress)
  const res2 = await saveSchema()
  const allSuccess = res1.filter(r => r.code === 200).length === res1.length
  if (allSuccess && res1.length && res2.code === 200) {
    ElMessage.success(t('description.pictureUploadedSuccess'))
    emit('uploadSuccess')
  } else if (!allSuccess && res1.length && res2.code === 200) {
    ElMessage.success(t('description.somePictureUploadedSuccess'))
    emit('uploadSuccess')
  }
  imageUploading.value = false
  imageProgress.value = { processed: 0, total: 0 }
}

function deleteImage(name: string) {
  imageList.value = imageList.value.filter(item => item.name !== name)
  const marker = markerService.getMarkerById(name)
  if (marker) markerService.deleteMarkerInMap(marker)
}

function clearAllImages() {
  pendingImageList.value.forEach(item => {
    const marker = markerService.getMarkerById(item.id)
    if (marker) markerService.deleteMarkerInMap(marker)
  })
  imageList.value = []
}

// 清空所有待上传项（切换用户时调用）
function deleteAll() {
  clearAllImages()
  pendingVideoList.value.forEach(video => {
    const marker = markerService.getMarkerById(video.id)
    if (marker) markerService.deleteMarkerInMap(marker)
  })
  videoList.value = []
  manualGpsMap.value = {}
}

defineExpose({ deleteAll })

function showImageLocate(id: string) {
  imageLocateId.value = id
  imageLocateShow.value = true
}

function handleImageLocateConfirm(data: { id: string | null; GPSLatitude: number | null; GPSLongitude: number | null; GPSAltitude: number | null }) {
  if (!data.id) return
  const item = pendingImageList.value.find(i => i.id === data.id)
  if (item && data.GPSLatitude != null && data.GPSLongitude != null) {
    item.GPSInfo = { GPSLatitude: data.GPSLatitude, GPSAltitude: data.GPSAltitude ?? undefined, GPSLongitude: data.GPSLongitude }
  }
}

function handleImageLocateManual(data: { id: string | null; lat: number; lng: number }) {
  if (!data.id) return
  const fileInfo = imageList.value.find(item => item.id === data.id)
  if (!fileInfo) return
  const marker = markerService.addManualLocateImageMarkerToMap(fileInfo, data.lat, data.lng)!
  const mapStore = useMapStore()
  mapStore.addMarkerId(marker.options.id)
  markerService.addVisibleMarkerById(marker.options.id)
  updateFromLocateInfo(marker, fileInfo)
  marker.on('moveend', () => updateFromLocateInfo(marker, fileInfo))
}

function updateFromLocateInfo(marker: any, fileInfo: any) {
  const { lat, lng } = marker.getLatLng()
  if (lat && lng) fileInfo.GPSInfo = { ...fileInfo.GPSInfo, GPSLatitude: lat, GPSLongitude: lng }
}

function showImageGroupDialog(imageId: string) {
  editImageIds.value = [imageId]
  imageGroupShow.value = true
}

function handleImageGroupSetupComplete(imageIds: string[]) {
  const imagesToUpload = pendingImageList.value.filter(item => imageIds.includes(item.id) && item.GPSInfo?.GPSLatitude && item.GPSInfo?.GPSLongitude)
  if (imagesToUpload.length > 0) UploadImages(imagesToUpload)
}

function togglePanorama(item: any) {
  item.isPanorama = !item.isPanorama
}

async function previewImage(item: any) {
  if (item?.isPanorama) {
    panoramaType.value = item?.panoramaType ?? ''
    panoramaSrc.value = ''
    panoramaShow.value = true
    panoramaLoading.value = true
    const url = await getFullImageUrlById(item.id)
    panoramaLoading.value = false
    if (url) panoramaSrc.value = url
  } else {
    imagePreviewSrc.value = item?.blobUrl ?? item?.url
    imagePreviewShow.value = true
  }
}

// ================= 视频逻辑 =================

async function selectVideos() {
  videoParsing.value = true
  try {
    const res = await API.video.selectVideos()
    if (res.code !== 200) {
      videoParsing.value = false
      ElMessage.error(res.msg || '选择视频失败')
      return
    }
    videoProgress.value = { processed: 0, total: res.data?.total ?? 0 }
  } catch (e) {
    console.error('选择视频失败', e)
    videoParsing.value = false
    ElMessage.error('选择视频失败')
  }
}

async function handleVideoParsedBatch(videos: any[]) {
  videos.forEach(async (v) => {
    if (videoList.value.find(exist => exist.id === v.id)) return
    videoList.value.push({ ...v, imported: false })
    // 异步加载视频首帧封面（原路径）
    loadPendingVideoCover(v)
    // 有内嵌 GPS 的视频：同步插入地图节点（与图片待上传交互一致）
    if (v.GPSLatitude && v.GPSLongitude && !isVideoUploaded(v.id)) {
      markerService.addVideoMarkerToMap(
        { id: v.id, name: v.name, GPSLatitude: v.GPSLatitude, GPSLongitude: v.GPSLongitude } as IVideoInfo,
        await getVideoFramePreviewUrl(v.path)
      )
    }
  })
}

function showVideoLocate(videoId: string) {
  videoLocateId.value = videoId
  videoLocateShow.value = true
}

function handleVideoLocateConfirm(data: { id: string | null; GPSLatitude: number | null; GPSLongitude: number | null; GPSAltitude: number | null }) {
  if (data.id && data.GPSLatitude != null && data.GPSLongitude != null) {
    manualGpsMap.value[data.id] = { lat: data.GPSLatitude, lng: data.GPSLongitude }
  }
}

function handleVideoLocateManual(data: { id: string | null; lat: number; lng: number }) {
  if (!data.id) return
  const video = videoList.value.find(v => v.id === data.id)
  if (video) {
    const marker = markerService.addManualLocateVideoMarkerToMap({ id: video.id, name: video.name } as IVideoInfo, data.lat, data.lng)
    if (marker) {
      marker.on('moveend', () => {
        const { lat, lng } = marker.getLatLng()
        manualGpsMap.value[video.id] = { lat, lng }
      })
    }
    manualGpsMap.value[data.id] = { lat: data.lat, lng: data.lng }
  }
}

/**
 * @description: 打开受限的轨迹管理表格（仅可对齐视频），关联待上传视频
 */
function openTrackAssociation(video: ISelectedVideo) {
  pendingAssociateVideo.value = video
  trackDialogVisible.value = true
}

// 轨迹关联完成（对齐后自动上传），记录关联状态，视频保留在待上传列表
function handleTrackLinked(videoId: string, trackId: string) {
  linkedTrackMap.value[videoId] = trackId
  const v = videoList.value.find(item => item.id === videoId)
  if (v) {
    v.imported = true
  }
  pendingAssociateVideo.value = null
}

/**
 * @description: 点击待上传视频缩略图：有 GPS 则定位到地图（marker 在加入列表时已预建）
 */
function locatePendingVideo(video: ISelectedVideo) {
  markerService.setViewByMarkerId(video.id)
}

/**
 * @description: 点击已上传视频：有独立 GPS 定位到该坐标，否则提示
 */
function locateUploadedVideo(video: IVideoInfo) {
  if (video.GPSLatitude && video.GPSLongitude) {
    mapService.setViewByLatLng(video.GPSLatitude, video.GPSLongitude)
    return
  }
  // 从 trackInfo.videos 反查该视频是否关联了轨迹
  const linked = (schemaStore.getSchema.trackInfo || []).some(t => (t.videos || []).some(v => v.videoId === video.id))
  ElMessage.info(linked ? '该视频关联轨迹，无独立定位坐标' : '该视频暂无定位信息')
}

async function handleImport(video: ISelectedVideo) {
  const manualGps = manualGpsMap.value[video.id]
  if (!video.hasGpsData && !manualGps) {
    ElMessage.warning('视频需要内嵌 GPS 或手动定位后才能导入')
    return
  }
  importingMap.value[video.id] = true
  try {
    const res = await API.video.importVideo({ id: video.id, name: video.name, path: video.path })
    if (res.code !== 200) {
      ElMessage.error(res.msg || '导入失败')
      return
    }
    const vi: IVideoInfo = res.data
    if (manualGps) {
      vi.GPSLatitude = manualGps.lat
      vi.GPSLongitude = manualGps.lng
    }
    pushVideoToSchema(vi)
    // 同步到内存中的已上传视频 id（与图片已上传判断逻辑一致）
    schemaStore.pushVideoToUploadedVideoIds(vi.id)
    await saveSchema()

    const tempMarker = markerService.getMarkerById(vi.id)
    if (tempMarker && tempMarker.options.type === 'temporary-video') {
      markerService.deleteMarkerInMap(tempMarker)
    }

    if (vi.GPSLatitude && vi.GPSLongitude) {
      await markerService.addVideoMarkerToMap(vi)
    }
    // 视频参与聚合后需重建渲染以放置节点（原先直接 addTo 即可，现在由 renderClusters 决定是否聚合）
    markerService.updateVisibleMarkers()
    video.imported = true
    // 导入后加载已上传封面（用户目录按 videoId 提取）
    loadUploadedVideoCover(vi)
    ElMessage.success('导入成功')
  } catch (e) {
    console.error('导入失败', e)
    ElMessage.error('导入失败')
  } finally {
    importingMap.value[video.id] = false
  }
}

function handleRemoveVideo(videoId: string) {
  videoList.value = videoList.value.filter(v => v.id !== videoId)
  delete manualGpsMap.value[videoId]
  // 移除地图上的对应节点（与图片待上传交互一致）
  const marker = markerService.getMarkerById(videoId)
  if (marker) markerService.deleteMarkerInMap(marker)
}

// ---- 批量操作（覆盖待上传的图片 + 视频） ----

/**
 * @description: 单条视频导入核心逻辑（成功不弹窗，供单个与批量共用）
 * @return {*} 是否导入成功
 */
async function importVideoItem(video: ISelectedVideo): Promise<boolean> {
  const manualGps = manualGpsMap.value[video.id]
  if (!video.hasGpsData && !manualGps) return false
  importingMap.value[video.id] = true
  try {
    const res = await API.video.importVideo({ id: video.id, name: video.name, path: video.path })
    if (res.code !== 200) return false
    const vi: IVideoInfo = res.data
    if (manualGps) {
      vi.GPSLatitude = manualGps.lat
      vi.GPSLongitude = manualGps.lng
    }
    pushVideoToSchema(vi)
    schemaStore.pushVideoToUploadedVideoIds(vi.id)
    await saveSchema()

    const tempMarker = markerService.getMarkerById(vi.id)
    if (tempMarker && tempMarker.options.type === 'temporary-video') {
      markerService.deleteMarkerInMap(tempMarker)
    }

    if (vi.GPSLatitude && vi.GPSLongitude) {
      await markerService.addVideoMarkerToMap(vi)
    }
    // 视频参与聚合后需重建渲染以放置节点
    markerService.updateVisibleMarkers()
    video.imported = true
    loadUploadedVideoCover(vi)
    return true
  } catch (e) {
    console.error('导入失败', e)
    return false
  } finally {
    importingMap.value[video.id] = false
  }
}

/**
 * @description: 批量上传所有待上传项（图片需有 GPS，视频需有 GPS 或已手动定位）
 */
async function handleBatchUploadAll() {
  // 待上传图片（必须有 GPS）
  const locateImages = pendingImageList.value.filter(item => item.GPSInfo?.GPSLatitude && item.GPSInfo?.GPSLongitude)
  // 待上传视频（内嵌 GPS 或已手动定位）
  const locateVideos = pendingVideoList.value.filter(v => v.hasGpsData || manualGpsMap.value[v.id])

  if (locateImages.length < 1 && locateVideos.length < 1) {
    ElMessage.warning(t('description.noPictureCanUpload'))
    return
  }

  imageUploading.value = true
  videoImporting.value = true
  try {
    // 1. 批量上传图片
    if (locateImages.length > 0) {
      imageProgress.value = { processed: 0, total: locateImages.length }
      const onProgress = (current: number, total: number) => { imageProgress.value = { processed: current, total } }
      await UploadImages(locateImages, onProgress)
      await saveSchema()
    }
    // 2. 批量导入视频
    for (const video of locateVideos) {
      await importVideoItem(video)
    }
    await saveSchema()
    emit('uploadSuccess')
    ElMessage.success(t('description.pictureUploadedSuccess'))
  } finally {
    imageUploading.value = false
    videoImporting.value = false
    imageProgress.value = { processed: 0, total: 0 }
  }
}

/**
 * @description: 清空所有待上传项（图片 + 视频），并移除地图上对应临时节点
 */
function handleClearAll() {
  // 清空待上传图片
  pendingImageList.value.forEach(item => {
    const marker = markerService.getMarkerById(item.id)
    if (marker) markerService.deleteMarkerInMap(marker)
  })
  imageList.value = []
  // 清空待上传视频
  pendingVideoList.value.forEach(video => {
    const marker = markerService.getMarkerById(video.id)
    if (marker) markerService.deleteMarkerInMap(marker)
  })
  videoList.value = []
  manualGpsMap.value = {}
}

// ---- 通用工具 ----
// 获取视频的经纬度显示文本（与图片项对齐）：手动定位优先，其次内嵌 GPS
function getVideoCoordText(video: ISelectedVideo): string {
  const manual = manualGpsMap.value[video.id]
  if (manual) {
    return `${manual.lat.toFixed(4)}, ${manual.lng.toFixed(4)}`
  }
  if (video.GPSLatitude && video.GPSLongitude) {
    return `${video.GPSLatitude.toFixed(4)}, ${video.GPSLongitude.toFixed(4)}`
  }
  return t('noData')
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return ''
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// ---- 事件监听 ----
onMounted(() => {
  API.image.onImagesParsed((payload: any) => handleImageParsedBatch(payload?.images ?? []))
  API.image.onImagesProgress((payload: any) => {
    imageProgress.value = { processed: payload?.processed ?? 0, total: payload?.total ?? 0 }
  })
  API.image.onImagesDone(() => { imageParsing.value = false })

  API.video.onVideosParsed((payload: any) => handleVideoParsedBatch(payload?.videos ?? []))
  API.video.onVideosProgress((payload: any) => {
    videoProgress.value = { processed: payload?.processed ?? 0, total: payload?.total ?? 0 }
  })
  API.video.onVideosDone(() => { videoParsing.value = false })
})

onUnmounted(() => {
  API.image.offImagesEvents()
  API.video.offVideosEvents()
  displayTimers.forEach(timer => clearTimeout(timer))
  displayTimers.length = 0
})
</script>

<style scoped lang="scss">
.upload-panel {
  width: 220px;
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  padding: 10px;
  height: fit-content;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .toolbar {
    display: flex;
    gap: 6px;
    margin-bottom: 0;

    .toolbar-btn {
      flex: 1;
      min-width: 0;
      padding: 8px 6px;
      font-size: 12px;
    }
  }

  .progress {
    padding: 8px 0;
  }

  .section {
    border-top: 1px solid #ebeef5;
    padding-top: 8px;
    margin-top: 8px;

    .section-title {
      font-size: 12px;
      color: #909399;
      margin: 0 0 8px;
      font-weight: 600;
    }

  }

  .panel-actions {
    display: flex;
    gap: 6px;
    justify-content: space-around;
    align-items: center;
    margin-top: 8px;
    border-top: 1px solid #ebeef5;
    padding-top: 8px;

    .el-button {
      flex: 1;
      margin-left: 0;
    }
  }

  .upload-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    background: #fff;
    margin-bottom: 6px;
    position: relative;

    &:hover .item-actions {
      opacity: 1;
    }

    &.uploaded {
      background: #f8fafc;
      border-color: #d9e2ec;
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;

      .thumb {
        width: 50px;
        height: 50px;
        object-fit: cover;
        flex-shrink: 0;
        border-radius: 4px;
        cursor: pointer;
      }

      .video-thumb {
        width: 50px;
        height: 50px;
        flex-shrink: 0;
        border-radius: 4px;
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #909399;
        overflow: hidden;
        position: relative;

        .thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .play-badge {
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 1px;
        }

        &.no-gps {
          background: #fef0f0;
          color: #f56c6c;
        }

        .video-icon {
          width: 20px;
          height: 20px;
        }
      }

      .info-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;

        .name-text {
          font-size: 12px;
          color: #303133;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meta-text {
          font-size: 11px;
          color: #909399;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          gap: 6px;
          align-items: center;

          .badge {
            border-radius: 3px;
            padding: 0 4px;
            font-size: 11px;
            line-height: 1.4;
          }

          .gps-badge {
            color: #67c23a;
            border: 1px solid #67c23a;
          }

          .manual-badge {
            color: #409eff;
            border: 1px solid #409eff;
          }

          .track-name {
            color: #409eff;
          }
        }
      }
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0;
      transition: opacity 0.15s ease;
      background: rgba(255, 255, 255, 0.92);
      padding: 2px 4px;
      border-radius: 4px;

      .action-btn {
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        cursor: pointer;

        img {
          width: 15px;
          height: 15px;
        }

        &.upload {
          background: #67c23a;
        }

        &.locate {
          background: #409eff;
        }

        &.group {
          background: #e6a23c;

          &.disabled {
            background: #c0c4cc;
            cursor: not-allowed;
          }
        }

        &.delete {
          background: #f56c6c;
        }

        &.panorama {
          background: #909399;

          .panorama-text {
            font-size: 11px;
            color: #fff;
            font-weight: bold;
          }

          &.active {
            background: #409eff;
          }
        }
      }
    }
  }

  .uploaded-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;

    .uploaded-card {
      .thumb {
        width: 50px;
        height: 50px;
        object-fit: cover;
        border-radius: 4px;
        cursor: pointer;
      }

      // 视频封面容器（含播放标志角标）
      .video-card {
        position: relative;
        width: 50px;
        height: 50px;
        border-radius: 4px;
        overflow: hidden;

        .thumb {
          width: 100%;
          height: 100%;
        }

        .play-badge {
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          font-size: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding-left: 1px;
        }
      }

      // 无封面时的占位块（尺寸与缩略图一致）
      .video-thumb {
        width: 50px;
        height: 50px;
        border-radius: 4px;
        background: #f0f2f5;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #909399;

        .video-icon {
          width: 20px;
          height: 20px;
        }
      }
    }
  }
}

.edit-form {
  padding: 4px 8px;

  .edit-name {
    font-size: 14px;
    color: #303133;
    font-weight: 500;
    margin-bottom: 16px;
  }

  .edit-body {
    display: flex;
    gap: 16px;

    .edit-left {
      flex: 1;
      min-width: 300px;
    }
  }
}

.player-container {
  width: 100%;
  height: 60vh;
}

.panorama-preview-dialog {
  background: rgba(0, 0, 0, 0.9);
  z-index: 99999;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;
  }

  .panorama-container {
    position: relative;
    width: 100%;
    height: 370px;
  }
}
</style>
