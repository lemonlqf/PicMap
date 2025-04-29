<!--
 * @Author: Do not edit
 * @Date: 2025-02-06 11:53:37
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-16 13:42:05
 * @FilePath: \Code\picMap_fontend\src\components\drawer\components\keyValue.vue
 * @Description: 
-->
<template>
  <h1>{{ props.title }}</h1>
  <div v-for="key in keys">
    <span v-if="needShow(key)">{{ labels[key] }}:</span>
    <span v-if="needShow(key)" style="max-width: 200px">{{ getValue(props.info[key]) ?? '无数据' }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { labels, showIndicators } from '../imageInfo'
const props = defineProps({
  info: {
    default: {}
  },
  title: {
    default: '标题'
  }
})

const keys = computed(() => {
  return Object.keys(props.info)
})

const needShow = function (key) {
  return showIndicators.includes(key)
}

/**
 * @description: 获取实际数据值
 * @param {*} value
 * @return {*}
 */
function getValue(value) {
  if (value instanceof Array) {
    if (value.length === 1) {
      return value[0]
    } else if (value.length === 2) {
      return maxLength(value[0] / value[1])
    }
  } else {
    return value
  }
}

function maxLength(value) {
  if (value.toString().length >= 11) {
    let res = value.toString().substring(0, 10)
    return res
  }
  return value
}
</script>

<style lang="scss" scoped>
h1 {
  font-size: 15px;
  line-height: 18px;
}

div {
  width: 250px;
  display: flex;
  justify-content: space-between;

  span:first-child {
    width: 90px;
  }

  margin-bottom: 5px;
  margin-right: 30px;
}
</style>
