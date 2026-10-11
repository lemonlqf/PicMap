<template>
  <div class="pm-context-menu">
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

