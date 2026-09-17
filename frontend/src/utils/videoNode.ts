/*
 * 视频节点生成工具
 * @Description: 将关联 GPX 的视频按其时间轴生成地图节点（坐标来自 GPX 时间对应位置的插值）
 */
import API from '@/wails/api'
import type { IVideoNode } from '@/type/video'
import type { IVideoInfo, ITrackInfo, IVideoRef } from '@/type/schema'

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

// ---- 视频配色（轨迹关联视频的独立配色，时间线条带 / 地图高亮弧段 / 标签背景共用） ----

export const VIDEO_COLORS = [
  '#e6a23c', '#67c23a', '#409eff', '#f56c6c', '#909399',
  '#9b59b6', '#1abc9c', '#e74c3c', '#3498db', '#f39c12',
  '#2ecc71', '#16a085', '#8e44ad', '#d35400', '#c0392b',
  '#27ae60', '#2980b9', '#f1c40f', '#e67e22', '#7f8c8d',
]

/**
 * @description: 根据视频在轨迹 videos 数组中的索引取色（与对齐视频界面一致）
 */
export function getVideoColor(index: number): string {
  return VIDEO_COLORS[((index % VIDEO_COLORS.length) + VIDEO_COLORS.length) % VIDEO_COLORS.length]
}

// ---- 视频弧段高亮样式（地图上高亮视频对应轨迹段共用） ----
export const VIDEO_SEG_LINE_WIDTH = 7
export const VIDEO_SEG_LINE_OPACITY = 0.6

// ---- GPX 解析（含时间戳） ----

export interface IGpxPoint {
  lat: number      // GCJ02 纬度
  lng: number      // GCJ02 经度
  timeMs: number   // 绝对时间戳（epoch ms），0 表示缺失
}

/**
 * @description: 解析 GPX 的时间字符串为毫秒时间戳。
 * 部分设备（如 iGPSPORT）导出时把本地时间错误地加上了 'Z'（UTC 后缀），
 * 若按 UTC 解析会多出时区偏移（如 +8h）。此处统一按本地墙钟时间解析（忽略时区后缀）。
 */
export function parseGpxTimeToMs(time: string): number {
  if (!time) return 0
  const m = time.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])).getTime()
  }
  const t = new Date(time).getTime()
  return isNaN(t) ? 0 : t
}

export function parseGpxPoints(gpxText: string): IGpxPoint[] {
  // 去除 UTF-8 BOM，避免部分解析器因 "XML declaration allowed only at the start" 报错
  const text = gpxText.replace(/^\uFEFF/, '')
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  const points: IGpxPoint[] = []
  // 命名空间无关：部分 GPX 带默认 xmlns（如 iGPSPORT 的 topografix GPX/1/1），
  // querySelectorAll('trkpt') 在带命名空间的 XML 下可能匹配不到，故用 getElementsByTagNameNS('*', ...)
  const trkpts = doc.getElementsByTagNameNS('*', 'trkpt')
  const trkptList = trkpts.length > 0
    ? Array.from(trkpts)
    : Array.from(doc.getElementsByTagName('trkpt'))
  trkptList.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '')
    const lon = parseFloat(pt.getAttribute('lon') || '')
    if (!isFinite(lat) || !isFinite(lon)) return
    const [gcjLng, gcjLat] = wgs84ToGcj02(lon, lat)
    const time = pt.getElementsByTagNameNS('*', 'time')[0]?.textContent
      || pt.getElementsByTagName('time')[0]?.textContent
    points.push({
      lat: gcjLat,
      lng: gcjLng,
      timeMs: time ? parseGpxTimeToMs(time) : 0,
    })
  })
  return points
}

// ---- 时间 → 坐标插值 ----

/**
 * @description: 二分查找 timeMs 在轨迹点序列中的插入位置（第一个 timeMs >= 目标 的下标）
 * 依赖轨迹点按时间升序排列
 */
function findIndexByTime(gpx: IGpxPoint[], timeMs: number): number {
  let lo = 0
  let hi = gpx.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (gpx[mid].timeMs < timeMs) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * @description: 给定绝对时刻，在 GPX 点序列上线性插值得到坐标
 * 采用二分查找定位相邻两点，复杂度 O(log n)
 * @returns {[number, number]} GCJ02 [lng, lat]，越界时返回最近端点
 */
export function interpolateAt(gpx: IGpxPoint[], timeMs: number): [number, number] | null {
  if (gpx.length === 0) return null
  // 单点或多点中无时间信息
  if (gpx.length === 1) return [gpx[0].lng, gpx[0].lat]

  const first = gpx[0]
  const last = gpx[gpx.length - 1]
  if (first.timeMs !== 0 && timeMs <= first.timeMs) return [first.lng, first.lat]
  if (last.timeMs !== 0 && timeMs >= last.timeMs) return [last.lng, last.lat]

  // 二分定位：idx 为第一个 timeMs >= timeMs 的点
  const idx = findIndexByTime(gpx, timeMs)
  if (idx <= 0 || idx >= gpx.length) return null
  const a = gpx[idx - 1]
  const b = gpx[idx]
  if (a.timeMs === 0 || b.timeMs === 0) return null
  const ratio = (timeMs - a.timeMs) / (b.timeMs - a.timeMs)
  return [a.lng + (b.lng - a.lng) * ratio, a.lat + (b.lat - a.lat) * ratio]
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
 * @description: 提取视频时间段 [timeOffsetMs, timeOffsetMs+durationMs] 对应的轨迹坐标段（含首尾插值端点）
 * 用于点击视频时聚焦到其在轨迹上的对应弧段（与"对齐视频"弹窗的聚焦效果一致）
 * @returns {[number, number][]} GCJ02 坐标数组，无有效坐标时返回空数组
 */
export function extractSegmentCoords(
  gpx: IGpxPoint[],
  timeOffsetMs: number,
  durationMs: number
): [number, number][] {
  if (!gpx || gpx.length < 2) return []
  const gpxStart = gpx[0].timeMs
  if (!gpxStart) return []
  const startAbs = gpxStart + (timeOffsetMs || 0)
  const endAbs = startAbs + (durationMs || 0)
  return extractRangeCoords(gpx, startAbs, endAbs)
}

/**
 * @description: 提取轨迹上绝对时间区间 [startAbs, endAbs] 对应的坐标段（含首尾插值端点）
 * @returns {[number, number][]} GCJ02 坐标数组，无有效坐标时返回空数组
 */
export function extractRangeCoords(
  gpx: IGpxPoint[],
  startAbs: number,
  endAbs: number
): [number, number][] {
  if (!gpx || gpx.length < 2) return []

  const coords: [number, number][] = []
  const startCoord = interpolateAt(gpx, startAbs)
  if (startCoord) coords.push(startCoord)

  // 二分定位区间内的点下标范围，只遍历落在 (startAbs, endAbs) 内的点（避免全量扫描）
  for (let i = findIndexByTime(gpx, startAbs); i < gpx.length && gpx[i].timeMs < endAbs; i++) {
    const p = gpx[i]
    if (!p.timeMs || p.timeMs <= startAbs) continue
    coords.push([p.lng, p.lat])
  }

  const endCoord = interpolateAt(gpx, endAbs)
  if (endCoord) {
    const last = coords[coords.length - 1]
    if (!last || Math.abs(last[0] - endCoord[0]) > 1e-9 || Math.abs(last[1] - endCoord[1]) > 1e-9) {
      coords.push(endCoord)
    }
  }
  return coords
}

/**
 * @description: 根据地图点击经纬度，判断点击位置落在轨迹上哪个视频对应的时间段内
 * 先找轨迹点集中距离点击点最近的点，取该点时间戳，再匹配覆盖该时间的视频
 * @param {IGpxPoint[]} gpx 轨迹点集（GCJ02，含时间戳）
 * @param {IVideoRef[]} videos 轨迹关联的视频引用（含 timeOffsetMs）
 * @param {{lng:number,lat:number}} lngLat 点击位置（GCJ02）
 * @param {(number|null)[]} durationList 与 videos 一一对应的视频时长（毫秒）
 * @returns {number} 命中的视频索引，未命中返回 -1
 */
export function findVideoIndexAtLngLat(
  gpx: IGpxPoint[],
  videos: IVideoRef[],
  lngLat: { lng: number; lat: number },
  durationList: (number | null)[]
): number {
  if (!gpx || gpx.length === 0 || !videos || videos.length === 0) return -1
  const gpxStart = gpx[0].timeMs
  if (!gpxStart) return -1

  // 找距离点击点最近的轨迹点
  let nearest = gpx[0]
  let minDist = Infinity
  for (const p of gpx) {
    const dlng = p.lng - lngLat.lng
    const dlat = p.lat - lngLat.lat
    const dist = dlng * dlng + dlat * dlat
    if (dist < minDist) {
      minDist = dist
      nearest = p
    }
  }
  if (!nearest.timeMs) return -1

  // 点击时间落在哪个视频时间段内
  for (let i = 0; i < videos.length; i++) {
    const offset = videos[i].timeOffsetMs ?? 0
    const duration = durationList[i] ?? 0
    const startAbs = gpxStart + offset
    const endAbs = duration > 0 ? startAbs + duration : startAbs
    if (nearest.timeMs >= startAbs && nearest.timeMs <= endAbs) {
      return i
    }
  }
  return -1
}

export interface IVideoSegmentHit {
  index: number
  videoId: string
  color: string
  timeOffsetMs: number
  segCoords: [number, number][]
}

/**
 * @description: 由点击位置解析命中的视频弧段（纯计算，供地图组件共用，避免多处实现漂移）
 * 内部完成：匹配命中视频 + 计算该视频对应弧段坐标 + 取配色
 * @param {IGpxPoint[]} gpx 轨迹点集（GCJ02，含时间戳）
 * @param {IVideoRef[]} videos 轨迹关联的视频引用
 * @param {IVideoInfo[]} videoInfoList 全量视频信息（用于取时长）
 * @param {{lng:number,lat:number}} lngLat 点击位置（GCJ02）
 * @returns {IVideoSegmentHit | null} 命中结果；未命中或无有效弧段返回 null
 */
export function resolveVideoSegmentAtPoint(
  gpx: IGpxPoint[],
  videos: IVideoRef[],
  videoInfoList: IVideoInfo[],
  lngLat: { lng: number; lat: number }
): IVideoSegmentHit | null {
  if (!videos || videos.length === 0) return null
  const durationList = videos.map(
    (v) => videoInfoList.find((vi) => vi.id === v.videoId)?.durationMs ?? null
  )
  const index = findVideoIndexAtLngLat(gpx, videos, lngLat, durationList)
  if (index < 0) return null
  const ref = videos[index]
  const durationMs = durationList[index] ?? 0
  const segCoords = extractSegmentCoords(gpx, ref?.timeOffsetMs ?? 0, durationMs)
  if (segCoords.length < 2) return null
  return {
    index,
    videoId: ref.videoId,
    color: getVideoColor(index),
    timeOffsetMs: ref?.timeOffsetMs ?? 0,
    segCoords,
  }
}

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
