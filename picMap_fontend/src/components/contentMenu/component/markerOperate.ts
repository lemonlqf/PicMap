/*
 * @Author: Do not edit
 * @Date: 2025-05-17 16:45:41
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-27 19:08:27
 * @FilePath: \Code\picMap_fontend\src\components\contentMenu\component\markerOperate.ts
 * @Description: 
 */


import { deleteMarkerInMap, MAP_INSTANCE, getMarkerById, getTemporaryType, getGPSInfoByMarkerInstance } from '@/utils/map'
import { ElMessage } from 'element-plus'

export const canDragMenu = (markerId: string) => {
  return {
    label: '重新定位',
    clickEvent: async () => {
      const marker = getMarkerById(markerId)
      if (!marker) {
        ElMessage.warning('分组还未添加到地图中！')
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