<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-19 11:32:49
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
      <MapComponent :image-ids="groupNumbers" @marker-click="handleMarkerClick" />
    </div>
    <!-- 图片列表 -->
    <el-scrollbar style="width: 100%" :max-height="height">
      <div class="img-boxs">
        <GroupLayout class="img-list" :group-id="groupId" :group-numbers="groupNumbers"
          @show-image-info="handleShowImageInfo"></GroupLayout>
      </div>
    </el-scrollbar>
    <!-- 图片信息弹框：统一在一个地方管理 -->
    <el-dialog class="image-info-dialog" width="760px" :show-close="false" v-model="imageInfoDialogShow">
      <div class="image-info-box">
        <Image class="image" :image-id="imageId" :key="imageId"></Image>
        <ImageInfoComponent :imageInfo="imageInfo"></ImageInfoComponent>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue';
import GroupLayout from './components/GroupLayout.vue';
import MapComponent from '@/components/map/Map.vue'
import { getSchemaInfoById } from '@/utils/schema';
import { DRAWER_HEIGHT } from '@/utils/constant'
import { getGroupInfoByGroupId } from '@/utils/group';
import eventBus from '@/utils/eventBus'
import { useI18n } from 'vue-i18n'
import Image from './components/Image.vue';
import ImageInfoComponent from './components/ImageInfo.vue'

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
  if (groupNumbers.length === 0) {
    eventBus.emit('drawer-hidden')
  }
  return groupNumbers
})

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
 * 处理小地图marker点击事件
 * @param imageId 图片ID
 */
function handleMarkerClick(imageId: string) {
  showImageInfoById(imageId)
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
