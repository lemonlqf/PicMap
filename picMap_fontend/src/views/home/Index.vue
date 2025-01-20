<!--
 * @Author: Do not edit
 * @Date: 2024-12-13 10:21:51
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-13 23:10:59
 * @FilePath: \picMap_fontend\src\views\home\Index.vue
 * @Description: 
-->
<template>
  <div>this is home!!</div>
  <button @click="toPicMap">to picmap</button>
</template>

<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
function toPicMap() {
  router.push('picMap')
}
</script>

<style lang="scss" scoped></style>
