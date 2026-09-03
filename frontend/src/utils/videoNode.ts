/*
 * 视频节点生成工具
 * @Description: 将关联 GPX 的视频按其时间轴生成地图节点（坐标来自 GPX 时间对应位置的插值）
 */
import API from '@/wails/api'
import type { IVideoNode } from '@/type/video'
import type { IVideoInfo, ITrackInfo } from '@/type/schema'

// ---- 坐标转换（WGS84 → GCJ02） ----
const PI = 3.1415926535897932384626
const A = 6378245.0
const EE = 0.00669342162296594323

function outOfChina(lng: number, lat: number) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}
function transformLat(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}
function transformLng(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat]
  let dlat = transformLat(lng - 105.0, lat - 35.0)
  let dlng = transformLng(lng - 105.0, lat - 35.0)
  const radlat = (lat / 180.0) * PI
  let magic = Math.sin(radlat)
  magic = 1 - EE * magic * magic
  const sqrtmagic = Math.sqrt(magic)
  dlat = (dlat * 180.0) / (((A * (1 - EE)) / (magic * sqrtmagic)) * PI)
  dlng = (dlng * 180.0) / ((A / sqrtmagic) * Math.cos(radlat) * PI)
  const mglat = lat + dlat
  const mglng = lng + dlng
  return [mglng, mglat]
}

// ---- GPX 解析（含时间戳） ----

export interface IGpxPoint {
  lat: number      // GCJ02 纬度
  lng: number      // GCJ02 经度
  timeMs: number   // 绝对时间戳（epoch ms），0 表示缺失
}

export function parseGpxPoints(gpxText: string): IGpxPoint[] {
  const doc = new DOMParser().parseFromString(gpxText, 'text/xml')
  const points: IGpxPoint[] = []
  doc.querySelectorAll('trkpt').forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '')
    const lon = parseFloat(pt.getAttribute('lon') || '')
    if (!isFinite(lat) || !isFinite(lon)) return
    const [gcjLng, gcjLat] = wgs84ToGcj02(lon, lat)
    const time = pt.getElementsByTagName('time')[0]?.textContent
    points.push({
      lat: gcjLat,
      lng: gcjLng,
      timeMs: time ? new Date(time).getTime() : 0,
    })
  })
  return points
}

// ---- 时间 → 坐标插值 ----

/**
 * @description: 给定绝对时刻，在 GPX 点序列上线性插值得到坐标
 * @returns {[number, number]} GCJ02 [lng, lat]，越界时返回最近端点
 */
function interpolateAt(gpx: IGpxPoint[], timeMs: number): [number, number] | null {
  if (gpx.length === 0) return null
  // 单点或多点中无时间信息
  if (gpx.length === 1) return [gpx[0].lng, gpx[0].lat]

  // 找包含 timeMs 的相邻两点
  for (let i = 0; i < gpx.length - 1; i++) {
    const a = gpx[i]
    const b = gpx[i + 1]
    if (a.timeMs === 0 || b.timeMs === 0) continue
    if (timeMs >= a.timeMs && timeMs <= b.timeMs) {
      const ratio = (timeMs - a.timeMs) / (b.timeMs - a.timeMs)
      return [
        a.lng + (b.lng - a.lng) * ratio,
        a.lat + (b.lat - a.lat) * ratio,
      ]
    }
  }
  // 越界：返回最近端点
  if (gpx[0].timeMs !== 0 && timeMs < gpx[0].timeMs) return [gpx[0].lng, gpx[0].lat]
  if (gpx[gpx.length - 1].timeMs !== 0 && timeMs > gpx[gpx.length - 1].timeMs) {
    return [gpx[gpx.length - 1].lng, gpx[gpx.length - 1].lat]
  }
  return null
}

// ---- 节点生成 ----

/**
 * @description: 为一条 GPX 轨迹获取其逐点坐标（含时间戳）
 * 通过后端 GetTrack 获取 GPX 内容并解析（不依赖内存中的 track 实例）
 */
async function fetchTrackPoints(trackId: string): Promise<IGpxPoint[] | null> {
  // 重试等待 Wails 运行时 WebSocket 连接就绪，避免 CONNECTING 状态下 send 报错
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await API.track.getTrack(trackId)
      if (res.code !== 200 || !res.data?.fileContent) return null
      return parseGpxPoints(res.data.fileContent)
    } catch (e: any) {
      const isConnecting = e && e.name === 'InvalidStateError'
      if (!isConnecting) {
        console.error('获取轨迹点失败', trackId, e)
        return null
      }
      // WebSocket 尚未就绪，稍后重试
      await new Promise(r => setTimeout(r, 100))
    }
  }
  return null
}

// 供预览等场景直接获取轨迹逐点坐标
export { fetchTrackPoints }

/**
 * @description: 生成视频节点
 * 视频节点坐标 = GPX 时间对应位置的插值；短视频保证至少 1 个节点（起点处）。
 * 关联信息（轨迹 + 偏移）由调用方从 trackInfo.videos 传入，视频自身不再持有 trackId/timeOffsetMs。
 * @param {IVideoInfo} video 视频信息
 * @param {string} trackId 关联的 GPX 轨迹 ID
 * @param {number} timeOffsetMs 视频起点相对 GPX 起点的偏移（毫秒）
 * @param {number} sampleIntervalMs 节点采样间隔（毫秒），长视频按此间隔生成多个节点
 * @param {number} minDistanceM 节点最小距离（米）
 * @returns {IVideoNode[]} 生成的节点
 */
export async function generateVideoNodes(
  video: IVideoInfo,
  trackId: string,
  timeOffsetMs = 0,
  sampleIntervalMs = 5000,
  minDistanceM = 50
): Promise<IVideoNode[]> {
  if (!trackId) return []

  const gpx = await fetchTrackPoints(trackId)
  if (!gpx || gpx.length === 0) return []

  // 计算视频起点的绝对时刻：偏移 + GPX 起始绝对时刻
  const gpxStartAbsMs = gpx[0]?.timeMs || 0
  const startAbsMs = gpxStartAbsMs + (timeOffsetMs || 0)

  const nodes: IVideoNode[] = []

  // 视频绝对时刻范围
  const duration = video.durationMs || 0
  const endMs = duration > 0 ? startAbsMs + duration : startAbsMs

  // 起点节点（保证至少 1 个）
  const startCoord = interpolateAt(gpx, startAbsMs)
  if (startCoord) {
    nodes.push({ videoId: video.id, timeMs: 0, lat: startCoord[1], lng: startCoord[0], viewType: 'video' })
  }

  // 长视频按时间间隔采样更多节点
  if (duration > 0) {
    let t = sampleIntervalMs
    while (t < duration) {
      const absTime = startAbsMs + t
      const coord = interpolateAt(gpx, absTime)
      if (coord) {
        nodes.push({ videoId: video.id, timeMs: t, lat: coord[1], lng: coord[0], viewType: 'video' })
      }
      t += sampleIntervalMs
    }
  }

  // 距离抽稀：相邻节点距离 < minDistanceM 时合并（保持至少起点节点）
  if (nodes.length > 1) {
    const result: IVideoNode[] = [nodes[0]]
    for (let i = 1; i < nodes.length; i++) {
      const prev = result[result.length - 1]
      const dist = haversine(prev.lat, prev.lng, nodes[i].lat, nodes[i].lng)
      if (dist >= minDistanceM) {
        result.push(nodes[i])
      }
    }
    return result
  }

  return nodes
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
