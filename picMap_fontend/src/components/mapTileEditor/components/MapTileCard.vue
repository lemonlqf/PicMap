<!--
 * @Author: Do not edit
 * @Date: 2025-07-08 19:51:53
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-17 23:00:12
 * @FilePath: \Code\picMap_fontend\src\components\mapTileEditor\components\MapTileCard.vue
 * @Description: 
-->
<template>
  <div class="card">
    <!-- 预览，允许操作 -->
    <div class="preview" ref="mapRef">
      <el-switch class="active-button" v-model="active"></el-switch>
      <span class="tips">{{ $t('description.setUrlToPreview') }}</span>
    </div>
    <div class="content">
      <ImageUpload v-model="imageUrl" :tileId="tileId" :disabled="!canEdit"></ImageUpload>
      <div class="info">
        <h3 class="title">{{ $t('tileName') }}</h3>
        <div class="value">
          <span v-if="!isEdit">{{ name || $t('notSet') }}</span>
          <el-input v-else size="small" :maxlength="10" show-word-limit v-model="inputName" @change="changeName">
          </el-input>
        </div>
        <h3 class="title">{{ $t('address') }}</h3>
        <div class="value">
          <span v-if="!isEdit">{{ url || $t('notSet') }}</span>
          <el-input v-else size="small" v-model="inputUrl" @change="changeUrl">
          </el-input>
        </div>
      </div>
      <div class="buttons">
        <template v-if="!isEdit">
          <el-button :icon="Edit" type="primary" :disabled="!canEdit" @click="isEdit = true">{{ $t('edit')
          }}</el-button>
          <el-button :icon="Delete" type="danger" :disabled="!canEdit" @click="deleteTile(props.tileId)">{{ $t('delete')
          }}</el-button>
        </template>
        <template v-else>
          <el-button @click="isEdit = false" :icon="Back" type="primary">{{ $t('exitEdit') }}</el-button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import ImageUpload from '@/components/imgUpload2/ImageUpload.vue'
import { Delete, Edit, Back } from '@element-plus/icons-vue'
import L from 'leaflet'
import type { IMapTile } from '@/components/mapSelector/defaultMap';
import { ElMessage } from 'element-plus';
import { useAppStore } from '@/store/appSchema';
import { cloneDeep } from 'lodash-es';
import { editAppSchemaAttrAndSave } from '@/utils/appSchema';
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
  url: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  tileId: {
    type: String,
    default: ''
  },
  canEdit: {
    type: Boolean,
    default: true
  },
  active: {
    type: Boolean,
    default: false
  },
})
const emits = defineEmits(['activeChange'])
const active = computed({
  get: () => {
    return props.active
  },
  set: (value) => {
    emits('activeChange', { active: value, tileId: props.tileId })
  }
})
const mapRef = ref()
let map: any = null
function initMap() {
  if (!map) {
    map = L.map(mapRef.value, {
      zoom: 10, //初始缩放，因为在下文写了展示全地图，所以这里不设置，也可以设置
      minZoom: 3,
      maxZoom: 18, // 目前小于18不显示了
      center: [30.2489634, 120.2052342],
      zoomControl: false, //缩放组件
      attributionControl: false //去掉右下角logol
    })
  }
}

let currentTileLayer: any = null
function initTile() {
  // 移除旧的图层
  if (currentTileLayer) {
    map.removeLayer(currentTileLayer)
  }
  // 添加瓦片图层（OpenStreetMap）
  currentTileLayer = L.tileLayer(props.url, {
    attribution: '&copy; <p>OpenStreetMap</p> contributors'
  }).addTo(map);
}


const imageUrl = ref('')

watch(() => props.image, (newValue) => {
  imageUrl.value = newValue
}, { immediate: true })

watch(() => active.value, (newVal) => {
  emits('activeChange', { active: active.value, tileId: props.tileId })
})

const isEdit = ref(false)
const inputName = ref('')
watch(() => props.name, () => {
  inputName.value = props.name
}, { immediate: true })

const inputUrl = ref('')
watch(() => props.url, () => {
  inputUrl.value = props.url
}, { immediate: true })



function changeName(value: string) {
  if (value.length < 1) {
    ElMessage.warning(t('description.enterName'))
    // inputName.value = props.name
  }
  const appSchemaStore = useAppStore()
  let customTileInfos = cloneDeep(appSchemaStore.getAppSchema?.mapInfo?.mapTiles ?? [])
  customTileInfos = customTileInfos.map(item => {
    if (item.id === props.tileId) {
      item.name = value
    }
    return item
  })
  editAppSchemaAttrAndSave('mapInfo.mapTiles', customTileInfos)
}

async function changeUrl(value: string) {
  if (value.length < 1) {
    ElMessage.warning(t('description.needTileUrl'))
    // inputName.value = props.name
  }
  const appSchemaStore = useAppStore()
  let customTileInfos = cloneDeep(appSchemaStore.getAppSchema?.mapInfo?.mapTiles ?? [])
  customTileInfos = customTileInfos.map(item => {
    if (item.id === props.tileId) {
      item.url = value
    }
    return item
  })
  await editAppSchemaAttrAndSave('mapInfo.mapTiles', customTileInfos)
  initTile()
}

async function deleteTile(tileId: string) {
  const appSchemaStore = useAppStore()
  let customTileInfos = cloneDeep(appSchemaStore.getAppSchema?.mapInfo?.mapTiles ?? [])
  customTileInfos = customTileInfos.filter(item => {
    return item.id !== tileId
  })
  editAppSchemaAttrAndSave('mapInfo.mapTiles', customTileInfos)
}


onMounted(() => {
  initMap()
  initTile()
})
</script>

<style scoped lang="scss">
.card {
  transition: all 0.3s;
  width: 100%;
  height: fit-content;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.342);
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  overflow: hidden;

  .preview {
    position: relative;
    height: 100px;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.349);
    background: linear-gradient(to right, #4b6cb7, #182848);
    // border-bottom: 1px solid rgba(0, 0, 255, 0.349);

    :deep() {
      .active-button {
        z-index: 998;
        position: absolute;
        top: 10px;
        right: 15px;


        .el-switch__core {
          background-color: rgba(115, 115, 119, 0.986);
        }

      }

      .el-switch.is-checked .el-switch__core {
        background: rgb(43, 130, 243);
      }
    }

    .tips {
      position: absolute;
      bottom: 3px;
      right: 3px;
      opacity: 0.5;
      color: whitesmoke
    }
  }


  .content {
    padding: 10px;
    display: flex;
    position: relative;
    overflow: hidden;

    .info {
      flex: 1;
      // padding: 10px;
      display: flex;
      flex-direction: column;
      // justify-content: space-between;
      margin-left: 15px;

      .title {
        font-size: 13px;
        color: rgb(27, 25, 122);
        font-weight: 500;
      }

      .value {
        font-size: 15px;
        color: rgb(43, 43, 43);
        margin-bottom: 5px;
        width: 94%;
      }

      .value:nth-of-type(2) {
        height: 45px;
        word-break: break-all;
      }
    }

    .buttons {
      transition: all 0.2s;
      // height: 40px;
      // padding: 0 11px;
      position: absolute;
      transform: translateX(120px);
      right: 0;
      top: 0;
      bottom: 0;
      right: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 15px;

      .el-button {
        margin: 0;
        width: 100px;
      }
    }
  }

  .content:hover {
    .buttons {
      transform: translateX(0);
    }
  }



}

.card:hover {
  transform: scale(1.01);
  box-shadow: 0 0 7px rgba(0, 0, 0, 0.651);
}
</style>