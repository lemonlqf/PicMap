<template>
  <div class="tile-editor">
    <EditorCard title="瓦片配置" :img="TileIcon">
      <template #content>
        <div class="content">
          <template v-for="item in defaultMapTile">
            <MapTileCard class="card" :url="item.url" :name="item.name" :img="item.image"></MapTileCard>
          </template>
          <div class="add">
            <AddIcon width="70"></AddIcon>
          </div>
        </div>
      </template>
    </EditorCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EditorCard from '../editorCard/EditorCard.vue';
import TileIcon from '@/assets/icon/图层.svg?component'
import MapTileCard from './components/MapTileCard.vue';
import { defaultMapTile } from '@/components/mapSelector/defaultMap';
import AddIcon from '@/assets/icon/添加.svg?component'
const tileList = ref([{}])
</script>

<style scoped lang="scss">
.tile-editor {
  width: 96%;

  .content {
    padding: 20px 0 10px 0;
    display: flex;
    gap: 20px;
    flex-wrap: wrap;

    .card {
      width: 49%;
    }

    .add {
      transition: all 0.2s;
      width: 49%;
      background-color: rgba(0, 0, 0, 0.062);
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      border-radius: 10px;
      color: #808080;
      border: 5px gray dashed;
      * {
        transition: all 0.2s;
      }
    }
    .add:hover {
      cursor: pointer;
      transform: scale(1.01);
      box-shadow: 0 0 7px rgba(0, 0, 0, 0.651);
      border-color: #1e4aaf;
      * {
        transform: scale(1.1);
        transform-origin: 50% 50%;
        color: #1e4aaf
      }
    }
  }

}
</style>