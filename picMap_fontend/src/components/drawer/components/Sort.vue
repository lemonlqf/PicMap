<!--
 * @Author: Do not edit
 * @Date: 2025-06-24 21:58:37
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-24 22:27:23
 * @FilePath: \Code\picMap_fontend\src\components\drawer\components\Sort.vue
 * @Description: 
-->
<template>
  <div class="sort" @click="change">
    <el-icon :class="['down', { 'active': value === SortType.ASC }]">
      <SortDown />
    </el-icon>
    <el-icon :class="['up', { 'active': value === SortType.DES }]">
      <SortUp />
    </el-icon>
    <div class="background"></div>
  </div>
</template>

<script setup lang="ts">
import { SortUp, SortDown } from '@element-plus/icons-vue'
import { SortType } from '@/utils/group'
const value = defineModel()

function change() {
  value.value = value.value === SortType.ASC ? SortType.DES : SortType.ASC
}

</script>

<style scoped lang="scss">
.sort {
  position: relative;
  display: inline-block;
  cursor: pointer;



  .up {
    transform: translateX(-4px) translateY(1px);
    z-index: 2;
    color: gray
  }

  .down {
    transform: translateX(4px) translateY(1px);
    z-index: 2;
    color: gray
  }

  .active {
    color: rgb(64, 158, 255)
  }

  .background {
    transition: all 0.2s;
    position: absolute;
    width: 24px;
    background-color: rgb(230, 230, 230);
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.185);
    top: 0;
    right: 4px;
    bottom: 0;
    z-index: 1;
    border-radius: 4px;

  }

}

.sort:hover {
  .background {
    background-color: rgb(240, 240, 240);
    box-shadow: 0 0 3px rgba(0, 0, 0, 0.37);
  }
}
</style>