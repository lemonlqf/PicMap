<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 13:10:15
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2025-01-25 20:58:48
 * @FilePath: \Code\picMap_fontend\src\components\imgUpload\Index.vue
 * @Description: 
-->
<template>
  <el-upload
    v-model:file-list="fileList"
    class="upload-demo"
    action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15"
    :auto-upload="false"
    :multiple="true"
  >
    <el-button type="primary">Click to upload</el-button>
    <template #tip>
      <div class="el-upload__tip">jpg/png files</div>
    </template>
  </el-upload>
  <!-- 上传到表单中图片数据 -->
  <template v-for="item in formData">
    <div class="upload-img-card">
      <img :src="item.file.url" alt="" width="50px" height="50px" />
      <h1>照片名:{{ item.file.name }}</h1>
      <h1>纬度:{{ item?.GPSInfo?.GPSLatitude }}</h1>
      <h1>经度:{{ item?.GPSInfo?.GPSLongitude }}</h1>
    </div>
  </template>
  <!-- 测试用，后续删除 -->
  <el-button @click="uploadImages">上传图片</el-button>
  <el-button @click="deleteImgs">删除</el-button>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import ExifReader from 'exifreader'
import L from 'leaflet'
import API from '@/http/index.js'

const props = defineProps({
  map: {
    type: Object
  }
})

const fileList = ref()
// 缩略图地址数组
const thumbnailImageUrls = ref([])
// 图片gps信息
const GPSInfo = ref([])

// 提交的表单信息，最全，包括所有其他信息，除了缩略图
const formData = computed(() => {
  const res = []
  if (fileList.value?.length > 0) {
    for (let i = 0; i < fileList.value.length; i++) {
      // 获取文件信息
      const fileInfo = getFileInfoByFile(fileList.value[i].raw)
      res[i] = { GPSInfo: GPSInfo.value[i], file: { ...fileInfo, url: thumbnailImageUrls.value[i] } }
    }
  }
  return res
})

// 通过raw文件获取相关的文件数据
function getFileInfoByFile(raw) {
  const { uid, lastModified, name, size, type } = raw
  return { uid, lastModified, name, size, type }
}

// 从图片信息对象中提取GPS信息
async function setInfoByExifReader(file, index) {
  const tags = await ExifReader.load(file, { expanded: true })
  // 设置经纬度
  setGPSInfo(tags, index)
  // TODO:设置其他值
  // setxxxInfo(tags, index)

  // TODO:设置完后，在地图里面生产对应的节点，名字再取
  addMarkerInMap()
}

// 设置GPS数据
function setGPSInfo(tags, index) {
  let GPSLatitude = ''
  let GPSLongitude = ''
  if (tags.gps) {
    GPSLatitude = tags.gps.Latitude
    GPSLongitude = tags.gps.Longitude
  }
  GPSInfo.value[index] = { GPSLatitude, GPSLongitude }
}

/**
 * @description: 在地图中添加图片标记
 * @return {*}
 */
function addMarkerInMap() {
  // 显示图像
  formData.value.forEach(item => {
    if (item?.GPSInfo?.GPSLatitude && item?.GPSInfo?.GPSLongitude) {
      const myIcon = L.icon({
        iconUrl: item.file.url,
        iconSize: [40, 40]
      })
      // 先纬度再经度
      L.marker([item.GPSInfo.GPSLatitude, item.GPSInfo.GPSLongitude], { icon: myIcon }).addTo(props.map)
    }
  })
}

watch(
  () => fileList.value,
  newValue => {
    // 清空GPS数据
    GPSInfo.value = []

    const tempUrlList = []
    for (let i = 0; i < newValue.length; i++) {
      const fr = new FileReader()
      const file = newValue[i].raw
      // 获取base64的url，用于缩略图展示，不用于表单
      fr.readAsDataURL(file)
      fr.onload = function () {
        // 暂存在数组中，最后赋值给缩略图
        tempUrlList.push(fr.result)
        // 当数组中的数量和文件上传的数量相同时，说明转化完了，此时用于缩列图渲染
        if (tempUrlList.length === fileList.value.length) {
          thumbnailImageUrls.value = tempUrlList
        }
      }
      // 设置数据
      setInfoByExifReader(file, i)
    }
  }
)

// 添加图片
async function uploadImages() {
  console.log(formData.value, GPSInfo.value, fileList.value, thumbnailImageUrls.value)
  // subimtData.append('data', 123)
  const res = await API.image.uploadImages({ images: formData.value })
  console.log('res =>', res)
}

// TODO:删除图片
function deleteImgs() {
  API.image.uploadImages(123)
}

// TODO:更新图片信息
function updateImgs() {}
</script>

<style lang="scss" scoped>
:deep(.el-upload-list) {
  display: none;
}

.upload-img-card {
  background-color: rgba(255, 255, 255, 0.7);
  padding: 5px;
  border-radius: 5px;
  margin-top: 5px;
  transition: 0.3s;
  h1 {
    font-size: 12px;
  }
}
.upload-img-card:hover {
  transition: 0.3;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 5px 5px rgba(0, 0, 0, 0.1);
}
</style>
