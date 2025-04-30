<!--
 * @Author: Do not edit
 * @Date: 2025-04-30 18:36:26
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-04-30 19:36:02
 * @FilePath: \Code\picMap_fontend\src\components\drawer\GroupDetail.vue
 * @Description: 
-->
<template>
  <div>
    {{ props.marker }}
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';

const props = defineProps({
  marker: {
    type: Object,
    default: () => ({})
  }
})


watch(() => props.marker, (newVal) => {
  console.log('marker changed:', newVal);
}, { immediate: true });
</script>

<style scoped></style>