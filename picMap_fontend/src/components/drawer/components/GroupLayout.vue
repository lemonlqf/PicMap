<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-28 14:48:46
 * @FilePath: \PicMap\picMap_fontend\src\components\drawer\components\GroupLayout.vue
 * @Description: 分组布局组件
 *   - 按时间分组展示图片
 *   - 通过emit事件通知父组件显示图片详情
-->
<template>
  <div>
    <div class="group-layout">
      <div class="button-box">
        <TimePrecision class="precision" v-model="precision"></TimePrecision>
        <Sort class="sort" v-model="sort"></Sort>
      </div>
      <!-- 按时间分组 -->
      <div v-for="key in groupImageSortMap.keys()" :key="key">
        <!-- 时间 -->
        <h1>{{ key }}</h1>
        <!-- 图片 -->
        <div class="flex-box">
          <template v-for="item in (groupImageSortMap.get(key) as string[])">
            <div class="image-card">
              <!-- 点击图片触发showImageInfo事件，由父组件统一处理弹框 -->
              <Image @click="(e) => handleImageClick(e, item.id)" :show-name="true" class="image" :perview="false"
                :image-id="item.id">
              </Image>
              <!-- 退出分组 -->
              <div class="exit-group" @click="clickExitGroup($event, groupId, item.id)">
                <img src="@/assets/icon/退出.png" alt="" width="30px" :title="$t('exitGroup')" />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType, computed, ref } from 'vue'
import { groupSorting, TimeType, SortType, removeGroupImage } from '@/utils/group'
import { getSchemaInfoById } from '@/utils/schema'
import Image from '@/components/drawer/components/Image.vue';
import Sort from './Sort.vue'
import TimePrecision from './TimePrecision.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  groupNumbers: {
    type: Object as PropType<string[]>,
    default: () => ([])
  },
  groupId: {
    type: String,
    default: ''
  }
})

// 定义事件：通知父组件显示图片详情
const emit = defineEmits<{
  (e: 'showImageInfo', imageId: string): void
}>()

// 分组的时间精度
const precision = ref<TimeType>(TimeType.YEAR)
const sort = ref<SortType>(SortType.DES)

const groupImageInfos = computed(() => {
  return props.groupNumbers.map((imageId: string) => {
    const imageInfo = getSchemaInfoById(imageId) as any
    // 如果没有找到图片信息，说明图片可能没有上传，只是把id保存在分组里面了，这时直接返回原来的id就可以了
    return { id: imageInfo?.id ?? imageId, time: imageInfo?.authorInfo.DateTime }
  })
})

// 经过排序分组的图片
const groupImageSortMap = computed<Map<string, any[]>>(() => {
  return groupSorting(groupImageInfos.value, precision.value, sort.value)
})

/**
 * 处理图片点击事件
 * @param e 鼠标事件
 * @param id 图片ID
 */
function handleImageClick(e: MouseEvent, id: string) {
  const target = e.target as any
  // 如果是下载就不显示图片详情
  if (target?.title === t('downloadPicture')) {
    return
  }
  // 通知父组件显示图片详情
  emit('showImageInfo', id)
}

function clickExitGroup(e: MouseEvent, groupId: string, imageId: string) {
  e.stopPropagation() // 阻止事件冒泡，避免触发图片预览
  removeGroupImage(groupId, imageId)
}
</script>

<style lang="scss" scoped>
.group-layout {
  padding: 0 20px 20px 20px;

  .button-box {
    z-index: 1;
    position: sticky;
    top: 8px;
    margin-top: 10px;
    padding: 3px;
    display: flex;
    align-items: center;

    .sort {
      margin-left: 5px;
      ;
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
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  position: relative;
  gap: 10px;

  .image-card {
    position: relative;

    .image {
      border-radius: 3px;
      overflow: hidden;
      height: 120px;
      width: 170px;
    }

    .exit-group {
      position: absolute;
      // height: fit-content;
      right: 5px;
      bottom: 0px;
      transition: all 0.2s;
      position: absolute;
      cursor: pointer;
      pointer-events: all;
      opacity: 0;
    }

    .exit-group:hover {
      opacity: 1 !important;
    }
  }

  .image-card:hover {
    .exit-group {
      opacity: 0.7;
    }
  }
}
</style>
