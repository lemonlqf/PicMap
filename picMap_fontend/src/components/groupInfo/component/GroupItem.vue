<!--
 * @Author: Do not edit
 * @Date: 2025-05-02 09:27:09
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-04 12:53:43
 * @FilePath: \Code\picMap_fontend\src\components\groupInfo\component\groupItem.vue
 * @Description: 
-->
<template>
  <div>
    <span @click="setViewById(groupInfo.id)">{{ groupInfo.name }}</span>
  </div>
</template>

<script lang="ts" setup>
import { IGroupInfo } from '@/type/schema';
import type { PropType } from 'vue';
import { setViewById } from '@/utils/map';

const props = defineProps({
  groupInfo: {
    type: Object as PropType<IGroupInfo>,
    default: () => { }
  }
})


</script>

<style lang="scss" scoped></style>