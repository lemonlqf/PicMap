<!--
 * @Description: 通用全屏切换按钮（浅色圆角 + 图标），全屏时显示退出图标
 *   - 分组小地图、普通视频、全景视频、轨迹视频弹框共用
 *   - 位置：绝对定位到容器右上角（容器需 position: relative）
-->
<template>
  <button class="pm-fullscreen-btn" :title="buttonTitle" @click="emit('click')">
    <el-icon :size="16">
      <Close v-if="isFullscreen" />
      <FullScreen v-else />
    </el-icon>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FullScreen, Close } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  // 是否处于全屏：全屏显示退出图标，否则显示进入全屏图标
  isFullscreen?: boolean
  // 悬浮提示，缺省根据全屏状态自动生成
  title?: string
}>(), {
  isFullscreen: false,
  title: ''
})

const emit = defineEmits<{ (e: 'click'): void }>()

const buttonTitle = computed(() => props.title || t(props.isFullscreen ? 'exitFullscreen' : 'fullscreen'))
</script>

<style scoped>
.pm-fullscreen-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #303133;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.pm-fullscreen-btn:hover {
  background: #fff;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.pm-fullscreen-btn:active {
  transform: scale(0.95);
}
</style>
