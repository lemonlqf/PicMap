<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-27 21:14:34
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\Index.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <!-- 将图片右键和分组右键拆分一下 -->
  <div :class="{ menu: true, 'is-show': isShow }">
    <div class="menu-item" v-for="item in menuList" @click="item.clickEvent">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from 'vue'
import eventBus from '@/utils/eventBus'
import API from '@/http/index'
import { useSchemaStore } from '@/store/schema'
import { ElMessage } from 'element-plus'
import { judgeHadUploadImage, saveSchema } from '@/utils/schema'
import { deleteMarkerInMap } from '@/utils/map'

const props = defineProps({
  map: {}
})
const schemaStore = useSchemaStore()
const isShow = ref(false)
const marker = ref({})
const postionInfo = ref({
  left: '10px',
  top: '0px'
})
const menuList = ref([
  {
    label: '删除图片',
    clickEvent: async () => {
      // 在schema的imageInfo中添加图片信息
      schemaStore.deleteImageInImageInfo(marker.value.options.id)
      // 通知上传组件，删除对应的文件
      eventBus.emit('delete-image', marker.value.options.id)
      saveSchema()
      Promise.all([API.image.deleteImages({ deleteImages: [marker.value.options.id] })]).then(res => {
        deleteMarkerInMap(marker.value, props.map)
        const tipMsg = res.reduce((msg, item) => {
          return msg + item.data
        }, '')
        ElMessage.success(tipMsg)
        // console.log('promise all ==>', res)
      })
      // 删除后隐藏右键菜单
      isShow.value = false
    }
  },
  {
    label: '设置分组',
    clickEvent: async () => {
      // 编辑分组信息
      eventBus.emit('edit-group', marker.value.options.id)
      ElMessage.success('设置分组')
      // 删除后隐藏右键菜单
      isShow.value = false
    }
  }
])

function getPxValue(value) {
  if (typeof value === 'string') {
    return value
  } else {
    return `${value}px`
  }
}

function menuShow(event) {
  // 如果marker不在schema中，则说明是临时添加的，不需要出现右键的菜单
  if (!judgeHadUploadImage(event.target.options.id)) {
    return
  }
  console.log(event)
  const { x, y } = event.originalEvent
  marker.value = event.target
  postionInfo.value.left = getPxValue(x ?? 0)
  postionInfo.value.top = getPxValue(y ?? 0)
  isShow.value = true
}

function menuHidden() {
  isShow.value = false
}

function menuShowChange() {
  isShow.value = !isShow.value
}

onMounted(() => {
  eventBus.on('show-content-menu', menuShow)
  eventBus.on('hidden-content-menu', menuHidden)
})

onUnmounted(() => {
  eventBus.off('show-content-menu', menuShow)
  eventBus.off('hidden-content-menu', menuHidden)
})
</script>

<style lang="scss" scoped>
.menu {
  display: inline-block;
  position: fixed;
  transform: translate(15px, 15px);
  top: 0;
  left: v-bind('postionInfo.left');
  top: v-bind('postionInfo.top');
  opacity: 0;
  z-index: -1;
  background-color: rgba(255, 255, 255, 1);

  .menu-item {
    border-color: rgb(104, 104, 228);
    padding: 2px 13px 5px 13px;
    cursor: pointer;
    pointer-events: none;

    span {
      font-size: 14px;
      position: relative;
      text-overflow: ellipsis;
      color: rgb(96, 98, 102);
      height: 25px;
      box-sizing: border-box;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
    }
  }

  .menu-item:hover {
    background-color: rgb(226, 226, 226);
  }

  .menu-item:last-child {
    border-bottom: 0px;
  }
}

.is-show {
  opacity: 1;
  z-index: 999999;

  .menu-item {
    pointer-events: all;
  }
}
</style>
