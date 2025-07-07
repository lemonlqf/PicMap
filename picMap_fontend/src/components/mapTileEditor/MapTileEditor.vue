<template>
  <div class="tile-editor">
    <EditorCard title="瓦片配置" :img="TileIcon">
      <template #content>
        <div class="content">
        ddd
        </div>
      </template>
    </EditorCard>
  </div>
</template>

<script setup lang="ts">
import EditorCard from '../editorCard/EditorCard.vue';
import TileIcon from '@/assets/icon/图层.svg?component'
</script>

<style scoped lang="scss">
.tile-editor {
  width: 96%;

}
</style>