<template>
  <div class="track-menu">
    <div class="menu-item" @click="removeFromMap">
      <span>{{ $t('track.removeFromMap') }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import eventBus from '@/utils/eventBus'
import { editSchemaAttrAndSave } from '@/utils/schema'
import { useSchemaStore } from '@/store/schema'
import mapService from '@/services/map'

const { t } = useI18n()
const schemaStore = useSchemaStore()

const props = defineProps({
  trackId: {
    type: String,
    default: () => ''
  }
})

function menuHidden() {
  eventBus.emit('hidden-content-menu')
}

async function removeFromMap() {
  try {
    const trackInfoList = [...(schemaStore.getSchema.trackInfo || [])]
    const trackIndex = trackInfoList.findIndex((track: any) => track.id === props.trackId)
    if (trackIndex >= 0) {
      if (!trackInfoList[trackIndex].setting) {
        trackInfoList[trackIndex].setting = {}
      }
      trackInfoList[trackIndex].setting!.showOnMainMap = false
      await editSchemaAttrAndSave('trackInfo', trackInfoList)
    }
    // 即时从主地图移除轨迹
    mapService.renderMainMapTracks()
    ElMessage.success(t('description.updateSuccess'))
  } catch (error) {
    console.error('移除轨迹失败:', error)
    ElMessage.error(t('description.updateFailed'))
  } finally {
    menuHidden()
  }
}
</script>

<style lang="scss" scoped>
* {
  user-select: none;
}
.track-menu {
  background-color: rgba(255, 255, 255, 1);

  .menu-item {
    padding: 2px 13px 5px 13px;
    cursor: pointer;

    span {
      font-size: 14px;
      color: rgb(96, 98, 102);
      height: 25px;
      box-sizing: border-box;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
    }
  }

  .menu-item:hover {
    background-color: rgb(226, 226, 226);
  }
}
</style>
