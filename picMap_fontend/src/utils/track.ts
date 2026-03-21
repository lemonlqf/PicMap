import { editSchemaAttrAndSave } from './schema'
import { useSchemaStore } from '@/store/schema'

/**
 * @description: 更新schema中的trackInfo，如果已存在相同id则覆盖，否则添加新对象
 * @param {string} fileName - 轨迹文件名（如 PMmytrack.gpx）
 * @return {*}
 */
export async function updateTrackSchema(fileName: string) {
  // 从文件名中提取baseName（去掉PM前缀和.gpx后缀）
  const baseName = fileName.replace(/^PM/, '').replace(/\.gpx$/, '')
  const schemaStore = useSchemaStore()
  // 获取当前的trackInfo数组
  const trackInfo = [...(schemaStore.getSchema.trackInfo || [])]
  // 查找是否存在相同id的轨迹
  const existIndex = trackInfo.findIndex(item => item.id === baseName)
  if (existIndex >= 0) {
    // 存在则覆盖
    trackInfo[existIndex] = { id: baseName }
  } else {
    // 不存在则添加
    trackInfo.push({ id: baseName })
  }
  await editSchemaAttrAndSave('trackInfo', trackInfo)
}