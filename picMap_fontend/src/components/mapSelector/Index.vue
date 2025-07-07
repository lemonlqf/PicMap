<template>
  <div class="selector" :style="{ '--card-number': defaultMapTile.length }">
    <div v-for="(item, index) in defaultMapTile" :key="item.name"
      :class="['selector-card', { 'active': item.name === currentName }]" @click="changeMapTile(item)">
      <img v-if="item.isDefault" :src="item?.image" alt="">
      <!-- <img  :src="getMapTile(item.image)" alt=""> -->
      <div class="name">{{ item.name }}</div>
      <div class="active-img">
        <img :src="SelectIcon" alt="">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, computed, watch, ref } from 'vue'

import SelectIcon from '@/assets/icon/对勾.svg?svg'
import { defaultMapTile } from './defaultMap'
import { getMapTile } from '@/utils/user'
const emits = defineEmits(['changeMapTile'])

const value = defineModel({})
const currentName = ref(defaultMapTile[0].name)

function changeMapTile(item) {
  value.value = item
  currentName.value = item.name
  emits('changeMapTile', item)
}

onBeforeMount(() => {
  // 初始化取第一个
  value.value = defaultMapTile[0]
})
</script>

<style scoped lang="scss">
$padding: 3px;
$card-height: 80px;
$card-width: 80px;
// 卡片长度
$card-number: 3;
$border-raduis: 6px;

.selector {
  transition: all 0.3s ease-in-out;
  display: flex;
  background-color: rgba(225, 226, 226, 0.322);
  box-shadow: 0px 0px 5px rgb(0 0 0 / 35%);
  height: calc($card-height + 7px);
  width: calc($card-width + 7px);
  padding: 5px;
  border-radius: $border-raduis;
  overflow: hidden;

  .selector-card {
    z-index: 1;
    right: 0;
    transition: inherit;
    position: absolute;
    display: flex;
    cursor: pointer;
    flex-direction: column;
    align-items: center;
    background-color: aliceblue;
    padding: $padding;
    border-radius: calc($border-raduis - 2px);
    margin-right: 6px;
    overflow: hidden;

    img {
      border-radius: 2px;
      width: $card-width;
      height: $card-height;
    }

    .name {
      display: flex;
      align-items: center;
      justify-content: center;
      bottom: $padding;
      left: $padding;
      right: $padding;
      position: absolute;
      color: rgb(59, 59, 59);
      background-color: rgba(211, 211, 211, 0.788);
      font-size: 14px;
      height: 30px;
      border-bottom-right-radius: calc($border-raduis - 4px);
      border-bottom-left-radius: calc($border-raduis - 4px);
    }

    .active-img {
      opacity: 0;
      top: $padding;
      right: $padding;
      position: absolute;

      img {
        width: 30px;
        height: 30px;
      }
    }


  }

  .active {
    z-index: 10;
    box-shadow: 2px 2px 5px rgb(0 0 0 / 35%);

    .active-img {
      opacity: 1;
    }
  }


  .selector-card:hover {
    box-shadow: 2px 2px 5px rgb(0 0 0 / 65%) !important;
  }
}


.selector:hover {

  // 假设最多有 10 个卡片
  @for $i from 1 through 10 {
    .selector-card:nth-of-type(#{$i}) {
      transform: translateX(#{($i - 1) * - 99}px);
    }
  }

  width: calc(var(--card-number) * 97px);

  .selector-card {
    box-shadow: 2px 2px 5px rgb(0 0 0 / 35%);
  }
}
</style>