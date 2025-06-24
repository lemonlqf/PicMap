<template>
  <div class="group-layout">
    <div class="button-box">
      <el-radio-group v-model="precision" size="small">
        <template v-for="item in radioOptions">
          <el-radio-button :label="item.label" :value="item.value" />
        </template>
      </el-radio-group>
      <Sort class="sort" v-model="sort"></Sort>
    </div>
    <!-- 按时间分组 -->
    <div v-for="key in groupImageSortMap.keys()" :key="key">
      <h1>{{ key }}</h1>
      <!-- 图片 -->
      <div class="flex-box">
        <template v-for="item in (groupImageSortMap.get(key) as string[])">
          <Image @click="(e) => showImageInfo(e, item.id)" :show-name="true" class="image" :perview="false"
            :image-id="item.id">
          </Image>
        </template>
      </div>
    </div>
  </div>
  <!-- 图片信息弹框 -->
  <el-dialog class="image-info-dialog" width="760px" :show-close="false" v-model="imageInfoDialogShow">
    <div class="image-info-box">
      <Image class="image" :image-id="imageId" :key="imageId"></Image>
      <ImageInfoComponent :imageInfo="imageInfo"></ImageInfoComponent>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { type PropType, computed, ref } from 'vue'
import { groupSorting, TimeType, SortType } from '@/utils/group'
import { getSchemaInfoById } from '@/utils/schema'
import Image from '@/components/drawer/components/Image.vue';
import ImageInfoComponent from '@/components/drawer/components/ImageInfo.vue'
import Sort from './Sort.vue'

const props = defineProps({
  groupNumbers: {
    type: Object as PropType<string[]>,
    default: () => ([])
  }
})

const radioOptions = [
  {
    label: '年',
    value: TimeType.YEAR
  },
  {
    label: '月',
    value: TimeType.MONTH
  },
  {
    label: '日',
    value: TimeType.DAY
  },
]

const imageInfoDialogShow = ref(false)
// 给弹框使用的
const url = ref('')
const imageId = ref('')
const imageInfo = ref()
// 分组的时间精度
const precision = ref<TimeType>(TimeType.YEAR)
const sort = ref<SortType>(SortType.DES)

const groupImageInfos = computed(() => {
  return props.groupNumbers.map((imageId: string) => {
    const imageInfo = getSchemaInfoById(imageId) as any
    return { id: imageInfo.id, time: imageInfo.authorInfo.DateTime }
  })
})

// 经过排序分组的图片
const groupImageSortMap = computed<Map<string, any[]>>(() => {
  return groupSorting(groupImageInfos.value, precision.value, sort.value)
})


function showImageInfo(e: MouseEvent, id: string) {
  const target = e.target as any
  // 如果是下载就不显示图片详情
  if (target?.title === '下载原图') {
    return
  }
  imageInfoDialogShow.value = true
  imageId.value = id
  setImageInfo(id)
  console.log(target.title)
}

/**
 * @description: 通过imageId获取图片信息
 * @param {*} imageId
 * @return {*}
 */
async function setImageInfo(imageId: string) {
  const imageInfoDetail = getSchemaInfoById(imageId) as any
  imageInfo.value = imageInfoDetail
}
</script>

<style lang="scss" scoped>
.group-layout {
  padding: 0 20px 20px 20px;
  .button-box {
    z-index: 99;
    position: sticky;
    top: 8px;
    margin-top: 10px;
    padding: 3px;
    display: flex;
    align-items: center;
    .sort {
      margin-left: 5px;;
    }
  }

  h1 {
    height: 17px;
    color: rgb(0, 0, 0);
    font-size: 17px;
    line-height: 17px;
  }
}

.flex-box {
  display: flex;

  .image {
    border-radius: 3px;
    overflow: hidden;
    margin-right: 10px;
    height: 120px;
    width: 170px;
  }
}

.image-info-box {

  .image {
    width: 100%;
    height: 300px;
    margin-bottom: 15px;
    border-radius: 8px;

  }
}
</style>

<style>
.image-info-dialog {
  margin-top: 80px !important;
  background-color: rgba(160, 160, 160, 0.938) !important;

  .el-dialog__header {
    display: none !important;
  }
}
</style>