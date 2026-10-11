<!--
 * @Author: Do not edit
 * @Date: 2026-03-27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-27 19:08:39
 * @FilePath: \PicMap\picMap_fontend\src\components\imagePreview\ImagePreview.vue
 * @Description: 图片预览组件，支持双击放大预览
-->
<template>
  <el-dialog append-to-body :model-value="visible" top="7vh" :show-close="true" :close-on-click-modal="true"
    class="image-preview-dialog" destroy-on-close @close="handleClose">
    <div class="preview-container">
      <el-icon class="close-btn" @click="handleClose"><Close /></el-icon>
      <img :src="src" class="preview-image" />
    </div>
  </el-dialog>
</template>

<script lang="ts" setup>
import { Close } from '@element-plus/icons-vue'

defineProps<{
  visible: boolean
  src: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

function handleClose() {
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.preview-container {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  max-height: 80vh;
  overflow: auto;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.close-btn:hover {
  background: rgba(220, 53, 69, 0.85);
  color: #fff;
  transform: scale(1.1);
  border-color: transparent;
}

.preview-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  cursor: zoom-out;
}
</style>

<style lang="scss">
.image-preview-dialog {
  width: fit-content !important;
  padding: 0 !important;
  background: rgba(0, 0, 0, 0.9);
  z-index: 99999;


  .el-dialog__header {
    display: none;
  }

  // .el-dialog__body {
  //   padding: 0;
  // }
}
</style>
