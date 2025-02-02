<template>
  <router-view></router-view>
</template>

<script setup>
import eventBus from './utils/eventBus'

document.addEventListener('mouseup', () => {
  // 隐藏所有右击出现的弹框
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
