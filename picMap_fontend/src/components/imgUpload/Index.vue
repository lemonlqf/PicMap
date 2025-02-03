<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 13:10:15
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-03 19:44:20
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
      <div class="duplicate-image-box" v-show="duplicateFormData.length">
        <!-- 重复的图片 -->
        <h3>已上传图片：</h3>
        <div class="duplicate-upload-img-card" v-for="(item, index) in duplicateFormData">
          <img :src="item.url" alt="" :title="item.name" height="50px" :key="item.url" />
          <!-- <h1>照片名:{{ item.name }}</h1>
        <h1>纬度:{{ item?.GPSInfo?.GPSLatitude }}</h1>
        <h1>经度:{{ item?.GPSInfo?.GPSLongitude }}</h1> -->
        </div>
      </div>
      <div v-show="noDuplicateFormData.length">
        <h3>待上传图片：</h3>
        <div class="upload-img-card" v-for="(item, index) in noDuplicateFormData" :key="item.name">
          <div class="image-info" >
            <img :src="item.url" alt="" :title="item.name" height="50px" />
            <h1>照片名:{{ item.name }}</h1>
            <h1>纬度:{{ item?.GPSInfo?.GPSLatitude }}</h1>
            <h1>经度:{{ item?.GPSInfo?.GPSLongitude }}</h1>
            <!-- <h1>id: {{ item.id }}</h1> -->
          </div>
          <div class="uplod-delete-buttons">
            <div @click="uploadImage(item.name)">
              <img src="@/assets/icon/上传 (白色).png" width="20px">上传</img>
            </div>
            <div @click="deleteImage(item.name)">
              <img src="@/assets/icon/删除 (白色).png" width="20px">删除</img>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
    <!-- 测试用，后续删除 -->
    <el-button v-if="noDuplicateFormData.length" @click="uploadImages(noDuplicateFormData)" type="primary">批量上传</el-button>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import ExifReader from 'exifreader'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import { addImageIconToMap, getMarkerById, deleteMarkerInMap } from '@/utils/map.js'
import { isExistInImageInfo } from '@/utils/schema.js'
import { useSchemaStore } from '@/store/schema'
import API from '@/http/index.js'
import { v5 as uuidv5 } from 'uuid'
import { before, cloneDeep } from 'lodash-es'
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/utils/WGS84-GCJ02.js'

const schemaStore = useSchemaStore()
const props = defineProps({
  map: {
    type: Object
  }
})

// 缩略图地址数组，没有重复的
const noDuplicateImageUrls = ref({})
// 缩略图地址数组，有重复的
const duplicateImageUrls = ref({})
// 图片gps信息，通过el-upload获取的fileList没有这个数据，用这个额变量暂时存一下，后续在formData中添加对应数据
const GPSInfo = ref({})
// 上传组件获取到的文件
const elUploadFileList = ref([])

// 过滤掉重复图片后的实际用于上传的文件
const noDuplicateFileList = computed(() => {
  // 点击上传后，schema中默认有相关的图片了，因此在schema中的图片会消失
  return elUploadFileList.value.filter(item => {
    const fileInfo = getFileInfoByFile(item.raw)
    // 如果已经在schema里的图片（同名的图片）就不在上传了
    return !isExistInImageInfo(fileInfo.id)
  })
})

// 重复的图片
const duplicateFileList = computed(() => {
  // 点击上传后，schema中默认有相关的图片了，因此在schema中的图片会消失
  return elUploadFileList.value.filter(item => {
    const fileInfo = getFileInfoByFile(item.raw)
    // 如果已经在schema里的图片（同名的图片）就不在上传了
    return isExistInImageInfo(fileInfo.id)
  })
})

// 提交的表单信息，最全，包括所有其他信息，这里是没有重复的图片
const noDuplicateFormData = computed(() => {
  const res = []
  if (noDuplicateFileList.value?.length > 0) {
    for (let i = 0; i < noDuplicateFileList.value.length; i++) {
      const imageName = noDuplicateFileList.value[i].name
      // 获取文件信息
      const fileInfo = getFileInfoByFile(noDuplicateFileList.value[i].raw)
      res[i] = { GPSInfo: GPSInfo.value[imageName], ...fileInfo, url: noDuplicateImageUrls.value[imageName] }
    }
  }
  return res
})

// 提交的表单信息，最全，包括所有其他信息
const duplicateFormData = computed(() => {
  const res = []
  if (duplicateFileList.value?.length > 0) {
    for (let i = 0; i < duplicateFileList.value.length; i++) {
      const imageName = duplicateFileList.value[i].name
      // 获取文件信息
      const fileInfo = getFileInfoByFile(duplicateFileList.value[i].raw)
      res[i] = { GPSInfo: GPSInfo.value[imageName], ...fileInfo, url: duplicateImageUrls.value[imageName] }
    }
  }
  return res
})

/**
 * @description: 上传在左侧上传列表中的单张照片
 * @param {*} name
 * @return {*}
 */
function uploadImage(name) {
  const data = noDuplicateFormData.value.filter(item => {
    return item.id === name
  })
  uploadImages(data)
}

/**
 * @description: 删除在左侧上传列表中的单张照片
 * @param {*} name
 * @return {*}
 */
function deleteImage(name) {
  elUploadFileList.value = elUploadFileList.value.filter(item => {
    return item.name !== name
  })
  // 获取对应的marker，name和id是一样的
  const marker = getMarkerById(name)
  // 删除掉marker
  deleteMarkerInMap(marker, props.map)

  console.log('---',elUploadFileList.value)
}

// 通过raw文件获取相关的文件数据
function getFileInfoByFile(raw) {
  const { lastModified, name, size, type } = raw
  // id通过name和type来生成
  const id = name
  return { id, lastModified, name, size, type }
}

// 从图片信息对象中提取GPS信息，并添加到地图里面
async function setInfoByExifReader(file, name) {
  const tags = await ExifReader.load(file, { expanded: true })
  // 设置经纬度
  setGPSInfo(tags, name)
  // TODO:设置其他值
  // setxxxInfo(tags, index)

  // TODO:设置完后，在地图里面生产对应的节点，名字再取
  addMarkerToMap()
}

// 获取不同图片经纬度信息
function setGPSInfo(tags, name) {
  let GPSLatitude = ''
  let GPSLongitude = ''
  if (tags.gps) {
    // 坐标是WGS84标准的，国内坐标是GCJ02标准的，需要转化
    const GcGPSInfo = wgs84ToGcj02(tags.gps.Longitude, tags.gps.Latitude)
    GPSLongitude = GcGPSInfo[0]
    GPSLatitude = GcGPSInfo[1]
  }
  GPSInfo.value[name] = { GPSLatitude, GPSLongitude }
}

/**
 * @description: 在地图中添加图片标记
 * @return {*}
 */
function addMarkerToMap() {
  // 显示图像
  noDuplicateFormData.value.forEach(item => {
    if (item?.GPSInfo?.GPSLatitude && item?.GPSInfo?.GPSLongitude) {
      addImageIconToMap(props.map, item)
    }
  })
}

// 无重复的图片文件
watch(
  () => noDuplicateFileList.value,
  newValue => {
    for (let i = 0; i < newValue.length; i++) {
      const imageName = newValue[i].name
      // 如果本身不在urls里面，说明是后面加的，需要获取到base64的url
      if (!noDuplicateImageUrls.value[imageName]) {
        const fr = new FileReader()
        const file = newValue[i].raw
        // 获取base64的url，用于缩略图展示，不用于表单
        fr.readAsDataURL(file)
        fr.onload = function () {
          // 暂存在数组中，最后赋值给缩略图
          noDuplicateImageUrls.value[imageName] = fr.result
          // 设置数据
          setInfoByExifReader(file, imageName)
        }
      }
    }
  }
)

// 有重复的图片文件
watch(
  () => duplicateFileList.value,
  newValue => {
    for (let i = 0; i < newValue.length; i++) {
      const imageName = newValue[i].name
      // 如果本身不在urls里面，说明是后面加的，需要获取到base64的url
      if (!duplicateImageUrls.value[imageName]) {
        const fr = new FileReader()
        const file = newValue[i].raw
        // 获取base64的url，用于缩略图展示，不用于表单
        fr.readAsDataURL(file)
        fr.onload = function () {
          // 暂存在数组中，最后赋值给缩略图
          duplicateImageUrls.value[imageName] = fr.result
          // 设置数据
          setInfoByExifReader(file, imageName)
        }
      }
    }
  }
)

// 添加图片
async function uploadImages(data) {
  // subimtData.append('data', 123)
  const res1 = await API.image.uploadImages({ images: data })
  // 删除url属性
  const noUrlFormData = cloneDeep(noDuplicateFormData.value).map(item => {
    delete item.url
    return item
  })
  // 在schema的imageInfo中添加图片信息
  schemaStore.pushImagesToImageInfo(noUrlFormData)
  const newSchema = schemaStore.getSchema
  const res2 = await API.schema.setSchema({ schema: JSON.stringify(newSchema) })
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
</style>
