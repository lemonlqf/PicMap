/*
 * @Author: Do not edit
 * @Date: 2026-03-19 15:13:18
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-23 10:22:19
 * @FilePath: \PicMap\picMap_fontend\src\utils\track.ts
 * @Description: 轨迹相关的工具函数，用于更新和删除schema中的轨迹信息
 */
import { editSchemaAttrAndSave } from './schema'
import { useSchemaStore } from '@/store/schema'
import trackService from '@/services/track'
import trackApi from '@/http/modules/track'
import type { ITrackInfo } from '@/type/schema'
import { formatDate } from './date'

/**
 * @description: 更新schema中的trackInfo
 * 如果已存在相同id则覆盖，否则添加新对象
 * 同时保存到服务器
 * @param {string} fileName - 轨迹文件名（如 PMmytrack.gpx）
 */
export async function updateTrackSchema(fileName: string) {
  const schemaStore = useSchemaStore()
  const tracksInfo = [...(schemaStore.getSchema.trackInfo || [])]
  const existIndex = tracksInfo.findIndex(item => item.id === fileName)
  const intances = trackService.getInstances()
  console.log('track instances:', intances)
  const trackInfo = trackService.getTrackInstanceById(fileName)?.getTrackInfo()
  const existingSetting = existIndex >= 0 ? tracksInfo[existIndex].setting : undefined
  if (existIndex >= 0) {
    // 存在相同id则覆盖，但保留setting字段
    tracksInfo[existIndex] = { id: fileName, ...trackInfo, setting: existingSetting }
  } else {
    // 不存在则添加新对象
    tracksInfo.push({ id: fileName, ...trackInfo })
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
