<!--
 * @Author: Do not edit
 * @Date: 2025-07-02 22:09:10
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-08 21:26:19
 * @FilePath: \PicMap\Code\picMap_fontend\src\views\setting\settingMap\SettingMap.vue
 * @Description: 
-->
<template>
  <div class="setting-map">
    <MapTileEditor></MapTileEditor>
  </div>
</template>

<script setup lang="ts">
import MapTileEditor from '@/components/mapTileEditor/MapTileEditor.vue';

</script>

<style scoped lang="scss">
.setting-map {
  padding-top: 20px;
  height: fit-content;
}
</style>