<!--
 * @Author: Do not edit
 * @Date: 2025-02-26 20:55:41
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-26 22:05:39
 * @FilePath: \Code\picMap_fontend\src\components\switch\Index.vue
 * @Description: 
-->
<template>
  <div class="switch-container">
    <div v-for="item in props.options" :class="{ optionItem: true, activeItem: model === item.value }" :key="item.value"
      @click="model = item.value">
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { defineProps, defineModel, onMounted, watch } from 'vue'
const emit = defineEmits(['onclick'])
const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  // options: [
  //   { value: '1', label: '选项1' },
  //   { value: '2', label: '选项2' },
  //   { value: '3', label: '选项3' },
  // ]
  width: {
    type: String,
    default: null
  },
  height: {
    type: String,
    default: '28px'
  }
})

const model = defineModel()

watch(() => model.value, (newVal) => {
  emit('onclick', newVal)
})

onMounted(() => {
})



</script>

<style lang="scss" scoped>
.switch-container {
  height: v-bind("props.height");
  display: flex;
  justify-content: space-between;
  padding: 3px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: rgb(214, 214, 214);

  .optionItem {
    transition: all 0.3s;
    min-width: 40px;
    padding: 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    font-weight: 500;
    border: 1px solid #ccc;
    margin-right: 3px;
    background-color: rgb(129, 141, 163);
    opacity: .5;
    cursor: pointer;

    span {
      color: rgb(204, 204, 204);
    }

    &:hover {
      background-color: rgb(82, 128, 212);
    }

  }

  .optionItem:last-child {
    margin-right: 0;
  }

  .activeItem {
    span {
      color: white;
    }

    background-color: rgb(47, 151, 255) !important;
    opacity: 1;
  }
}
</style>