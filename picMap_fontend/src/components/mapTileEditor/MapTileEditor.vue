<!--
 * @Author: Do not edit
 * @Date: 2025-07-06 15:47:50
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-12 00:01:08
 * @FilePath: \Code\picMap_fontend\src\components\mapTileEditor\MapTileEditor.vue
 * @Description: 地图瓦片配置项
-->

<template>
  <div class="tile-editor">
    <EditorCard title="瓦片配置" :img="TileIcon">
      <template #content>
        <div class="content">
          <!-- 默认瓦片 -->
          <template v-for="item in tileInfoList" :key="item.id">
            <MapTileCard :can-edit="!item?.isDefault" :active="activeTileList.includes(item.id)"
              @activeChange="tileActiveChange" class="card" :url="item.url" :name="item.name" :image="item.image"
              :tileId="item.id"></MapTileCard>
          </template>
          <div class="add" @click="addMapTile">
            <AddIcon width="70"></AddIcon>
          </div>
        </div>
      </template>
    </EditorCard>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import EditorCard from '../editorCard/EditorCard.vue';
import TileIcon from '@/assets/icon/图层.svg?component'
import MapTileCard from './components/MapTileCard.vue';
import { defaultMapTile, type IMapTile } from '@/components/mapSelector/defaultMap';
import AddIcon from '@/assets/icon/添加.svg?component'
import { useSchemaStore } from '@/store/schema';
import { useAppStore } from '@/store/appSchema';
import { cloneDeep } from 'lodash-es';
import { editSchemaAndSave, editSchemaAttrAndSave } from '@/utils/schema';
import { ElMessage } from 'element-plus';
import { editAppSchemaAttrAndSave } from '@/utils/appSchema';
// const tileInfoList = ref<IMapTile[]>([])
// const activeTileList = ref<string[]>([])

const tileInfoList = computed<IMapTile[]>(() => {
  const appSchemaStore = useAppStore()
  // 获取自定义瓦片信息
  const customTileInfos = appSchemaStore.getAppSchema?.mapInfo?.mapTiles ?? []
  return [...defaultMapTile, ...customTileInfos]
})

const activeTileList = computed<string[]>(() => {
  const schemaStore = useSchemaStore()
  return schemaStore.getSchema?.mapInfo?.activeTiles ?? []
})

async function tileActiveChange(arg: any) {
  const { active, tileId } = arg
  const schemaStore = useSchemaStore()
  const appSchemaStore = useAppStore()
  let activeTilesClone: string[] = cloneDeep(schemaStore.getSchema?.mapInfo?.activeTiles ?? [])
  if (active) {
    // 如果开启就把启用的瓦片id添加到activeTiles中
    activeTilesClone = [...new Set([...activeTilesClone, tileId])]
  } else {
    // 如果关闭就去掉
    activeTilesClone = activeTilesClone.filter(id => id !== tileId)
  }
  if (activeTilesClone.length < 1) {
    ElMessage.warning('请最少启用一个瓦片！')
    return
  }
  await editSchemaAttrAndSave('mapInfo.activeTiles', activeTilesClone)
}

async function addMapTile() {
  const id = `tile_${new Date().getTime()}`
  const newTileInfo = {
    id,
    name: '',
    url: '',
    image: ''
  }
  const appSchemaStore = useAppStore()
  const customTileInfos = cloneDeep(appSchemaStore.getAppSchema?.mapInfo?.mapTiles ?? [])
  customTileInfos.push(newTileInfo)
  editAppSchemaAttrAndSave('mapInfo.mapTiles', customTileInfos)
}
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
      flex-shrink: 0;
    }

    .add {
      transition: all 0.2s;
      width: 48.2%;
      background-color: rgba(0, 0, 0, 0.062);
      display: flex;
      align-items: center;
      justify-content: center;
      // flex: 1;
      flex-shrink: 0;
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