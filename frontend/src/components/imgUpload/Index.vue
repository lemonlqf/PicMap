<!--
 * @Author: Do not edit
 * @Date: 2025-04-29 18:33:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-27 19:21:36
 * @FilePath: \PicMap\picMap_fontend\src\components\imgUpload\Index.vue
 * @Description: 首页的图片上传组件
  - 基于Element Plus的Upload组件封装，提供图片预览、格式/大小限制等功能
  - 支持批量上传和单张上传两种模式
  - 上传前解析图片的EXIF信息，获取GPS坐标等元数据
  - 已上传的图片会显示在下方列表中，点击可以定位到地图上的对应位置
  - 没有GPS信息的图片可以手动输入坐标进行定位
  - 已上传的图片可以进行分组设置，方便在地图上进行分类展示
-->
<template>
  <div class="img-upload">
    <!-- 上传图片 -->
    <div class="upload-button-group">
      <el-button style="width: 180px;" type="primary" :disabled="isLoading" @click="selectImages">
        {{ $t('uploadPicture') }}
        <el-icon v-if="isLoading" class="is-loading" style="margin-left: 8px;">
          <Loading />
        </el-icon>
      </el-button>
      <span v-if="hasUrlFileList.length" class="upload-count">{{ uploadedImageInfos.length }}/{{ hasUrlFileList.length }}</span>
    </div>
    <!-- 上传到表单中图片数据 -->
    <el-scrollbar style="height: unset" max-height="65vh">
      <div class="duplicate-image-box" v-show="uploadedImageInfos.length">
        <h3 class="h3-title">{{ $t('uploadedPicture') }}：</h3>
        <div class="uploaded-list" :class="{ expanded: uploadExpand }">
          <div class="duplicate-upload-img-card" v-for="item in uploadedImageInfos" :key="item.id">
            <el-tooltip :show-after="500" :content="item.name" placement="top">
              <img class="thumb" :src="item.blobUrl ?? item.url" alt="" loading="lazy"
                @click="markerService.setViewByMarkerId(item.id)" @dblclick="previewImage(item.blobUrl ?? item.url)" />
            </el-tooltip>
          </div>
        </div>
        <div class="uploaded-actions">
          <el-button-group>
            <el-button class="edit-button" v-show="uploadExpand" @click="uploadExpand = false" size="small">
              <el-icon>
                <ArrowUpBold />
              </el-icon>{{ $t('fold') }}
            </el-button>
            <el-button class="edit-button" v-show="!uploadExpand" @click="uploadExpand = true" size="small">
              <el-icon>
                <ArrowDownBold />
              </el-icon>{{ $t('expand') }}
            </el-button>
            <el-button class="edit-button" @click="clearUploadImage" size="small" type="danger">
              <el-icon>
                <Delete />
              </el-icon>{{ $t('clear') }}
            </el-button>
          </el-button-group>
        </div>
      </div>
      <div v-show="needUploadImageInfos.length">
        <h3 class="h3-title">{{ $t('pictureToBeUploaded') }}：</h3>
        <div class="upload-img-card" v-for="item in needUploadImageInfos" :key="item.id">
          <div class="image-info">
            <img class="thumb" :src="item.blobUrl ?? item.url" alt="" loading="lazy"
              @click="markerService.setViewByMarkerId(item.id)" @dblclick="previewImage(item.blobUrl ?? item.url)" />
            <div class="info-text">
            <el-tooltip :show-after="500" :content="item.name" placement="top">
                <span class="name-text">{{ item.name }}</span>
              </el-tooltip>
              <span class="gps-text">
                {{ item?.GPSInfo?.GPSLatitude ? `${item.GPSInfo.GPSLatitude}, ${item.GPSInfo.GPSLongitude}` :
                  $t('noData') }}
              </span>
            </div>
          </div>
          <div class="upload-buttons">
            <div v-if="!item?.GPSInfo?.GPSLatitude || !item?.GPSInfo?.GPSLongitude" :title="$t('locate')"
              class="action-btn locate" @click="showLocateDialog(item.name)">
              <img src="@/assets/icon/定位(白色).png" alt="">
            </div>
            <div v-else :title="$t('upload')" class="action-btn upload" @click="uploadImage(item.name)">
              <img src="@/assets/icon/上传 (白色).png" alt="">
            </div>
            <div :title="$t('group')"
              :class="['action-btn', 'group', { disabled: !item?.GPSInfo?.GPSLatitude || !item?.GPSInfo?.GPSLongitude }]"
              @click="item?.GPSInfo?.GPSLatitude && item?.GPSInfo?.GPSLongitude && showGroupDialog(item.id)">
              <img src="@/assets/icon/分组（白色）.png" alt="">
            </div>
            <div :title="$t('delete')" class="action-btn delete" @click="deleteImage(item.name)">
              <img src="@/assets/icon/删除 (白色).png" alt="">
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <!-- 上传进度条 -->
    <div v-if="isUploading && uploadProgress.total > 0" class="upload-progress">
      <el-progress :percentage="Math.round(uploadProgress.current / uploadProgress.total * 100)"
        :format="() => `${uploadProgress.current}/${uploadProgress.total}`" />
    </div>
    <!-- 图片解析进度条（选择图片后分批解析） -->
    <div v-show="parseProgress.total > 0 && parseProgress.processed < parseProgress.total" class="upload-progress">
      <el-progress :percentage="parseProgress.total > 0 ? Math.round(parseProgress.processed / parseProgress.total * 100) : 0"
        :format="() => `${parseProgress.processed}/${parseProgress.total}`" />
    </div>
    <!-- 待上传图片操作按钮 -->
    <div v-if="needUploadImageInfos.length" class="upload-actions">
      <el-button-group>
        <el-button class="upload-action-btn" type="primary" :disabled="isUploading"
          @click="uploadImages(needUploadImageInfos)" size="small">
          <el-icon v-if="isUploading" class="is-loading">
            <Loading />
          </el-icon>
          批量<br>上传
        </el-button>
        <el-button class="upload-action-btn" type="warning" :disabled="isUploading" @click="batchUploadToGroupDialogShow = true"
          size="small">
          批量上传<br>到分组
        </el-button>
        <el-button class="upload-action-btn" type="danger" :disabled="isUploading" @click="deleteAll" size="small">
          全部<br>清空
        </el-button>
      </el-button-group>
    </div>
  </div>
  <!-- 定位弹框 -->
  <LocateDialog v-model="locateDialogShow" :image-id="needLocateImageIdFormData.id" @confirm="handleLocateConfirm"
    @manual-locate="handleManualLocate"></LocateDialog>
  <!-- 单张图片分组设置弹框 -->
  <GroupInfoDialog v-model="groupDialogShow" :imageIds="editImageIds" @group-setup-complete="handleGroupSetupComplete">
  </GroupInfoDialog>
  <!-- 批量上传到分组弹框 -->
  <BatchUploadToGroupDialog v-model="batchUploadToGroupDialogShow" :uploading="isUploading" @confirm="handleBatchUploadToGroup"></BatchUploadToGroupDialog>
  <!-- 图片预览 -->
  <ImagePreview v-model:visible="previewVisible" :src="previewSrc"></ImagePreview>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage, ElLoading } from 'element-plus'
import { ArrowUpBold, ArrowDownBold, Delete, Loading } from '@element-plus/icons-vue'
import { judgeHadUploadImage, saveSchema as SaveSchema } from '@/utils/schema'
import { updateGroupMarkerImage } from '@/utils/group'
import { uploadImages as UploadImages, addImageUrl } from '@/utils/Image'
import { useSchemaStore } from '@/store/schema'
import { useMapStore } from '@/store/map'
import eventBus from '@/utils/eventBus'
import API from '@/wails/api'
import GroupInfoDialog from '@/components/groupInfo/groupEdit/GroupInfoDialog.vue'
import BatchUploadToGroupDialog from '@/components/groupInfo/batchUploadToGroup/BatchUploadToGroupDialog.vue'
import LocateDialog from './LocateDialog.vue'
import ImagePreview from '@/components/imagePreview/ImagePreview.vue'
import type { IImageDetailInfo } from '@/type/image'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import markerService from '@/services/marker'

const { t } = useI18n()

const schemaStore = useSchemaStore()
const props = defineProps({
  map: {
    type: Object
  }
})

const emit = defineEmits<{
  (e: 'uploadSuccess'): void
}>()

// 最完整的图片信息列表，在原生文件选择框返回的基础上，补充了预览图等信息
const hasUrlFileList = ref<IImageDetailInfo[]>([])
// 设置定位的弹框
const locateDialogShow = ref(false)
// 分组设置的弹框
const groupDialogShow = ref(false)
// 批量上传到分组弹框
const batchUploadToGroupDialogShow = ref(false)
// 定位的数据
const needLocateImageIdFormData = ref<{
  id: string | null,
  GPSAltitude: number | null,
  GPSLatitude: number | null,
  GPSLongitude: number | null
}>({
  id: null,
  GPSAltitude: null,
  GPSLatitude: null,
  GPSLongitude: null
})

const locateFromRef = ref()

// 上传图片是否展开
const uploadExpand = ref(false)

function isInHasUrlFileList(id: string) {
  return hasUrlFileList.value.some(item => {
    return item.id === id || item.name == id
  })
}

/**
 * @description: 打开原生文件选择框选择图片（秒回路径，后台分批解析经事件推送）
 * @return {*}
 */
async function selectImages() {
  isLoading.value = true
  try {
    const res = await API.image.selectImages()
    if (res.code !== 200) {
      isLoading.value = false
      ElMessage.error(res.msg || t('description.parsePictureFailed'))
      return
    }
    const total = res.data?.total ?? 0
    parseProgress.value = { processed: 0, total }
    // 空选择（取消）：Go 端不发 images-done 事件，需立即恢复按钮，避免永久 loading
    if (total === 0) {
      isLoading.value = false
    }
  } catch (error) {
    console.error('选择图片失败', error)
    isLoading.value = false
    ElMessage.error(t('description.parsePictureFailed') + error)
  }
}



const needUploadImageInfos = computed(() => {
  // 更新schema，新的信息保存到schema中
  schemaStore.pushImagesToImageInfo(hasUrlFileList.value)
  // 点击上传后，schema中默认有相关的图片了，因此在schema中的图片会消失
  const res = hasUrlFileList.value.filter(item => {
    return !judgeHadUploadImage(item.id)
  })
  // 如果有数据的话，走完更新一波可见的markers
  if (res.length) {
    markerService.updateVisibleMarkers()
  }
  return res
})

const uploadedImageInfos = computed(() => {
  // 点击上传后，schema中默认有相关的图片了，因此在schema中的图片会消失
  const res = hasUrlFileList.value.filter(item => {
    return judgeHadUploadImage(item.id)
  })
  return res
})


// 清空已上传的图片
function clearUploadImage() {
  hasUrlFileList.value = hasUrlFileList.value.filter(item => {
    return !judgeHadUploadImage(item.id)
  })
}

const needUploadImageLoading = ref(false)
const uploadedImageLoading = ref(false)
const loadingInstance = ref()
const isLoading = ref(false)
const isUploading = ref(false)
const uploadProgress = ref({ current: 0, total: 0 })
// 图片解析进度（分批事件推送）
const parseProgress = ref({ processed: 0, total: 0 })
// 逐张渐进展示的定时器（组件卸载时清理，防止内存泄漏）
const displayTimers: ReturnType<typeof setTimeout>[] = []

// 处理一批解析完成的图片：逐张延迟展示，避免同一帧渲染多张造成瞬时压力
function handleParsedBatch(images: any[]) {
  // 过滤掉已存在的图片，构造待展示列表
  const pendingList: IImageDetailInfo[] = []
  for (const img of images) {
    if (isInHasUrlFileList(img.id)) {
      continue
    }
    // 预览图
    const previewUrl = img.preview ? `data:image/jpeg;base64,${img.preview}` : ''
    const data: IImageDetailInfo = {
      ...img,
      url: previewUrl,
      blobUrl: previewUrl,
    }
    // 保存到imageUrlsMap中，后续图片详情展示使用
    addImageUrl(img.id, previewUrl)
    pendingList.push(data)
  }
  // 逐张延迟展示，产生渐进出现效果
  const interval = 150 // 每张间隔毫秒
  pendingList.forEach((data, index) => {
    const timer = setTimeout(() => {
      hasUrlFileList.value.push(data)
      // 有 GPS 的图片同步添加 marker
      if (data.GPSInfo?.GPSLatitude && data.GPSInfo?.GPSLongitude) {
        !judgeHadUploadImage(data.id) && markerService.addImageMarkerToMap(data)
      }
    }, index * interval)
    displayTimers.push(timer)
  })
}

watch(() => [needUploadImageLoading.value, uploadedImageLoading.value], () => {
  if (needUploadImageLoading.value || uploadedImageLoading.value) {
    loadingInstance.value = ElLoading.service({ fullscreen: true, text: `${t('description.analysisPicture')}......`, })
  } else {
    loadingInstance.value && loadingInstance.value.close()
  }
})

watch(isUploading, (newVal) => {
  if (batchUploadToGroupDialogShow.value && newVal === false) {
    batchUploadToGroupDialogShow.value = false
  }
})

/**
 * @description: 上传在左侧上传列表中的单张照片
 * @param {*} name
 * @return {*}
 */
function uploadImage(name: string) {
  const data = needUploadImageInfos.value.filter(item => {
    return item.id === name
  })
  if (data[0].GPSInfo.GPSLongitude != null && data[0].GPSInfo.GPSLatitude != null) {
    uploadImages(data)
  } else {
    ElMessage.error(t('description.needGPSInfo'))
  }
}


/**
 * @description: 删除在左侧上传列表中的单张照片，只删除schema中的图片信息，不会对本地文件中图片进行操作
 * @param {*} name
 * @return {*}
 */
function deleteImage(name: string) {
  // 删除上传文件中的图片
  hasUrlFileList.value = hasUrlFileList.value.filter(item => {
    return item.name !== name
  })
  // 获取对应的marker，name和id是一样的
  const marker = markerService.getMarkerById(name)
  // 删除掉marker
  markerService.deleteMarkerInMap(marker)
}

// 添加图片
async function uploadImages(imageInfos: IImageDetailInfo[]) {
  isUploading.value = true
  // 对有定位信息的图片进行上传
  const locateImageInfos = cloneDeep(imageInfos).filter(item => {
    return item.GPSInfo.GPSLatitude && item.GPSInfo.GPSLongitude
  })
  if (locateImageInfos.length < 1) {
    ElMessage.warning(t('description.noPictureCanUpload'))
    isUploading.value = false
    return
  }
  // 初始化进度
  uploadProgress.value = { current: 0, total: locateImageInfos.length }
  // 进度回调函数
  const onProgress = (current: number, total: number) => {
    uploadProgress.value = { current, total }
  }
  // subimtData.append('data', 123)
  // 上传图片一定要用UploadImages因为有特殊操作，而且要先上传图片再保存schema
  const res1 = await UploadImages(locateImageInfos, onProgress)
  // 所有setSchema方法都必须调用saveSchmea，因为在保存前需要有特殊操作
  const res2 = await SaveSchema()
  const allSuccess = res1.filter(res => {
    return res.code === 200
  }).length === res1.length
  if (allSuccess && res1.length && res2.code === 200) {
    ElMessage.success(t('description.pictureUploadedSuccess'))
    emit('uploadSuccess')
  } else if (!allSuccess && res1.length && res2.code === 200) {
    ElMessage.success(t('description.somePictureUploadedSuccess'))
    emit('uploadSuccess')
  } else {
  }
  isUploading.value = false
  uploadProgress.value = { current: 0, total: 0 }
}

/**
 * @description: 为没有位置的图片设置定位信息
 * @param {*} id
 * @return {*}
 */
function showLocateDialog(id: string) {
  locateDialogShow.value = true
  needLocateImageIdFormData.value.id = id
}

/**
 * @description: 处理定位确认
 * @param {*} data
 * @return {*}
 */
function handleLocateConfirm(data: { id: string | null; GPSLatitude: number | null; GPSLongitude: number | null; GPSAltitude: number | null }) {
  if (data.id) {
    const { GPSLatitude, GPSAltitude, GPSLongitude = 0 } = data
    const imageInfo = needUploadImageInfos.value.find(item => {
      return item.id === data.id
    })
    if (imageInfo && GPSLatitude != null && GPSLongitude != null) {
      imageInfo.GPSInfo = { GPSLatitude, GPSAltitude: GPSAltitude ?? undefined, GPSLongitude }
    }
  }
}

/**
 * @description: 处理手动定位
 * @param {*} data
 * @return {*}
 */
function handleManualLocate(data: { id: string | null; lat: number; lng: number }) {
  const mapStore = useMapStore()
  const fileInfo = hasUrlFileList.value.find(item => {
    return item.id === data.id
  })
  if (!fileInfo) return
  const marker = markerService.addManualLocateImageMarkerToMap(fileInfo, data.lat, data.lng)!
  mapStore.addMarkerId(marker.options.id)
  markerService.addVisibleMarkerById(marker.options.id)
  updateFromLocateInfo(marker, fileInfo)
  marker.on('moveend', () => {
    updateFromLocateInfo(marker, fileInfo)
  })
}

function updateFromLocateInfo(marker: any, fileInfo: any) {
  const { lat, lng } = marker.getLatLng()
  if (lat && lng) {
    fileInfo.GPSInfo.GPSLatitude = lat
    fileInfo.GPSInfo.GPSLongitude = lng
  }
}

/**
 * @description: 清空上传组件内的所有图片
 * @return {*}
 */
function deleteAll() {
  // 删除所有未上传图片的marker
  needUploadImageInfos.value.forEach(item => {
    const marker = markerService.getMarkerById(item.id)
    if (marker) {
      markerService.deleteMarkerInMap(marker)
    }
  })
  // 清空列表
  hasUrlFileList.value = []
}

const groupIdAndNameLists = ref([])

// 可以是多个
const editImageIds = ref<string[]>([])

// 图片预览
const previewVisible = ref(false)
const previewSrc = ref('')

function previewImage(src: string) {
  previewSrc.value = src
  previewVisible.value = true
}

/**
 * @description:
 * @return {*}
 */
function showGroupDialog(imageId: string) {
  editImageIds.value = [imageId]
  groupDialogShow.value = true
}

/**
 * @description: 分组设置完成后的回调，自动上传设置了分组的图片
 * @param {string[]} imageIds - 需要自动上传的图片ID列表
 */
function handleGroupSetupComplete(imageIds: string[]) {
  // 筛选出未上传且有GPS信息的图片
  const imagesToUpload = needUploadImageInfos.value.filter(item => {
    return imageIds.includes(item.id) && item.GPSInfo?.GPSLatitude && item.GPSInfo?.GPSLongitude
  })
  if (imagesToUpload.length > 0) {
    uploadImages(imagesToUpload)
  }
}

/**
 * @description: 批量上传到分组的回调
 * @param {string[]} groupIds - 选中的分组ID列表
 */
async function handleBatchUploadToGroup(groupIds: string[]) {
  const imagesWithGPS = needUploadImageInfos.value.filter(item => {
    return item.GPSInfo?.GPSLatitude && item.GPSInfo?.GPSLongitude
  })
  if (imagesWithGPS.length === 0) {
    ElMessage.warning(t('description.noPictureCanUpload'))
    return
  }
  const imageIds = imagesWithGPS.map(img => img.id)
  // 隐藏已分配到分组的图片标记
  imageIds.forEach(imageId => {
    markerService.hiddenMarkerById(imageId)
  })
  // 先将分组信息更新到 schema 中
  const schema = schemaStore.getSchema
  groupIds.forEach(groupId => {
    const group = schema.groupInfo.find(item => item.id === groupId)
    if (group) {
      group.groupNumbers = [...new Set([...(group.groupNumbers || []), ...imageIds])]
      updateGroupMarkerImage(group)
    }
  })
  await SaveSchema()
  // 上传图片
  uploadImages(imagesWithGPS)
}

// TODO:更新图片信息
function updateImgs() { }

onMounted(() => {
  // 监听右键删除
  eventBus.on('delete-image', deleteImage)
  // 监听右键设置分组
  eventBus.on('edit-group', showGroupDialog)

  // 监听一批图片解析完成（先注册后触发，规避事件时序）
  API.image.onImagesParsed((payload: any) => {
    const images = payload?.images ?? []
    handleParsedBatch(images)
  })

  // 监听解析进度
  API.image.onImagesProgress((payload: any) => {
    parseProgress.value = {
      processed: payload?.processed ?? 0,
      total: payload?.total ?? 0,
    }
  })

  // 监听全部解析完成
  API.image.onImagesDone(() => {
    isLoading.value = false
  })
})

onUnmounted(() => {
  // 清理事件监听，防止内存泄漏与重复注册
  eventBus.off('delete-image', deleteImage)
  eventBus.off('edit-group', showGroupDialog)
  API.image.offImagesEvents()
  // 清理未触发的逐张展示定时器
  displayTimers.forEach((timer) => clearTimeout(timer))
  displayTimers.length = 0
})

defineExpose({
  deleteAll
})
</script>

<style lang="scss" scoped>
.img-upload {
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  padding: 10px;
  overflow: hidden;

  .upload-button-group {
    display: flex;
    align-items: center;
  }
}

:deep(.el-upload-list) {
  display: none;
}

.h3-title {
  font-size: 12px;
  color: #909399;
  margin: 10px 0 8px;
}

.duplicate-image-box {
  width: 220px;
  padding-bottom: 5px;
  border-bottom: 1px solid #ebeef5;

  .uploaded-list {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    max-height: 55px;
    overflow: hidden;
    transition: max-height 0.3s ease;

    &.expanded {
      max-height: none;
      overflow-y: auto;
    }
  }

  .uploaded-actions {
    padding: 8px 0;
  }
}

.upload-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
}

.upload-img-card {
  display: flex;
  align-items: center;
  position: relative;
  max-width: 320px;
  padding: 6px 8px;
  margin-bottom: 6px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  transition: all 0.2s;
  overflow: hidden;

  &:hover {
    background: #f0f7ff;
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.15);

    .upload-buttons {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .image-info {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;

    .thumb {
      width: 50px;
      height: 50px;
      object-fit: cover;
      flex-shrink: 0;
      border-radius: 4px;
      will-change: transform;
    }

    .info-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
    }

    .name-text {
      display: block;
      width: 150px;
      font-size: 12px;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gps-text {
      font-size: 11px;
      color: #909399;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .upload-buttons {
    position: absolute;
    right: 8px;
    top: 30%;
    transform: translateX(calc(100% + 8px));
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: all 0.15s ease;

    .action-btn {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;

      img {
        width: 16px;
        height: 16px;
      }

      &.upload {
        background: #67c23a;

        &:hover {
          background: #85ce61;
          transform: scale(1.1);
        }
      }

      &.locate {
        background: #409eff;

        &:hover {
          background: #66b1ff;
          transform: scale(1.1);
        }
      }

      &.group {
        background: #e6a23c;

        &:hover {
          background: #ebb563;
          transform: scale(1.1);
        }

        &.disabled {
          background: #c0c4cc;
          cursor: not-allowed;
          transform: none;
        }
      }

      &.delete {
        background: #f56c6c;

        &:hover {
          background: #f89898;
          transform: scale(1.1);
        }
      }
    }
  }
}

.upload-progress {
  padding: 12px 8px;
  margin: 8px 0;
  background: linear-gradient(135deg, #f0f7ff 0%, #e6f0ff 100%);
  border-radius: 6px;

  .el-progress {
    --el-progress-text-color: #409eff;
  }
}

.bottom-button {
  margin: 8px 4px !important;
}

.duplicate-upload-img-card {
  .thumb {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.2s;
    will-change: transform;

    &:hover {
      transform: scale(1.05);
    }
  }
}

img {
  cursor: pointer;
}

:deep(.el-form-item__label) {
  line-height: 14px;
}

.edit-button {
  width: 100px;
}

.upload-action-btn {
  width: 80px;
  height: 40px;
  line-height: 14px;
}

.upload-count {
  margin-left: 14px;
  font-size: 12px;
  color: #606266;
}
</style>
