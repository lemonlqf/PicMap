<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 13:10:15
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 20:30:48
 * @FilePath: \Code\picMap_fontend\src\components\imgUpload\Index.vue
 * @Description: 
-->
<template>
  <div class="img-upload">
    <el-upload
      v-model:file-list="elUploadFileList"
      class="upload-demo"
      action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
      :auto-upload="false"
      :multiple="true"
    >
      <el-button style="margin-right: 10px; width: 180px;" type="primary">Click to upload</el-button>
      <template #tip>
        <div class="el-upload__tip">请上传图片</div>
      </template>
    </el-upload>
    <!-- 上传到表单中图片数据 -->
    <el-scrollbar max-height="75vh">
      <div class="duplicate-image-box" v-show="uploadedImageInfos.length">
        <!-- 重复的图片 -->
        <h3>已上传图片：</h3>
        <div class="duplicate-upload-img-card" v-for="(item, index) in uploadedImageInfos" >
          <img :src="item.url" alt="" :title="item.name" height="50px" :key="item.url"  @click="setView(item?.GPSInfo?.GPSLatitude, item?.GPSInfo?.GPSLongitude, props.map)"/>
          <!-- <h1>照片名:{{ item.name }}</h1>
        <h1>纬度:{{ item?.GPSInfo?.GPSLatitude }}</h1>
        <h1>经度:{{ item?.GPSInfo?.GPSLongitude }}</h1> -->
        </div>
      </div>
      <div v-show="needUploadImageInfos.length">
        <h3>待上传图片：</h3>
        <div class="upload-img-card" v-for="(item, index) in needUploadImageInfos" :key="item.name">
          <div class="image-info" >
            <img :src="item.url" alt="" :title="item.name" height="50px" @click="setView(item?.GPSInfo?.GPSLatitude, item?.GPSInfo?.GPSLongitude, props.map)" />
            <h1>照片名:{{ item.name }}</h1>
            <h1>纬度:{{ item?.GPSInfo?.GPSLatitude ?? '无数据' }}</h1>
            <h1>经度:{{ item?.GPSInfo?.GPSLongitude ?? '无数据' }}</h1>
            <!-- <h1>id: {{ item.id }}</h1> -->
          </div>
          <div class="uplod-delete-buttons">
            <div @click="uploadImage1(item.name)">
              <img src="@/assets/icon/上传 (白色).png" width="20px">上传</img>
            </div>
            <div @click="deleteImage1(item.name)">
              <img src="@/assets/icon/删除 (白色).png" width="20px">删除</img>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <!-- 测试用，后续删除 -->
    <el-button v-if="needUploadImageInfos.length" @click="uploadImages(needUploadImageInfos)" type="primary">批量上传</el-button>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import ExifReader from 'exifreader'
import { ElMessage, ElLoading  } from 'element-plus'
import L from 'leaflet'
import { addImageIconToMap, getMarkerById, deleteMarkerInMap, setView, updateVisibleMarkers } from '@/utils/map.js'
import { judgeHadUploadImage, saveSchema as SaveSchema } from '@/utils/schema.js'
import { uploadImages as UploadImages } from '@/utils/image.js'
import { useSchemaStore } from '@/store/schema'
import API from '@/http/index.js'
import { v5 as uuidv5 } from 'uuid'
import { before, cloneDeep, has } from 'lodash-es'
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/utils/WGS84-GCJ02.js'


const schemaStore = useSchemaStore()
const props = defineProps({
  map: {
    type: Object
  }
})

const imageUrls = ref({})
// 图片gps信息，通过el-upload获取的fileList没有这个数据，用这个额变量暂时存一下，后续在formData中添加对应数据
const moreInfo = ref({})
// 上传组件获取到的文件
const elUploadFileList = ref([])
// 最完整的，在el-upload获取到文件的基础上，解析到了GPS和base64Url等信息
const hasUrlFileList = ref([])

function isInHasUrlFileList(id) {
  return hasUrlFileList.value.some(item => {
    return item.id === id || item.name == id
  })
}

watch(
  () => elUploadFileList.value,
  async (newValue) => {
    for (let i = 0; i < newValue.length; i++) {
      const imageName = newValue[i].name
      // 如果没有的话
      if (!isInHasUrlFileList(imageName)) {
        const file = newValue[i].raw
        // res包括id, lasetModified, name, size, type
        const res1 = getFileInfoByFile1(file)
        // 通过exifReader插件获取包括GPSInfo，ImageInfo, CameraInfo, AuthorInfo等信息
        const res2 = await setMoreInfoByExifReader1(file)
        // 如果本身不在urls里面，说明是后面加的，需要获取到base64的url
        if (!imageUrls.value[imageName]) {
          const url = await readFileAsDataURL(file);
          imageUrls.value[imageName] = url
          hasUrlFileList.value[i] = { ...res1, ...res2, url }
        } else {
          // 如果已经有了，直接拿过来用
          hasUrlFileList.value[i] = { ...res1, ...res2, url: imageUrls.value[imageName] }
        }
        // 如果有坐标内容的话，在地图上添加对应的marker
        if (res2?.GPSInfo?.GPSLatitude && res2?.GPSInfo?.GPSLongitude) {
          addImageIconToMap(props.map, hasUrlFileList.value[i])
        }
      }
    }
  }
)

const needUploadImageInfos = computed(() => {
  // 走完更新一波可见的markers
  updateVisibleMarkers(props.map)
  // 更新schema，新的信息保存到schema中
  schemaStore.pushImagesToImageInfo(hasUrlFileList.value)
  // 点击上传后，schema中默认有相关的图片了，因此在schema中的图片会消失
  return hasUrlFileList.value.filter(item => {
    return !judgeHadUploadImage(item.id)
  })
})
const uploadedImageInfos = computed(() => {
  // 点击上传后，schema中默认有相关的图片了，因此在schema中的图片会消失
  return hasUrlFileList.value.filter(item => {
    return judgeHadUploadImage(item.id)
  })
})


// 通过raw文件获取相关的文件数据
function getFileInfoByFile1(file) {
  const { lastModified, name, size, type } = file
  // id通过name和type来生成
  const id = name
  return { id, lastModified, name, size, type }
}


// 从图片信息对象中提取GPS信息，并添加到地图里面
async function setMoreInfoByExifReader1(file, name) {
  const tags = await ExifReader.load(file, { expanded: true })
  console.log('--', tags)
  // 设置经纬度到moreInfo中
  const GPSInfo = getGPSInfo1(tags)
  // 图片信息
  const imageInfo = getImageInfo1(tags)
  // 相机信息
  const cameraInfo = getCameraInfo1(tags)
  // 作者信息
  const authorInfo = getAuthorInfo1(tags)
  // TODO:设置其他值
  // setxxxInfo(tags, name)
  
  return { GPSInfo, imageInfo, cameraInfo , authorInfo}
}

// 获取不同图片经纬度信息
function getGPSInfo1(info) {
  let GPSLatitude = ''
  let GPSLongitude = ''
  let GPSAltitude = 0
  if (info.gps) {
    // 坐标是WGS84标准的，国内坐标是GCJ02标准的，需要转化
    const GcjGPSInfo = wgs84ToGcj02(info.gps.Longitude, info.gps.Latitude)
    GPSLongitude = GcjGPSInfo[0]
    GPSLatitude = GcjGPSInfo[1]
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
function getAuthorInfo1(info) {
  const exif = info.exif
  return {
    // 拍摄时间
    DateTime: exif?.DateTime?.value,
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
function getCameraInfo1(info) {
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
function getImageInfo1(info) {
  const exif = info.exif
  return {
    // 分辨率
    Resolution: `${exif?.PixelYDimension?.value} x ${exif?.PixelXDimension?.value}`,
    // 亮度
    BrightnessValue: exif?.BrightnessValue?.value,

  }
}

const needUploadImageLoading = ref(false)
const uploadedImageLoading = ref(false)
const loadingInstance = ref()

watch(() => [needUploadImageLoading.value, uploadedImageLoading.value], () => {
  if (needUploadImageLoading.value || uploadedImageLoading.value) {
    loadingInstance.value = ElLoading.service({fullscreen: true, text: '图片数据解析中......',})
  } else {
    loadingInstance.value && loadingInstance.value.close()
  }
})


/**
 * @description: 上传在左侧上传列表中的单张照片
 * @param {*} name
 * @return {*}
 */
function uploadImage1(name) {
  const data = needUploadImageInfos.value.filter(item => {
    return item.id === name
  })
  uploadImages(data)
}


/**
 * @description: 删除在左侧上传列表中的单张照片
 * @param {*} name
 * @return {*}
 */
function deleteImage1(name) {
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
  deleteMarkerInMap(marker, props.map)
}

// 通过raw文件获取相关的文件数据
function getFileInfoByFile(raw) {
  const { lastModified, name, size, type } = raw
  // id通过name和type来生成
  const id = name
  return { id, lastModified, name, size, type }
}


async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

// 添加图片
async function uploadImages(imagInfos) {
  // subimtData.append('data', 123)
  // 上传图片一定要用UploadImages因为有特殊操作，而且要先上传图片再保存schema
  const res1 = await UploadImages(imagInfos)
  // 所有setSchema方法都必须调用saveSchmea，因为在保存前需要有特殊操作
  const res2 = await SaveSchema()
  if (res1.code === 200 && res2.code === 200) {
    ElMessage.success('图片上传成功!')
    // 上传完成后，点击右键可以出现操作菜单
  }
}

// TODO:更新图片信息
function updateImgs() {}
</script>

<style lang="scss" scoped>
.img-upload {
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  padding: 10px 0 10px 10px;
}
:deep(.el-upload-list) {
  display: none;
}
.img-cards {
  max-height: calc(100vh - 100px);
  overflow: auto;
}

h3 {
  font-size: 12px;
}

.duplicate-image-box {
  margin-right: 10px;
  max-width: 200px;
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
</style>
