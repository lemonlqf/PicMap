<!--
 * @Author: Do not edit
 * @Date: 2025-04-29 18:33:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-20 00:03:33
 * @FilePath: \Code\picMap_fontend\src\components\imgUpload\Index.vue
 * @Description: 
-->
<template>
  <div class="img-upload">
    <el-upload :accept="acceptType.join(',')" v-model:file-list="elUploadFileList" class="upload-demo"
      action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15" :auto-upload="false" :multiple="true">
      <el-button style="margin-right: 10px; margin-bottom:10px; width: 180px;" type="primary">{{ $t('uploadPicture')
        }}</el-button>
      <!-- <template #tip>
        <div class="el-upload__tip">请上传图片</div>
      </template> -->
    </el-upload>
    <!-- 上传到表单中图片数据 -->
    <el-scrollbar max-height="75vh">
      <div class="duplicate-image-box" v-show="uploadedImageInfos.length">
        <!-- 重复的图片 -->
        <h3 class="h3-title">{{ $t('uploadedPicture') }}：</h3>
        <el-scrollbar :max-height="uploadExpand ? 'fit-content' : '57px'">
          <div class="duplicate-upload-img-card" v-for="(item, index) in uploadedImageInfos">
            <img :src="item.blobUrl ?? item.url" alt="" :title="item.name" height="50px" :key="item.name"
              @click="setViewByLatLng(item?.GPSInfo?.GPSLatitude, item?.GPSInfo?.GPSLongitude)" />
            <!-- <h1>照片名:{{ item.name }}</h1>
        <h1>纬度:{{ item?.GPSInfo?.GPSLatitude }}</h1>
        <h1>经度:{{ item?.GPSInfo?.GPSLongitude }}</h1> -->
          </div>
        </el-scrollbar>
        <!-- 折叠、展开、清空已上传图片 -->
        <div class="button-flex">
          <el-button class="bottom-button" v-show="uploadExpand" :icon="ArrowUpBold" @click="uploadExpand = false"
            type="primary">{{ $t('fold') }}</el-button>
          <el-button class="bottom-button" v-show="!uploadExpand" :icon="ArrowDownBold" @click="uploadExpand = true"
            type="primary">{{ $t('expand') }}</el-button>
          <el-button class="bottom-button" @click="clearUploadImage" :icon="Delete" type="danger">{{ $t('clear')
            }}</el-button>
        </div>
      </div>
      <div v-show="needUploadImageInfos.length">
        <h3 class="h3-title">{{ $t('pictureToBeUploaded') }}：</h3>
        <div class="upload-img-card" v-for="(item, index) in needUploadImageInfos" :key="item.name">
          <div class="image-info">
            <img :src="item.blobUrl ?? item.url" alt="" :title="item.name" height="50px"
              @click="setViewByLatLng(item?.GPSInfo?.GPSLatitude, item?.GPSInfo?.GPSLongitude)" />
            <h1>{{ $t('pictureName') }}:{{ item.name }}</h1>
            <h1>{{ $t('latitude') }}:{{ !item?.GPSInfo?.GPSLatitude ? $t('noData') : item?.GPSInfo?.GPSLatitude }}</h1>
            <h1>{{ $t('longitude') }}:{{ !item?.GPSInfo?.GPSLongitude ? $t('noData') : item?.GPSInfo?.GPSLongitude }}
            </h1>
            <!-- <h1>id: {{ item.id }}</h1> -->
          </div>
          <div class="uplod-delete-buttons">
            <div v-if="!item?.GPSInfo?.GPSLatitude || !item?.GPSInfo?.GPSLongitude"
              @click="showLocateDialog(item.name)">
              <img src="@/assets/icon/定位(白色).png" width="16px" alt="">{{ $t('locate') }}</img>
            </div>
            <div v-else @click="uploadImage(item.name)">
              <img src="@/assets/icon/上传 (白色).png" width="16px">{{ $t('upload') }}</img>
            </div>
            <!-- 分组信息 -->
            <div @click="showGroupDialog(item.id)">
              <img src="@/assets/icon/分组（白色）.png" width="16px">{{ $t('group') }}</img>
            </div>
            <div @click="deleteImage(item.name)">
              <img src="@/assets/icon/删除 (白色).png" width="16px">{{ $t('delete') }}</img>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <!-- 测试用，后续删除 -->
    <el-button class="bottom-button" v-if="needUploadImageInfos.length" @click="uploadImages(needUploadImageInfos)"
      type="primary">{{ $t('batchUpload') }}</el-button>
    <el-button class="bottom-button" v-if="needUploadImageInfos.length" @click="deleteAll" type="danger">{{
      $t('clearAll') }}</el-button>
  </div>
  <!-- 定位弹框 -->
  <el-dialog :z-index="9999" v-model="locateDialogShow" :title="$t('setPictureLocation')" style="width: 440px;">
    <el-form ref="locateFromRef" :model="needLocateImageIdFormData" style="width: 400px" label-width="auto"
      :rules="locateRules">
      <el-form-item :label="$t('longitude')" prop="GPSLongitude">
        <el-input v-model="needLocateImageIdFormData.GPSLongitude"></el-input>
      </el-form-item>
      <el-form-item :label="$t('latitude')" prop="GPSLatitude">
        <el-input v-model="needLocateImageIdFormData.GPSLatitude"></el-input>
      </el-form-item>
      <el-form-item :label="$t('altitude')" prop="GPSAltitude">
        <el-input v-model="needLocateImageIdFormData.GPSAltitude" placeholder="0"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="manualLocateImage" class="locate-button" type="primary">{{ $t('manualLocate')}}</el-button>
        <el-button @click="cancelLocateImage">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="locateImage(locateFromRef)">
          {{ $t('confirm') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
  <!-- 单张图片分组设置弹框 -->
  <GroupInfoDialog v-model="groupDialogShow" :imageIds="editImageIds"></GroupInfoDialog>
</template>

<script lang="ts" setup>
import { ref, watch, computed, reactive, onMounted } from 'vue'
import ExifReader from 'exifreader'
import { ElMessage, ElLoading } from 'element-plus'
import { ArrowUpBold, ArrowDownBold, Delete } from '@element-plus/icons-vue'
import { addImageMarkerToMap, getMarkerById, deleteMarkerInMap, setViewByLatLng, updateVisibleMarkers, addManualLocateImageToMap, addVisibleMarkerById, MAP_INSTANCE } from '@/utils/map'
import { judgeHadUploadImage, saveSchema as SaveSchema, exifDateToTimestamp } from '@/utils/schema'
import { uploadImages as UploadImages, calcMBSize, addImageUrl, getImageUrl, imageUrlsMap } from '@/utils/Image'
import { useSchemaStore } from '@/store/schema'
import { useMapStore } from '@/store/map'
import eventBus from '@/utils/eventBus'
import { wgs84ToGcj02 } from '@/utils/WGS84-GCJ02'
import GroupInfoDialog from '@/components/groupInfo/groupEdit/GroupInfoDialog.vue'
import type { IImageDetailInfo, ICameraDetailInfo, IAuthorDetailInfo } from '@/type/image'
import type { IGPSInfo } from '@/type/schema'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const schemaStore = useSchemaStore()
const props = defineProps({
  map: {
    type: Object
  }
})

const acceptType = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
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
const needLocateImageIdFormData = ref({
  id: null,
  GPSAltitude: null,
  GPSLatitude: null,
  GPSLongitude: null
})

const locateFromRef = ref()

// 上传图片是否展开
const uploadExpand = ref(false)

function isInHasUrlFileList(id) {
  return hasUrlFileList.value.some(item => {
    return item.id === id || item.name == id
  })
}

watch(
  () => elUploadFileList.value,
  async (newValue) => {
    // 如果无值直接清空
    if (newValue?.length === 0) {
      hasUrlFileList.value = []
    } else {
      for (let i = 0; i < newValue.length; i++) {
        const imageName = newValue[i].name
        // 如果没有的话
        if (!isInHasUrlFileList(imageName)) {
          const file = newValue[i].raw
          // res包括id, lasetModified, name, size, type
          const res1 = getFileInfoByFile(file)
          // 通过exifReader插件获取包括GPSInfo，ImageInfo, CameraInfo, AuthorInfo等信息
          const res2 = await setMoreInfoByExifReader(file)
          const existUrl = imageUrls.value[imageName] || imageUrlsMap.get(imageName)
          // 如果本身不在urls里面，说明是后面加的，需要获取到base64的url
          if (!existUrl) {
            // 完整的base64用于图片上传
            const url = await readFileAsDataURL(file);
            // 相对路径，用于未上传前的展示，相较于使用url，dom性能更优化一些
            const blobUrl = await fileToBlobUrl(file);
            imageUrls.value[imageName] = blobUrl
            // 保存到imageUrlsMap中，后续图片详情展示使用
            addImageUrl(imageName, blobUrl)
            hasUrlFileList.value[i] = { ...res1, ...res2, url, blobUrl }
          } else {
            // 如果已经有了，直接拿过来用
            hasUrlFileList.value[i] = { ...res1, ...res2, url: existUrl }
          }
          // 如果有坐标内容的话，在地图上添加对应的marker
          if (res2?.GPSInfo?.GPSLatitude && res2?.GPSInfo?.GPSLongitude) {
            // 只有还没有上传过的图片需要添加到地图中
            !judgeHadUploadImage(imageName) && addImageMarkerToMap(hasUrlFileList.value[i])
          }
        }
      }
    }
  }
)

function fileToBlobUrl(file: File | Blob): string {
  return URL.createObjectURL(file)
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
    updateVisibleMarkers()
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
function getFileInfoByFile(file) {
  const { lastModified, name, size, type } = file
  // id通过name和type来生成
  const id = name
  return { id, lastModified, name, size, type }
}


// 从图片信息对象中提取GPS信息，并添加到地图里面
async function setMoreInfoByExifReader(file, name?) {
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
  return {
    // 分辨率
    Resolution: `${exif?.PixelYDimension?.value} x ${exif?.PixelXDimension?.value}`,
    // 亮度
    BrightnessValue: exif?.BrightnessValue?.value,
    // 大小
    size: calcMBSize(file.size)
  }
}

const needUploadImageLoading = ref(false)
const uploadedImageLoading = ref(false)
const loadingInstance = ref()

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
function uploadImage(name) {
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
function deleteImage(name) {
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
  const marker = getMarkerById(name)
  // 删除掉marker
  deleteMarkerInMap(marker)
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
  // 对有定位信息的图片进行上传
  const locateImageInfos = cloneDeep(imageInfos).filter(item => {
    return item.GPSInfo.GPSLatitude && item.GPSInfo.GPSLongitude
  })
  if (locateImageInfos.length < 1) {
    ElMessage.warning(t('description.noPictureCanUpload'))
    return
  }
  // subimtData.append('data', 123)
  // 上传图片一定要用UploadImages因为有特殊操作，而且要先上传图片再保存schema
  const res1 = await UploadImages(locateImageInfos)
  // 所有setSchema方法都必须调用saveSchmea，因为在保存前需要有特殊操作
  const res2 = await SaveSchema()
  const allSuccess = res1.every(res => {
    return res.code === 200
  })
  if (allSuccess && res2.code === 200) {
    ElMessage.success(t('description.pictureUploadedSuccess'))
    // 上传完成后，点击右键可以出现操作菜单
  } else if (!allSuccess && res2.code === 200) {
    ElMessage.success(t('description.somePictureUploadedSuccess'))
  }
}

/**
 * @description: 为没有位置的图片设置定位信息
 * @param {*} id
 * @return {*}
 */
function showLocateDialog(id) {
  locateDialogShow.value = true
  needLocateImageIdFormData.value.id = id
}

/**
 * @description: {{ $t('cancel') }}定位
 * @return {*}
 */
function cancelLocateImage() {
  resetLocateForm()
  locateDialogShow.value = false
}

/**
 * @description: 情空表单
 * @return {*}
 */
function resetLocateForm() {
  // 清空form表单的数据
  Object.keys(needLocateImageIdFormData.value).forEach(key => {
    needLocateImageIdFormData.value[key] = null
  })
}

/**
 * @description: 定位图片，将数据保存到schema中
 * @return {*}
 */
async function locateImage(locateFromRef) {
  if (!locateFromRef) return
  await locateFromRef.validate((valid, fields) => {
    if (valid) {
      console.log(needLocateImageIdFormData.value)
      if (needLocateImageIdFormData.value.id) {
        const { GPSLatitude, GPSAltitude, GPSLongitude = 0 } = needLocateImageIdFormData.value
        const imageInfo = needUploadImageInfos.value.find(item => {
          return item.id === needLocateImageIdFormData.value.id
        })
        imageInfo.GPSInfo = { GPSLatitude, GPSAltitude, GPSLongitude }
      }
      locateDialogShow.value = false

      console.log('submit!')
    } else {
      console.log('error submit!', fields)
    }
  })
}

// 手动定位校验规则
const locateRules = reactive({
  GPSLongitude: [{
    required: true,
    message: t('description.needLongitude'),
    trigger: 'change',
  }],
  GPSLatitude: [{
    required: true,
    message: t('description.needLatitude'),
    trigger: 'change',
  }]
})

/**
 * @description: 手动定位
 * @return {*}
 */
async function manualLocateImage() {
  const mapStore = useMapStore()
  locateDialogShow.value = false
  const fileInfo = hasUrlFileList.value.find(item => {
    return item.id === needLocateImageIdFormData.value.id
  })
  const markerLatLng = MAP_INSTANCE.getCenter()
  needLocateImageIdFormData.value.GPSLatitude = markerLatLng.lat
  needLocateImageIdFormData.value.GPSLongitude = markerLatLng.lng
  const marker = addManualLocateImageToMap(fileInfo, markerLatLng.lat, markerLatLng.lng)
  // 加入marker
  mapStore.addMarkerId(marker.options.id)
  // 加入visibleMarker
  addVisibleMarkerById(marker.options.id)
  updateFromLocateInfo(marker, fileInfo)
  marker.on('moveend', () => {
    updateFromLocateInfo(marker, fileInfo)
  })
}

function updateFromLocateInfo(marker, fileInfo) {
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
const editImageIds = ref([])
/**
 * @description: 
 * @return {*}
 */
function showGroupDialog(imageId) {
  editImageIds.value = [imageId]
  groupDialogShow.value = true
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
.bottom-button {
  margin: 10px 5px !important;
}

.img-upload {
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  padding: 10px 0 0 10px;

}

:deep(.el-upload-list) {
  display: none;
}

.img-cards {
  max-height: calc(100vh - 100px);
  overflow: auto;
}

.h3-title {
  font-size: 12px;
  color: gray;
  margin-top: 5px;
}

.duplicate-image-box {
  transition: all 0.3s;
  margin-right: 10px;
  max-width: 200px;
  height: fit-content;
  padding: 0 0 5px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.185);

  .button-flex {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 35px;
    .el-button {
      width: 90px;
    }
  }

  .upload-image-box {
    transition: 0.3s height;
    height: fit-content;
  }
}



.upload-img-card {
  display: flex;
  position: relative;
  max-width: 300px;
  margin-right: 3px;
  border-width: 1px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0);
  padding: 5px;
  border-radius: 5px;
  margin-top: 5px;
  transition: 0.3s;

  h1 {
    font-size: 12px;
  }

  .image-info {
    margin-right: 20px;
  }

  .uplod-delete-buttons {
    width: 40px;
    height: 100%;
    opacity: 0;
    position: absolute;
    display: flex;
    flex-direction: column;
    top: 0;
    right: 0;
    font-size: 12px;
    color: white;
    background-color: rgb(154, 154, 154);

    div {
      cursor: pointer;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
  }
}

.upload-img-card:hover {
  background-color: rgba(232, 232, 232, 0.4);
  border-color: rgba(0, 0, 0, 0.2);

  .uplod-delete-buttons {
    opacity: 1;

    div:hover {
      background-color: rgb(114, 114, 114);
    }
  }
}

.duplicate-upload-img-card {
  display: inline-block;
  margin: 1px 2px;
}

img {
  cursor: pointer;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;

  .locate-button {
    flex: 1;
    margin-right: 50px;
    margin-left: 10px;
    justify-self: flex-start
  }
}

:deep() {
  .el-form-item--default .el-form-item__label {
    line-height: 16px;
    align-items: center;
  }
}
</style>
