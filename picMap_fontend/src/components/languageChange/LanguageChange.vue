<!--
 * @Author: Do not edit
 * @Date: 2025-07-16 22:06:33
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-16 23:05:17
 * @FilePath: \Code\picMap_fontend\src\components\languageChange\LanguageChange.vue
 * @Description: 语言选择
-->
<template>
  <div class="flex">
    <Language width="20px" style="color: #542de2"></Language>
    <el-select size="small" @change="changeLanguage" v-model="language" placeholder="Select" style="width: 80px">
      <el-option v-for="item in languageOptions" :key="item.value" :label="item.label" :value="item.value" />
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { localStorageLanguageKey, languageOptions } from '@/i18n/index'
import Language from '@/assets/icon/language.svg?component'
const language = ref<string>(localStorage.getItem(localStorageLanguageKey) ?? '')
function changeLanguage(language: string) {
  localStorage.setItem(localStorageLanguageKey, language);
  window.location.reload();
}
</script>

<style lang="scss" scoped>
.flex {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>