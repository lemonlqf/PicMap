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
      <el-upload :accept="acceptType.join(',')" v-model:file-list="elUploadFileList" class="upload-demo"
        action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15" :auto-upload="false" :multiple="true">
        <el-button style="width: 180px;" type="primary" :disabled="isLoading">
          {{ $t('uploadPicture') }}
          <el-icon v-if="isLoading" class="is-loading" style="margin-left: 8px;">
            <Loading />
          </el-icon>
        </el-button>
      </el-upload>
      <span v-if="hasUrlFileList.length" class="upload-count">{{ uploadedImageInfos.length }}/{{ hasUrlFileList.length }}</span>
    </div>
    <!-- 上传到表单中图片数据 -->
    <el-scrollbar style="height: unset" max-height="65vh">
      <div class="duplicate-image-box" v-show="uploadedImageInfos.length">
        <h3 class="h3-title">{{ $t('uploadedPicture') }}：</h3>
        <div class="uploaded-list" :class="{ expanded: uploadExpand }">
          <div class="duplicate-upload-img-card" v-for="item in uploadedImageInfos" :key="item.id">
            <el-tooltip show-after="500" :content="item.name" placement="top">
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
              <el-tooltip show-after="500" :content="item.name" placement="top">
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
    <!-- 待上传图片操作按钮 -->
    <div v-if="needUploadImageInfos.length" class="upload-actions">
      <el-button-group>
        <el-button class="edit-button" type="primary" :disabled="isUploading"
          @click="uploadImages(needUploadImageInfos)" size="small">
          <el-icon v-if="isUploading" class="is-loading">
            <Loading />
          </el-icon>
          {{ $t('batchUpload') }}
        </el-button>
        <el-button class="edit-button" type="danger" :disabled="isUploading" @click="deleteAll" size="small">
          {{ $t('clearAll') }}
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
  <!-- 图片预览 -->
  <ImagePreview v-model:visible="previewVisible" :src="previewSrc"></ImagePreview>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted } from 'vue'
import ExifReader from 'exifreader'
import { ElMessage, ElLoading } from 'element-plus'
import { ArrowUpBold, ArrowDownBold, Delete, Loading } from '@element-plus/icons-vue'
import { judgeHadUploadImage, saveSchema as SaveSchema, exifDateToTimestamp } from '@/utils/schema'
import { uploadImages as UploadImages, calcMBSize, addImageUrl, getImageUrl, getImageTypeByName, getBlob, fileToBlobUrl, createThumbnailFromBlob } from '@/utils/Image'
import { useSchemaStore } from '@/store/schema'
import { useMapStore } from '@/store/map'
import eventBus from '@/utils/eventBus'
import { wgs84ToGcj02 } from '@/utils/WGS84-GCJ02'
import GroupInfoDialog from '@/components/groupInfo/groupEdit/GroupInfoDialog.vue'
import LocateDialog from './LocateDialog.vue'
import ImagePreview from '@/components/imagePreview/ImagePreview.vue'
import type { IImageDetailInfo, ICameraDetailInfo, IAuthorDetailInfo } from '@/type/image'
import { ImageType } from '@/type/image'
import type { IGPSInfo } from '@/type/schema'
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

const acceptType = [
  ImageType.PNG,
  ImageType.JPEG,
  ImageType.JPG,
  ImageType.GIF,
  ImageType.WEBP,
  ImageType.HEIC,
  ImageType.HEIF,
  ImageType.RAW,
  ImageType.RAW_ADOBE_DNG,
  ImageType.RAW_CANON_CR2,
  ImageType.RAW_CANON_CR3,
  ImageType.RAW_NIKON_NEF,
  ImageType.RAW_OLYMPUS_ORF,
  ImageType.RAW_SONY_ARW,
  ImageType.RAW_FUJIFILM_RAF,
  ImageType.RAW_PANASONIC_RW2,
  ImageType.RAW_EPSON_ERF,
  // 可能不是image/xxx的格式
  '.raw',
  '.dng',
  '.arw',
  '.cr2',
  '.cr3',
  '.nef',
  '.orf',
  '.rw2',
  '.raf',
  '.erf',
  // 后端转换暂时不支持gopro的RAW格式，后续如果支持了再添加
  // '.gpr'
]

// 需要生成缩略图的图片格式，后续经过测试如果有其他格式也需要生成缩略图再添加
const needThumbnailType = [
  ImageType.HEIC,
  ImageType.HEIF,
  ImageType.RAW,
  ImageType.RAW_ADOBE_DNG,
  ImageType.RAW_CANON_CR2,
  ImageType.RAW_CANON_CR3,
  ImageType.RAW_NIKON_NEF,
  ImageType.RAW_OLYMPUS_ORF,
  ImageType.RAW_SONY_ARW,
  ImageType.RAW_FUJIFILM_RAF,
  ImageType.RAW_PANASONIC_RW2,
  ImageType.RAW_EPSON_ERF,
  ImageType.RAW_GOPRO_GPR,
]

const imageUrls = ref<any>({})
// 图片gps信息，通过el-upload获取的fileList没有这个数据，用这个额变量暂时存一下，后续在formData中添加对应数据
const moreInfo = ref({})
// 上传组件获取到的文件
const elUploadFileList = ref([])
// 最完整的，在el-upload获取到文件的基础上，解析到了GPS和base64Url等信息
const hasUrlFileList = ref<IImageDetailInfo[]>([])
// 设置定位的弹框
const locateDialogShow = ref(false)
// 分组设置的弹框
const groupDialogShow = ref(false)
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

watch(
  () => elUploadFileList.value,
  async (newValue) => {
    try {
      isLoading.value = true
      // 如果无值直接清空
      if (newValue?.length === 0) {
        hasUrlFileList.value = []
      } else {
        for (let i = 0; i < newValue.length; i++) {
          const imageName = newValue[i].name
          // 如果没有上传过的话，走上传图片逻辑
          if (!isInHasUrlFileList(imageName)) {
            let data: IImageDetailInfo;
            const file = newValue[i].raw
            // res包括id, lasetModified, name, size, type
            const res1 = getFileInfoByFile(file)
            // 通过exifReader插件获取包括GPSInfo，ImageInfo, CameraInfo, AuthorInfo等信息
            const res2 = await setMoreInfoByExifReader(file)
            const existUrl = imageUrls.value[imageName] || getImageUrl(imageName)
            // 如果本身不在urls里面，说明是后面加的，需要获取到base64的url
            if (!existUrl) {
              // 完整的base64用于图片上传
              const url = await readFileAsDataURL(file);
              const type = file.type || getImageTypeByName(file.name)
              console.log('file.type', type, newValue[i])
              // 对于正常类型图片直接生成blob，对于HEIC/RAW等特殊格式的图片需要先后端转换成jpg格式后再生成blob
              const blob = await getBlob(file, type);
              // 相对路径，用于未上传前的展示，相较于使用url，dom性能更优化一些
              const blobUrl = await fileToBlobUrl(blob)
              imageUrls.value[imageName] = blobUrl
              // 保存到imageUrlsMap中，后续图片详情展示使用
              addImageUrl(imageName, blobUrl)
              data = { ...res1, ...res2, url, blobUrl }
              // HEIC/RAW 经过服务端转换后都需要保存缩略图，避免后端反复现算。
              if (
                needThumbnailType.includes(type as ImageType)
              ) {
                const thumbnail = await createThumbnailFromBlob(blob)
                const thumbnailUrl = await readFileAsDataURL(thumbnail)
                data.thumbnailUrl = thumbnailUrl
              }
            } else {
              // 如果已经有了，直接拿过来用
              data = { ...res1, ...res2, url: existUrl }
            }
            hasUrlFileList.value[i] = data
            // 如果有坐标内容的话，在地图上添加对应的marker
            if (res2?.GPSInfo?.GPSLatitude && res2?.GPSInfo?.GPSLongitude) {
              // 只有还没有上传过的图片需要添加到地图中
              !judgeHadUploadImage(imageName) && markerService.addImageMarkerToMap(hasUrlFileList.value[i])
            }
          }
        }
      }
    } catch (error) {
      console.error('解析图片失败', error)
      ElMessage.error(t('description.parsePictureFailed') + error)
    } finally {
      isLoading.value = false
    }
  }
)



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
  elUploadFileList.value = elUploadFileList.value.filter(item => {
    return !judgeHadUploadImage(item.name)
  })
}


// 通过raw文件获取相关的文件数据
function getFileInfoByFile(file: File) {
  const { lastModified, name, size, type } = file
  // id通过name和type来生成
  const id = name
  return { id, lastModified, name, size, type }
}


// 从图片信息对象中提取GPS信息，并添加到地图里面
async function setMoreInfoByExifReader(file: File, name?: string) {
  try {
    const tags = await ExifReader.load(file, { expanded: true })
    console.log('--', tags)
    // 设置经纬度到moreInfo中
    const GPSInfo: IGPSInfo = getGPSInfo(tags)
    // 图片信息
    const imageInfo: IImageDetailInfo = getImageInfo(tags, file)
    // 相机信息
    const cameraInfo: ICameraDetailInfo = getCameraInfo(tags)
    // 作者信息
    const authorInfo: IAuthorDetailInfo = getAuthorInfo(tags)
    // TODO:设置其他值
    // setxxxInfo(tags, name)

    return { GPSInfo, imageInfo, cameraInfo, authorInfo }
  } catch (error) {
    console.error('exifReader解析失败', error)
    return {
      imageInfo: {},
      GPSInfo: {},
      cameraInfo: {},
      authorInfo: {}
    }
  }
}

// 获取不同图片经纬度信息
function getGPSInfo(info) {
  let GPSLatitude = null
  let GPSLongitude = null
  let GPSAltitude = 0
  if (info.gps) {
    // 坐标是WGS84标准的，国内坐标是GCJ02标准的，需要转化
    const GcjGPSInfo = wgs84ToGcj02(info.gps.Longitude, info.gps.Latitude)
    GPSLongitude = GcjGPSInfo[0] === '' ? null : GcjGPSInfo[0]
    GPSLatitude = GcjGPSInfo[1] === '' ? null : GcjGPSInfo[1]
    // 海拔（m）
    GPSAltitude = info?.gps?.Altitude
  }
  return { GPSLatitude, GPSLongitude, GPSAltitude }
}

/**
 * @description: 作者相关信息
 * @param {*} tags
 * @param {*} name
 * @return {*}
 */
function getAuthorInfo(info) {
  const exif = info.exif
  return {
    // 拍摄时间，转化为时间戳
    DateTime: exifDateToTimestamp(exif?.DateTime?.value[0]),
    // 图像作者
    Artis: exif?.Artis?.value,
    // 图像软件
    SoftWare: exif?.SoftWare?.value,
  }
}

/**
 * @description: 设置相机参数信息
 * @param {*} tags
 * @param {*} name
 * @return {*}
 */
function getCameraInfo(info) {
  const exif = info.exif
  return {
    // 相机制造商
    Make: exif?.Make?.value,
    // 相机型号
    Model: exif?.Model?.value,
    // 光圈值
    FNumber: exif?.FNumber?.value,
    // 曝光时间
    ExposureTime: exif?.ExposureTime?.value,
    // ISO速度
    ISOSpeedRatings: exif?.ISOSpeedRatings?.value,
    // 曝光补偿
    ExposureBiasValue: exif?.ExposureBiasValue?.value,
    // 焦距（mm）
    FocalLength: exif?.FocalLength?.value,
    // 最大光圈
    MaxApertureValue: exif?.MaxApertureValue?.value,
    // 其他数据......
  }
}

/**
 * @description: 图片相关的信息
 * @param {*} tags
 * @param {*} name
 * @return {*}
 */
function getImageInfo(info, file) {
  const exif = info.exif
  const width = exif?.PixelXDimension?.value || exif?.ImageWidth?.value
  const height = exif?.PixelYDimension?.value || exif?.ImageLength?.value
  return {
    // 分辨率
    Resolution: `${height} x ${width}`,
    // 亮度
    BrightnessValue: exif?.BrightnessValue?.value,
    // 大小
    size: calcMBSize(file.size)
  }
}

const needUploadImageLoading = ref(false)
const uploadedImageLoading = ref(false)
const loadingInstance = ref()
const isLoading = ref(false)
const isUploading = ref(false)
const uploadProgress = ref({ current: 0, total: 0 })

watch(() => [needUploadImageLoading.value, uploadedImageLoading.value], () => {
  if (needUploadImageLoading.value || uploadedImageLoading.value) {
    loadingInstance.value = ElLoading.service({ fullscreen: true, text: `${t('description.analysisPicture')}......`, })
  } else {
    loadingInstance.value && loadingInstance.value.close()
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
  if (data[0].GPSInfo.GPSLongitude !== '' && data[0].GPSInfo.GPSLatitude !== '') {
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
  // 删除原来解析好的base64
  delete imageUrls.value[name]
  // 删除上传文件中的图片
  hasUrlFileList.value = hasUrlFileList.value.filter(item => {
    return item.name !== name
  })
  // 删除上传文件中的图片
  elUploadFileList.value = elUploadFileList.value.filter(item => {
    return item.name !== name
  })
  // 获取对应的marker，name和id是一样的
  const marker = markerService.getMarkerById(name)
  // 删除掉marker
  markerService.deleteMarkerInMap(marker)
}

async function readFileAsDataURL(file): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
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
    // 上传完成后，点击右键可以出现操作菜单
  } else if (!allSuccess && res1.length && res2.code === 200) {
    ElMessage.success(t('description.somePictureUploadedSuccess'))
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
    if (imageInfo) {
      imageInfo.GPSInfo = { GPSLatitude, GPSAltitude, GPSLongitude }
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
  const marker = markerService.addManualLocateImageMarkerToMap(fileInfo, data.lat, data.lng)
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
  elUploadFileList.value = []
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

// TODO:更新图片信息
function updateImgs() { }

onMounted(() => {
  // 监听右键删除
  eventBus.on('delete-image', deleteImage)
  // 监听右键设置分组
  eventBus.on('edit-group', showGroupDialog)
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

.upload-count {
  margin-left: 14px;
  font-size: 12px;
  color: #606266;
}
</style>
