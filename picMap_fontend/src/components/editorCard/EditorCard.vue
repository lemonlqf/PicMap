<!--
 * @Author: Do not edit
 * @Date: 2025-07-06 15:51:01
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-17 21:35:41
 * @FilePath: \Code\picMap_fontend\src\components\editorCard\EditorCard.vue
 * @Description: 
-->
<template>
  <div class="editor-card">
    <div class="header">
      <div class="title">{{ title || $t('defaultTitle') }}</div>
      <div class="img">
        <component class="svg" :is="img"></component>
      </div>
    </div>
    <div class="content">
      <slot name="content"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">

const props = defineProps({
  title: {
    type: String,
    defalut: ''
  },
  img: {
    type: String,
    default: ''
  }
})

</script>

<style scoped lang="scss">
.editor-card {
  padding: 15px;
  border-radius: 10px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.63);

  .header {
    height: 45px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      height: 100%;
      display: flex;
      align-items: center;
      font-size: 20px;
      font-weight: 400;
      position: relative;
    }

    .title::after {
      content: '';
      display: inline-block;
      height: 3px;
      width: 50px;
      position: absolute;
      left: 0;
      bottom: 0;
      border-radius: 1px;
      background: linear-gradient(-45deg, #542de2 30%, #0061e0);
    }

    .img {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: #0061e013;
      border: 1px solid #3061d4;
      
      .svg {
        color: #0061e0;
        height: 30px;
        width: inherit;
      }

    }
  }

}
</style>