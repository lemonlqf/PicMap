/*
 * @Author: Do not edit
 * @Date: 2026-03-19 15:13:18
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-25 18:53:59
 * @FilePath: \PicMap\picMap_fontend\src\utils\track.ts
 * @Description: 轨迹相关的工具函数，用于更新和删除schema中的轨迹信息
 */
import { editSchemaAttrAndSave } from './schema'
import { useSchemaStore } from '@/store/schema'
import trackService from '@/services/track'
import trackApi from '@/http/modules/track'
import type { ITrackInfo } from '@/type/schema'
import { formatDate } from './date'

export const colors = [
  '#673bb7',
  '#4caf50',
  '#e91e63',
  '#2196f3',
  '#ff9800',
  '#9c27b0',
  '#f44336',
  '#3f51b5',
  '#009688',
  '#ff5722'
]

/**
 * @description: 随机获取默认轨迹线颜色，每次调用时会切换颜色，避免新添加的轨迹与已有轨迹颜色相同
 * @param {boolean} changeColor - 是否切换颜色，默认为false，如果为true则切换到下一个颜色
 * @return {*}
 */
export function getDefaultLineColor(changeColor: boolean = false): string {
  changeColor && (getDefaultLineColor.index = getDefaultLineColor.index ? getDefaultLineColor.index + 1 : 1);
  const index: number = getDefaultLineColor?.index
  const color = colors[index % colors.length];
  return color
}

/**
 * @description: 更新schema中的trackInfo
 * 如果已存在相同id则覆盖，否则添加新对象
 * 同时保存到服务器
 * @param {string} fileName - 轨迹文件名（如 PMmytrack.gpx）
 * @param {string} lineColor - 轨迹线颜色（可选）
 */
export async function updateTrackSchema(fileName: string, lineColor?: string) {
  const schemaStore = useSchemaStore()
  const tracksInfo = [...(schemaStore.getSchema.trackInfo || [])]
  const existIndex = tracksInfo.findIndex(item => item.id === fileName)
  const intances = trackService.getInstances()
  console.log('track instances:', intances)
  const trackInfo = trackService.getTrackInstanceById(fileName)?.getTrackInfo()
  const existingSetting = existIndex >= 0 ? tracksInfo[existIndex].setting : undefined
  if (existIndex >= 0) {
    // 存在相同id则覆盖，但保留setting字段
    const newSetting = { ...existingSetting }
    if (lineColor) {
      newSetting.lineColor = lineColor
    }
    tracksInfo[existIndex] = { id: fileName, ...trackInfo, setting: newSetting }
  } else {
    // 不存在则添加新对象
    const newSetting = lineColor ? { lineColor } : undefined
    tracksInfo.push({ id: fileName, ...trackInfo, setting: newSetting })
  }
  await editSchemaAttrAndSave('trackInfo', tracksInfo)
}

/**
 * @description: 从schema和服务器中删除轨迹信息
 * @param {string} trackId - 轨迹id（文件名）
 */
export async function deleteTrackFromSchema(trackId: string) {
  const schemaStore = useSchemaStore()
  const tracksInfo = [...(schemaStore.getSchema.trackInfo || [])]
  // 从数组中过滤掉要删除的轨迹
  const filteredTracksInfo = tracksInfo.filter(item => item.id !== trackId)
  // 更新schema
  await editSchemaAttrAndSave('trackInfo', filteredTracksInfo)
  // 从地图中删除轨迹实例
  trackService.deleteTrack(trackId)
  // 从所有分组的trackNumbers中移除该轨迹
  const groupInfoList = schemaStore.getGroupInfo
  const updatedGroupInfoList = groupInfoList.map(group => {
    if (group.trackNumbers?.includes(trackId)) {
      return {
        ...group,
        trackNumbers: group.trackNumbers.filter(id => id !== trackId)
      }
    }
    return group
  })
  await editSchemaAttrAndSave('groupInfo', updatedGroupInfoList)
  // 删除服务器上的文件
  await trackApi.deleteTrack(trackId)
}

/**
 * @description: 格式化轨迹信息，主要是距离和时间的显示格式
 * @param {ITrackInfo} trackInfo
 * @return {*}
 */
export function formatTrackInfo(trackInfo: ITrackInfo) {
  const formattedInfo = {
    ...trackInfo,
    distance: formatDistance(trackInfo.distance),
    startTime: formatDate(trackInfo.startTime),
    endTime: formatDate(trackInfo.endTime),
  }
  return formattedInfo
}

/**
 * @description: 格式化距离显示，将米转换为千米
 */
export function formatDistance(distance: number | undefined) {
  if (distance === null || distance === undefined) return '-'
  return (distance / 1000).toFixed(2) + ' km'
}
