/*
 * 地图坐标转换工具
 * @Description: 根据当前主瓦片的坐标系，统一处理 GPS 坐标与地图坐标的转换。
 *
 * 数据来源约定：
 * - 图片 / 分组 / 视频：schema 中存的坐标是 GCJ02（后端导入时已转换）
 * - 轨迹 GPX：原始文件坐标为 WGS84，解析时按需转换
 *
 * 当前瓦片 useGcj02 为 true（默认，中国高德等）：地图使用 GCJ02
 *   - 图片/视频：直接用 schema 值
 *   - 轨迹：GPX 原始 WGS84 → GCJ02
 * useGcj02 为 false（国外瓦片如 OSM）：
 *   - 图片/视频：schema 的 GCJ02 → WGS84 反推
 *   - 轨迹：直接用 GPX 原始 WGS84
 */
import { wgs84ToGcj02, gcj02ToWgs84 } from '@/utils/WGS84-GCJ02'

// 当前主瓦片是否使用 GCJ02（默认 true）。由地图选择器在切换瓦片时更新。
let currentUseGcj02 = true

/**
 * @description: 更新当前主瓦片的坐标系开关（由 MapSelector 在瓦片切换时调用）
 */
export function setCurrentUseGcj02(useGcj02: boolean) {
  currentUseGcj02 = !!useGcj02
}

/**
 * @description: 当前主瓦片是否使用 GCJ02
 */
export function isGcj02Enabled(): boolean {
  return currentUseGcj02
}

/**
 * @description: 把 schema 中存储的 GCJ02 坐标转换为地图坐标
 * 开关开 → 直接用；开关关（WGS84 瓦片）→ 反推为 WGS84
 * @returns {[number, number]} [lng, lat]
 */
export function schemaCoordToMap(lng: number, lat: number): [number, number] {
  if (currentUseGcj02) return [lng, lat]
  const [outLng, outLat] = gcj02ToWgs84(lng, lat)
  return [outLng, outLat]
}

/**
 * @description: 把轨迹 GPX 原始坐标（WGS84）转换为地图坐标
 * 开关开 → 正向转 GCJ02；开关关 → 直接用 WGS84
 * @returns {[number, number]} [lng, lat]
 */
export function gpxCoordToMap(lng: number, lat: number): [number, number] {
  if (currentUseGcj02) {
    const [outLng, outLat] = wgs84ToGcj02(lng, lat)
    return [outLng, outLat]
  }
  return [lng, lat]
}

/**
 * @description: 把地图坐标（当前瓦片坐标系）转换为 schema 存储坐标（统一 GCJ02）
 * 用于手动定位：在 WGS84 瓦片（如 OSM）上点选/拖拽得到的 WGS84 坐标写入 schema 前需转 GCJ02
 * @returns {[number, number]} [lng, lat]
 */
export function mapCoordToSchema(lng: number, lat: number): [number, number] {
  if (currentUseGcj02) return [lng, lat]
  const [outLng, outLat] = wgs84ToGcj02(lng, lat)
  return [outLng, outLat]
}
