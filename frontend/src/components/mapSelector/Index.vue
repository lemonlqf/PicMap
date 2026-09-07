<template>
  <div class="map-selector">
    <div class="selector" :style="{ '--card-number': tileInfoList.length }">
      <div v-for="(item, index) in tileInfoList" :key="item.name"
        :class="['selector-card', { 'active': item.name === currentName }]" @click="changeMapTile(item)">
        <img v-if="item?.image.length" :src="item?.image" alt="">
        <img v-else style="opacity: 0.4" :src="defaultIcon" alt="">
        <div class="name"><span>{{ item.name || $t('notSet') }}</span></div>
        <div class="active-img">
          <img :src="SelectIcon" alt="">
        </div>
      </div>
    </div>
    <!-- 路网/标注叠加层开关：仅当前选中瓦片配置了叠加层时展示 -->
    <div v-if="hasOverlay" class="overlay-switch">
      <el-switch v-model="overlayOnModel" size="small" @change="handleOverlayToggle"></el-switch>
      <span class="overlay-label">{{ $t('showOverlay') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'

import SelectIcon from '@/assets/icon/对勾.svg?svg'
import { getDefaultMapTile, type IMapTile } from './defaultMap'
import { getMapTile } from '@/utils/user'
import { useAppStore } from '@/store/appSchema'
import { useSchemaStore } from '@/store/schema'
import { saveSchema } from '@/utils/schema'
import { cloneDeep } from 'lodash-es'
import defaultIcon from '@/assets/icon/默认图片.svg?svg'

const emits = defineEmits(['changeMapTile', 'update:overlayOn'])
const defaultMapTile = getDefaultMapTile()
const value = defineModel<IMapTile | undefined>({})
// 叠加层开关状态（本地 ref，仅通过显式事件上抛给父组件，不使用 defineModel 双向响应式绑定，
// 避免路由切换卸载期间父子响应式联动触发对半卸载组件的重渲染）
const overlayOnModel = ref(false)
const currentName = ref(defaultMapTile[0].name)

// 组件卸载期间标记：路由切换卸载本组件时，阻止 watcher / 回调继续写响应式状态与 schema，
// 避免卸载调度阶段对已半卸载组件触发重渲染（之前叠加层开关在此场景下引发卸载崩溃）
let unmounting = false
onBeforeUnmount(() => {
  unmounting = true
})

const defaultTileId = computed<string>(() => {
  const appSchemaStore = useAppStore()
  return appSchemaStore.getAppSchema?.mapInfo?.defaultTileId ?? ''
})

// 纯计算：仅根据配置过滤出可选瓦片列表，不在 computed 内写任何响应式状态
const tileInfoList = computed<IMapTile[]>(() => {
  const appSchemaStore = useAppStore()
  const schemaStore = useSchemaStore()
  // 获取自定义瓦片信息
  const customTileInfos = appSchemaStore.getAppSchema?.mapInfo?.mapTiles ?? []
  // 只展示生效的瓦片
  const activeTileId = cloneDeep(schemaStore.getSchema?.mapInfo?.activeTiles ?? [])

  const allTiles = [...defaultMapTile, ...customTileInfos]
  const res = allTiles.filter(item => {
    return activeTileId.includes(item.id)
  })
  // 如果没有启用就默认使用第一个
  if (res.length === 0) {
    res.push(defaultMapTile[0])
  }
  return res
})

// 从可选列表中挑出默认瓦片（优先 defaultTileId）
function pickDefaultTile(list: IMapTile[]): IMapTile {
  const defaultTile = list.find(item => item.id === defaultTileId.value)
  return defaultTile || list[0]
}

// 默认瓦片 / 瓦片列表变化时，命令式同步当前选中的瓦片（不要在 computed 内写响应式状态）
watch(
  () => tileInfoList.value,
  (newValue) => {
    if (unmounting) return
    const defaultMap = pickDefaultTile(newValue)
    currentName.value = defaultMap.name
    value.value = defaultMap
  },
  { deep: true, immediate: true }
)

// ===== 叠加层（路网标注）开关逻辑 =====
// 当前选中瓦片 id
const currentTileId = computed<string>(() => value.value?.id ?? '')

// 当前选中瓦片配置的叠加层（纯只读计算）
const currentOverlays = computed<any[]>(() => {
  const appSchemaStore = useAppStore()
  const id = currentTileId.value
  if (!id) return []
  return appSchemaStore.getAppSchema?.mapInfo?.tileOverlays?.[id] ?? []
})

// 是否显示叠加层开关（仅当选中瓦片配置了叠加层时）
const hasOverlay = computed<boolean>(() => currentOverlays.value.length > 0)

// schema 是否已加载（mapInfo 就绪），避免加载前写入覆盖
function schemaReady(): boolean {
  const schemaStore = useSchemaStore()
  return !!schemaStore.getSchema?.mapInfo
}

// 读取用户持久化的开关状态；未记录（key 不存在）时视为开启（默认）
function readOverlayState(id: string): boolean {
  const schemaStore = useSchemaStore()
  const map = schemaStore.getSchema?.mapInfo?.overlayVisible ?? {}
  return map[id] === undefined ? true : !!map[id]
}

// 持久化当前瓦片的开关状态到用户 schema
async function persistOverlayState(id: string, on: boolean) {
  const schemaStore = useSchemaStore()
  if (!id || !schemaReady() || unmounting) return
  const map = cloneDeep(schemaStore.getSchema?.mapInfo?.overlayVisible ?? {})
  map[id] = on
  schemaStore.setMapAttr('overlayVisible', map)
  await saveSchema()
}

// 瓦片变化 / 是否具备叠加层变化时，按持久化状态同步开关显示，并上抛给父组件
function syncOverlayForCurrentTile() {
  if (unmounting) return
  const id = currentTileId.value
  overlayOnModel.value = !!id && hasOverlay.value && readOverlayState(id)
  emits('update:overlayOn', overlayOnModel.value)
}

// 用户手动切换叠加层开关
async function handleOverlayToggle() {
  if (unmounting) return
  emits('update:overlayOn', !!overlayOnModel.value)
  await persistOverlayState(currentTileId.value, !!overlayOnModel.value)
}

watch([currentTileId, hasOverlay], () => {
  syncOverlayForCurrentTile()
}, { immediate: true })

function changeMapTile(item) {
  value.value = item
  currentName.value = item.name
  emits('changeMapTile', item)
}

</script>

<style scoped lang="scss">
$padding: 3px;
$card-height: 80px;
$card-width: 80px;
// 卡片长度
$card-number: 3;
$border-raduis: 6px;

* {
  user-select: none;
}

.map-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.overlay-switch {
  position: absolute;
  left: -80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 6px;
  box-shadow: 0 0 5px rgb(0 0 0 / 35%);

  .overlay-label {
    font-size: 12px;
    color: #333;
    white-space: nowrap;
  }
}

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
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      bottom: $padding;
      left: $padding;
      right: $padding;
      position: absolute;
      color: rgb(59, 59, 59);
      background-color: rgba(211, 211, 211, 0.788);
      font-size: 12px;
      height: 30px;
      border-bottom-right-radius: calc($border-raduis - 4px);
      border-bottom-left-radius: calc($border-raduis - 4px);
      span {
        text-overflow: ellipsis;
        overflow: hidden;
        word-break: keep-all;
        max-width: 100%;
      }
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
  @for $i from 1 through 100 {
    .selector-card:nth-of-type(#{$i}) {
      transform: translateX(#{($i - 1) * - 92}px);
    }
  }

  // width: calc(var(cardLength) * 97px);
  width: calc(var(--card-number) * 92px);

  .selector-card {
    box-shadow: 2px 2px 5px rgb(0 0 0 / 35%);
  }
}
</style>
