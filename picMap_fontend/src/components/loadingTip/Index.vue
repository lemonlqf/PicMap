<template>
  <div class="loading-tip">
    <el-icon class="loading-icon"><Loading /></el-icon>
    <span>{{ text }}</span>
  </div>
</template>

<script lang="ts" setup>
import { Loading } from '@element-plus/icons-vue'

defineProps<{
  text: string
}>()
</script>

<style lang="scss" scoped>
.loading-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #666;

  .loading-icon {
    font-size: 32px;
    color: #409eff;
    margin-bottom: 10px;
    animation: rotate 1s linear infinite;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>