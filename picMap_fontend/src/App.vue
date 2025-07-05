<!--
 * @Author: Do not edit
 * @Date: 2025-04-29 18:33:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 16:26:58
 * @FilePath: \Code\picMap_fontend\src\App.vue
 * @Description: 
-->
<template>
  <div v-if="loading" class="loading">加载中...</div>
  <router-view v-else></router-view>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import eventBus from './utils/eventBus'
import { getUserInfos, getAppSchema } from '@/utils/appSchema'


const loading = ref(true)

onMounted(async () => {
  await getAppSchema()
  loading.value = false
})

document.addEventListener('mouseup', () => {
  eventBus.emit('hidden-content-menu')
})
</script>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
