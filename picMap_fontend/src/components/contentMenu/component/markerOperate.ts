/*
 * @Author: Do not edit
 * @Date: 2025-05-17 16:45:41
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-17 21:21:46
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\markerOperate.ts
 * @Description: 
 */


import { deleteMarkerInMap, MAP_INSTANCE, getMarkerById, getTemporaryType, getGPSInfoByMarkerInstance } from '@/utils/map'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
export const canDragMenu = () => {
  const { t } = useI18n()
  return {
    label: t('repositioning'),
    clickEvent: async (markerId: string) => {
      const marker = getMarkerById(markerId)
      if (!marker) {
        ElMessage.warning(t('description.groupNotExist'))
        return
      }
      const markerType = marker.options.type
      // 改变marker类型
      marker.options.type = getTemporaryType(markerType)
      // 变为不可拖拽
      marker.dragging.enable();
    }
  }
}