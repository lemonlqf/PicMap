<!--
 * @Author: Do not edit
 * @Date: 2025-07-08 19:51:53
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-09 20:14:21
 * @FilePath: \PicMap\Code\picMap_fontend\src\components\mapTileEditor\components\MapTileCard.vue
 * @Description: 
-->
<template>
  <div class="card">
    <!-- 预览，允许操作 -->
    <div class="preview" ref="mapRef">
      <el-switch class="active-button" v-model="active"></el-switch>
    </div>
    <div class="content">
      <ImageUpload style="width: 120px"></ImageUpload>
      <div class="info">
        <h3 class="title">瓦片名称</h3>
        <span class="value">{{ name }}</span>
        <h3 class="title">地址</h3>
        <span class="value">{{ url }}</span>
      </div>
      <div class="buttons">
        <el-button :icon="Edit" type="primary">编辑</el-button>
        <el-button :icon="Delete" type="danger">删除</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import ImageUpload from '@/components/imgUpload2/ImageUpload.vue'
import { Delete, Edit, Back } from '@element-plus/icons-vue'
import L from 'leaflet'
const props = defineProps({
  url: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: '未设置'
  },
  img: {
    type: String,
    default: ''
  }
})
const active = ref(false)
const mapRef = ref()
function initTile() {
  var map = L.map(mapRef.value, {
    zoom: 10, //初始缩放，因为在下文写了展示全地图，所以这里不设置，也可以设置
    minZoom: 3,
    maxZoom: 18, // 目前小于18不显示了
    center: [30.2489634, 120.2052342],
    zoomControl: false, //缩放组件
    attributionControl: false //去掉右下角logol
  })

  // 添加瓦片图层（OpenStreetMap）
  L.tileLayer(props.url, {
    attribution: '&copy; <p>OpenStreetMap</p> contributors'
  }).addTo(map);
}

onMounted(() => {
  initTile()
})
</script>

<style scoped lang="scss">
.card {
  transition: all 0.3s;
  width: 100%;
  height: fit-content;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.342);
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;

  .preview {
    position: relative;
    height: 100px;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.349);
    // border-bottom: 1px solid rgba(0, 0, 255, 0.349);

    :deep() {
      .active-button {
        z-index: 998;
        position: absolute;
        top: 10px;
        right: 15px;


        .el-switch__core {
          background-color: rgba(115, 115, 119, 0.986);
        }

      }

      .el-switch.is-checked .el-switch__core {
        background: rgb(43, 130, 243);
      }
    }
  }

  .content {
    padding: 10px;
    display: flex;
    position: relative;
    overflow: hidden;

    .info {
      flex: 1;
      // padding: 10px;
      display: flex;
      flex-direction: column;
      // justify-content: space-between;
      margin-left: 15px;

      .title {
        font-size: 13px;
        color: rgb(27, 25, 122);
        font-weight: 500;
      }

      .value {
        font-size: 15px;
        color: rgb(43, 43, 43);
        margin-bottom: 5px;
      }

      .value:nth-of-type(2) {
        height: 45px;
      }
    }

    .buttons {
      transition: all 0.2s;
      // height: 40px;
      // padding: 0 11px;
      position: absolute;
      transform: translateX(100px);
      right: 0;
      top: 0;
      bottom: 0;
      right: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 15px;

      .el-button {
        margin: 0;
      }
    }
  }

  .content:hover {
    .buttons {
      transform: translateX(0);
    }
  }



}

.card:hover {
  transform: scale(1.01);
  box-shadow: 0 0 7px rgba(0, 0, 0, 0.651);
}
</style>