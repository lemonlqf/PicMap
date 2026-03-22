/*
 * @Author: Do not edit
 * @Date: 2026-03-19 15:13:18
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-22 12:09:51
 * @FilePath: \PicMap\picMap_fontend\src\utils\track.ts
 * @Description: 轨迹相关的工具函数，用于更新和删除schema中的轨迹信息
 */
import { editSchemaAttrAndSave } from './schema'
import { useSchemaStore } from '@/store/schema'
import trackService from '@/services/track'
import trackApi from '@/http/modules/track'

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
  if (existIndex >= 0) {
    // 存在相同id则覆盖
    tracksInfo[existIndex] = { id: fileName, ...trackInfo }
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