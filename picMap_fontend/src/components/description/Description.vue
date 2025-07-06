<!--
 * @Author: Do not edit
 * @Date: 2025-06-27 19:16:10
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-28 19:55:52
 * @FilePath: \Code\picMap_fontend\src\components\description\Description.vue
 * @Description: 
-->
<template>
  <div class="description">
    <h1>图片描述</h1>
    <el-input class="normal" v-model="text" :autosize="{ maxRows: 3 }" style="width: 100%" placeholder="图片描述"
      type="textarea" @change="change" @keydown.enter.prevent />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { editSchemaAndSave } from '@/utils/schema'
const props = defineProps({
  description: {
    type: String,
    default: ''
  },
  id: {
    type: String,
    defalut: ''
  },
  label: {
    type: String,
    default: '图片描述'
  }
})

const text = ref(props.description)

watch(() => props.description, () => {
  text.value = props.description
})

function change(newDescription: string) {
  props.id && editSchemaAndSave(props.id, 'description', newDescription)
}
</script>

<style scoped lang="scss">
.description {
  background-color: rgba(228, 227, 227, 0.80);
  border-radius: 5px;
  padding: 5px 15px;

  h1 {
    font-size: 15px;
    line-height: 18px;
  }

  :deep() {
    .el-textarea__inner {
      transform: translateX(-10px) translateY(-4px);
      font-size: 15px;
      color: rgba(0, 0, 0, 0.8);
      resize: none;
      background-color: unset;
      box-shadow: none;
    }

    .el-textarea__inner:hover {
      background-color: rgba(255, 255, 255, .4);
      box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color)) inset;
    }

    .el-textarea__inner:focus {
      background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
      box-shadow: 0 0 0 1px var(--el-input-border-color, var(--el-border-color)) inset;
    }
  }
}
</style>