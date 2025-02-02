<!--
 * @Author: Do not edit
 * @Date: 2025-02-02 14:15:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-02 19:25:14
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\Index.vue
 * @Description: 鼠标右件菜单，点击marker时出现
-->
<template>
  <div :class="{ menu: true, 'is-show': isShow }">
    <div class="menu-item" v-for="item in menuList" @click="item.clickEvent">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import eventBus from '@/utils/eventBus.js'
import API from '@/http/index.js'
import { useSchemaStore } from '@/store/schema'
import { ElMessage } from 'element-plus'
const schemaStore = useSchemaStore()
const isShow = ref(false)
const imageId = ref('')
const postionInfo = ref({
  left: '10px',
  top: '0px'
})
const menuList = ref([
  {
    label: '删除图片',
    clickEvent: async () => {
      // 在schema的imageInfo中添加图片信息
      schemaStore.deleteImageInImageInfo(imageId.value)
      const newSchema = schemaStore.getSchema
      const res2 = await API.schema.setSchema({ schema: JSON.stringify(newSchema) })
      Promise.all([
        API.schema.setSchema({ schema: JSON.stringify(newSchema) }),
        API.image.deleteImages({ deleteImages: [imageId.value] })
      ]).then(res => {
        const tipMsg = res.reduce((msg, item) => {
          return msg + item.data
        }, '')
        ElMessage.success(tipMsg)
        // console.log('promise all ==>', res)
      })
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
  console.log(event)
  const { x, y } = event.originalEvent
  imageId.value = event.target.options.id
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
  background-color: rgba(255, 255, 255, 1);
  z-index: 999999;
  border: 1px solid black;
  .menu-item {
    border-bottom: 1px solid black;
    cursor: pointer;
  }
  .menu-item:hover {
    background-color: antiquewhite;
  }
  .menu-item:last-child {
    border-bottom: 0px;
  }
}

.is-show {
  opacity: 1;
}
</style>
