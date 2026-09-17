import * as maplibregl from 'maplibre-gl'
import { wgs84ToGcj02 } from '../utils/WGS84-GCJ02'
import API from '@/wails/api'
import { getDefaultLineColor } from '@/utils/track'
import { resolveIconUrl } from '@/utils/icon'
import { useSchemaStore } from '@/store/schema'
import { toMapLibreLngLat } from '@/utils/mapLibre'
import { parseGpxTimeToMs } from '@/utils/videoNode'

const startIconUrl = new URL('../assets/icon/起点.png', import.meta.url).href
const endIconUrl = new URL('../assets/icon/终点.png', import.meta.url).href

const defaultOptions = {}

const TRACK_INSTANCE_GC_DELAY_MS = 2000

// ---- 轨迹线与流动虚线样式 ----
const TRACK_LINE_WIDTH = 3
const TRACK_LINE_OPACITY = 0.8
const TRACK_LINE_HIGHLIGHT_WIDTH = 6
const TRACK_LINE_HIGHLIGHT_OPACITY = 0.5
const TRACK_HIT_LINE_WIDTH = 24

// ---- 流动虚线动画配置 ----
// 逐帧循环的 line-dasharray 序列（Mapbox 官方 "Animate a line" 用法）
// 步长越小，每次前进距离越小、流动越平缓
const FLOW_DASH_SEQUENCE: number[][] = [
  [0, 4, 3], [0.2, 4, 2.8], [0.4, 4, 2.6], [0.6, 4, 2.4],
  [0.8, 4, 2.2], [1, 4, 2], [1.2, 4, 1.8], [1.4, 4, 1.6],
  [1.6, 4, 1.4], [1.8, 4, 1.2], [2, 4, 1], [2.2, 4, 0.8],
  [2.4, 4, 0.6], [2.6, 4, 0.4], [2.8, 4, 0.2], [3, 4, 0],
  [0, 0.2, 3, 3.8], [0, 0.4, 3, 3.6], [0, 0.6, 3, 3.4], [0, 0.8, 3, 3.2],
  [0, 1, 3, 3], [0, 1.2, 3, 2.8], [0, 1.4, 3, 2.6], [0, 1.6, 3, 2.4],
  [0, 1.8, 3, 2.2], [0, 2, 3, 2], [0, 2.2, 3, 1.8], [0, 2.4, 3, 1.6],
  [0, 2.6, 3, 1.4], [0, 2.8, 3, 1.2], [0, 3, 3, 1], [0, 3.2, 3, 0.8],
  [0, 3.4, 3, 0.6], [0, 3.6, 3, 0.4], [0, 3.8, 3, 0.2],
]
// 每推进一帧间隔的帧数（越大流动越慢）
const FLOW_FRAME_INTERVAL = 6
const FLOW_LINE_WIDTH = 6
const FLOW_LINE_OPACITY = 1

// 轨迹渲染引用：每个地图独立的 source/layer id
interface TrackLayerRef {
  sourceId: string
  layerId: string
  // 加宽的透明命中层（扩大可点击判定范围），与可见线层共用 source
  hitLayerId?: string
  // 流动虚线层（仅高亮轨迹时显示，表示前进方向），与可见线层共用 source
  flowLayerId?: string
}

/**
 * 轨迹服务类
 * 负责管理所有轨迹实例，提供轨迹的激活、显示、隐藏、删除等功能
 */
class TrackService {
  private trackInstances: Map<string, TrackInstance>
  private destroyTimers: Map<string, ReturnType<typeof setTimeout>>

  constructor() {
    this.trackInstances = new Map()
    this.destroyTimers = new Map()
  }

  private clearDestroyTimer(trackId: string) {
    const timer = this.destroyTimers.get(trackId)
    if (timer) {
      clearTimeout(timer)
      this.destroyTimers.delete(trackId)
    }
  }

  private scheduleDestroy(trackId: string) {
    this.clearDestroyTimer(trackId)
    const timer = setTimeout(() => {
      const trackInstance = this.trackInstances.get(trackId)
      if (trackInstance && trackInstance.getMapInstances().length === 0) {
        this.trackInstances.delete(trackId)
      }
      this.destroyTimers.delete(trackId)
    }, TRACK_INSTANCE_GC_DELAY_MS)
    this.destroyTimers.set(trackId, timer)
  }

  getTrackInstanceById(trackId: string): TrackInstance | undefined {
    return this.trackInstances.get(trackId)
  }

  activeTrack(file: File, map?: maplibregl.Map, options: any = defaultOptions): TrackInstance {
    let trackInstance = this.trackInstances.get(file.name)
    if (trackInstance) {
      this.clearDestroyTimer(file.name)
      if (map) {
        trackInstance.addMap(map)
      }
    } else {
      const schemaStore = useSchemaStore()
      const schemaTrackInfo = schemaStore.getSchema.trackInfo?.find((t: any) => t.id === file.name)

      trackInstance = new TrackInstance(file, map ? [map] : [], options, schemaTrackInfo)
      this.trackInstances.set(trackInstance.getTrackId(), trackInstance)
    }
    return trackInstance
  }

  hideTrack(trackId: string, map?: maplibregl.Map) {
    const trackInstance = this.trackInstances.get(trackId)
    if (trackInstance) {
      const setHidden = (m: maplibregl.Map) => {
        const ref = trackInstance.getTrackLayer(m)
        if (!ref) return
        if (m.getLayer(ref.layerId)) m.setLayoutProperty(ref.layerId, 'visibility', 'none')
        if (ref.hitLayerId && m.getLayer(ref.hitLayerId)) m.setLayoutProperty(ref.hitLayerId, 'visibility', 'none')
      }
      if (map) {
        setHidden(map)
      } else {
        trackInstance.getMapInstances().forEach(setHidden)
      }
    }
  }

  hideAllTracks(map: maplibregl.Map) {
    this.getInstances().forEach((trackInstance) => {
      const ref = trackInstance.getTrackLayer(map)
      if (ref) {
        if (map.getLayer(ref.layerId)) map.setLayoutProperty(ref.layerId, 'visibility', 'none')
        if (ref.hitLayerId && map.getLayer(ref.hitLayerId)) map.setLayoutProperty(ref.hitLayerId, 'visibility', 'none')
      }
      trackInstance.removeMap(map)
    })
  }

  showTrack(trackId: string, map?: maplibregl.Map) {
    const trackInstance = this.trackInstances.get(trackId)
    if (trackInstance) {
      if (map) {
        trackInstance.addMap(map)
      } else {
        trackInstance.getMapInstances().forEach((m) => {
          trackInstance.addMap(m)
        })
      }
    }
  }

  deleteTrack(trackId: string) {
    this.clearDestroyTimer(trackId)
    const trackInstance = this.trackInstances.get(trackId)
    if (trackInstance) {
      trackInstance.getMapInstances().slice().forEach((map) => {
        trackInstance.removeMap(map)
      })
      this.trackInstances.delete(trackId)
    }
  }

  deleteAllTracks() {
    this.destroyTimers.forEach((timer) => clearTimeout(timer))
    this.destroyTimers.clear()
    this.getInstances().forEach((trackInstance) => {
      trackInstance.getMapInstances().slice().forEach((map) => {
        trackInstance.removeMap(map)
      })
    })
    this.trackInstances.clear()
  }

  updateTrackColor(trackId: string, color: string) {
    const trackInstance = this.trackInstances.get(trackId)
    if (trackInstance) {
      trackInstance.setLineColor(color)
    }
  }

  deleteTracksInMap(map: maplibregl.Map) {
    this.getInstances().forEach((trackInstance) => {
      trackInstance.removeMap(map)
      if (trackInstance.getMapInstances().length === 0) {
        this.scheduleDestroy(trackInstance.getTrackId())
      }
    })
  }

  async uploadTrack(file: File) {
    const res = await API.track.uploadTrack(file)
    return res
  }

  getInstances() {
    return Array.from(this.trackInstances.values())
  }
}

const trackService = new TrackService()

export default trackService

// -----------------------------------------

interface TrackInfo {
  name: string
  distance: number
  startTime: Date
  endTime: Date
  movingTime: number
  totalTime: number
  movingPace: number
  movingSpeed: number
  totalSpeed: number
  elevationMin: number
  elevationMax: number
  elevationGain: number
  elevationLoss: number
  speedMax: number
  averageHr: number | null
  averageCadence: number | null
  averageTemp: number | null
}

interface GpxPoint {
  lat: number
  lng: number
  ele: number | null
  time: number | null
  hr: number | null
  cadence: number | null
  temp: number | null
}

function parseGpxPoints(gpxText: string): GpxPoint[] {
  const parser = new DOMParser()
  // 去除 UTF-8 BOM，避免解析器报 "XML declaration allowed only at the start"
  const text = gpxText.replace(/^\uFEFF/, '')
  const doc = parser.parseFromString(text, 'text/xml')
  const points: GpxPoint[] = []
  // 命名空间无关：带默认 xmlns 的 GPX（如 iGPSPORT）用 querySelectorAll('trkpt') 可能匹配不到
  const trkpts = doc.getElementsByTagNameNS('*', 'trkpt')
  const trkptList = trkpts.length > 0
    ? Array.from(trkpts)
    : Array.from(doc.getElementsByTagName('trkpt'))
  trkptList.forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '')
    const lon = parseFloat(pt.getAttribute('lon') || '')
    if (!isFinite(lat) || !isFinite(lon)) return
    const [gcjLng, gcjLat] = wgs84ToGcj02(lon, lat)
    if (!isFinite(gcjLng) || !isFinite(gcjLat)) return
    const getTag = (name: string) =>
      pt.getElementsByTagNameNS('*', name)[0]?.textContent || pt.getElementsByTagName(name)[0]?.textContent
    const ele = getTag('ele')
    const time = getTag('time')
    const hr = getTag('hr')
    const cad = getTag('cad')
    const temp = getTag('atemp')
    points.push({
      lat: Number(gcjLat),
      lng: Number(gcjLng),
      ele: ele ? parseFloat(ele) : null,
      time: time ? parseGpxTimeToMs(time) : null,
      hr: hr ? parseFloat(hr) : null,
      cadence: cad ? parseFloat(cad) : null,
      temp: temp ? parseFloat(temp) : null,
    })
  })
  return points
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function computeTrackInfo(points: GpxPoint[]): Partial<TrackInfo> {
  let distance = 0
  let movingTime = 0
  let elevationGain = 0
  let elevationLoss = 0
  let elevationMin = Infinity
  let elevationMax = -Infinity
  let speedMax = 0
  let startTime: number | null = null
  let endTime: number | null = null
  let hrSum = 0
  let hrCount = 0
  let cadSum = 0
  let cadCount = 0
  let tempSum = 0
  let tempCount = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const seg = haversine(prev.lat, prev.lng, cur.lat, cur.lng)
    distance += seg
    if (cur.ele != null) {
      const delta = cur.ele - (prev.ele ?? cur.ele)
      if (delta > 0) elevationGain += delta
      if (delta < 0) elevationLoss += -delta
      elevationMin = Math.min(elevationMin, cur.ele)
      elevationMax = Math.max(elevationMax, cur.ele)
    }
    if (prev.time != null && cur.time != null) {
      const dt = (cur.time - prev.time) / 1000
      if (dt > 0) {
        const speed = seg / dt
        // 速度 > 0.3 m/s 视为移动，累计移动时长
        if (speed > 0.3) movingTime += dt
        if (speed > speedMax) speedMax = speed
      }
    }
    if (cur.hr != null) { hrSum += cur.hr; hrCount++ }
    if (cur.cadence != null) { cadSum += cur.cadence; cadCount++ }
    if (cur.temp != null) { tempSum += cur.temp; tempCount++ }
  }

  if (points.length > 0) {
    startTime = points[0].time
    endTime = points[points.length - 1].time
    if (points[0].ele != null) {
      elevationMin = Math.min(elevationMin, points[0].ele)
      elevationMax = Math.max(elevationMax, points[0].ele)
    }
  }

  const totalTime = startTime != null && endTime != null ? (endTime - startTime) / 1000 : 0
  const movingPace = movingTime > 0 ? (movingTime * 1000) / Math.max(distance, 0.001) : 0
  const movingSpeed = movingTime > 0 ? (distance / 1000) / (movingTime / 3600) : 0
  const totalSpeed = totalTime > 0 ? (distance / 1000) / (totalTime / 3600) : 0

  return {
    distance,
    startTime: startTime != null ? new Date(startTime) : undefined,
    endTime: endTime != null ? new Date(endTime) : undefined,
    movingTime: movingTime * 1000,
    totalTime: totalTime * 1000,
    movingPace,
    movingSpeed,
    totalSpeed,
    elevationMin: elevationMin === Infinity ? 0 : elevationMin,
    elevationMax: elevationMax === -Infinity ? 0 : elevationMax,
    elevationGain,
    elevationLoss,
    speedMax: speedMax * 3.6,
    averageHr: hrCount > 0 ? hrSum / hrCount : null,
    averageCadence: cadCount > 0 ? cadSum / cadCount : null,
    averageTemp: tempCount > 0 ? tempSum / tempCount : null,
  }
}

function createEdgeMarkerElement(url: string, className: string): HTMLElement {
  const el = document.createElement('div')
  el.className = `track-marker-icon ${className}`
  const img = document.createElement('img')
  img.src = url
  img.width = 25
  img.height = 41
  el.appendChild(img)
  return el
}

class TrackInstance {
  private trackId: string
  private layerByMap: WeakMap<maplibregl.Map, TrackLayerRef> = new WeakMap()
  private trackInfo: Partial<TrackInfo> = {}
  private mapInstances: maplibregl.Map[] = []
  private pendingCallbacks: ((trackInfo: any) => void)[] = []
  private options: any
  private points: GpxPoint[] = []
  private coordinates: [number, number][] = []
  private coordinatesReadyCallbacks: (() => void)[] = []
  private coordinatesReady = false
  private lineColor: string | undefined = getDefaultLineColor(true)
  private startIconId: string | undefined
  private endIconId: string | undefined
  private hoverCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>, event: 'enter' | 'leave') => void> = new Map()
  private clickCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>, e?: any) => void> = new Map()
  private contextMenuCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>, event: any) => void> = new Map()
  private highlightedMapId: string | null = null
  private edgeMarkers: Map<maplibregl.Map, maplibregl.Marker[]> = new Map()
  // 流动虚线动画状态（仅高亮轨迹运行）
  private flowAnimFrame: number | null = null
  private flowAnimStep = 0
  private flowAnimMap: maplibregl.Map | null = null

  private hashTrackId(seed: string) {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  setLineColor(color: string | undefined) {
    this.lineColor = color
    this.mapInstances.forEach((map) => {
      const ref = this.layerByMap.get(map)
      if (ref && map.getLayer(ref.layerId)) {
        map.setPaintProperty(ref.layerId, 'line-color', color ?? getDefaultLineColor(true))
      }
      if (ref?.flowLayerId && map.getLayer(ref.flowLayerId)) {
        map.setPaintProperty(ref.flowLayerId, 'line-color', color ?? getDefaultLineColor(true))
      }
    })
  }

  // 更新起终点图标并刷新所有地图上的边缘 marker
  setEdgeIcons(startIconId: string | undefined, endIconId: string | undefined) {
    this.startIconId = startIconId
    this.endIconId = endIconId
    this.edgeMarkers.forEach((markers, map) => {
      const [startMarker, endMarker] = markers
      if (startMarker && this.startIconId) this.applyEdgeIcon(startMarker, this.startIconId, 'start')
      if (endMarker && this.endIconId) this.applyEdgeIcon(endMarker, this.endIconId, 'end')
    })
  }

  // 多条轨迹起终点重叠时，做极小偏移避免完全遮挡
  private disambiguateEdgeMarker(marker: maplibregl.Marker, pointType: 'start' | 'end') {
    const origin = marker.getLngLat()
    const slotCount = 12
    const slot = this.hashTrackId(`${this.trackId}-${pointType}`) % slotCount
    const angle = (Math.PI * 2 * slot) / slotCount
    const radius = pointType === 'start' ? 0.00002 : 0.000026
    const lat = origin.lat + radius * Math.sin(angle)
    const lng = origin.lng + radius * Math.cos(angle)
    marker.setLngLat([lng, lat])
    const el = marker.getElement()
    // 地图内分层即可，避免过高 z-index 盖过弹窗
    el.style.zIndex = String(10 + slot + (pointType === 'end' ? 1 : 0))
  }

  constructor(file: File, maps: maplibregl.Map[] = [], options: any = defaultOptions, schemaTrackInfo?: any) {
    this.trackId = file.name
    this.options = options
    this.mapInstances.push(...maps.filter((map): map is maplibregl.Map => !!map))

    if (schemaTrackInfo) {
      this.initTrackInfo(schemaTrackInfo)
      this.startIconId = schemaTrackInfo.setting?.startIconId
      this.endIconId = schemaTrackInfo.setting?.endIconId
    }

    this.readFileAsText(file).then((fileContent) => {
      this.points = parseGpxPoints(fileContent)
      this.coordinates = this.points.map((p) => toMapLibreLngLat(p.lat, p.lng))
      this.mapInstances.forEach((map) => {
        if (map) {
          this.addMap(map)
        }
      })
      this.coordinatesReady = true
      this.coordinatesReadyCallbacks.forEach((cb) => cb())
      this.coordinatesReadyCallbacks = []
    })
  }

  initTrackInfo(trackInfo: Partial<TrackInfo>) {
    this.trackInfo = trackInfo
    if (this.pendingCallbacks.length > 0) {
      this.pendingCallbacks.forEach((cb) => cb(this.trackInfo))
      this.pendingCallbacks = []
    }
  }

  private createLayerForMap(map: maplibregl.Map): TrackLayerRef {
    const hash = this.hashTrackId(this.trackId)
    const sourceId = `track-src-${hash}`
    const layerId = `track-layer-${hash}`
    const hitLayerId = `track-hit-${hash}`
    const flowLayerId = `track-flow-${hash}`
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: this.coordinates },
        },
      })
    }
    // 可见线层（细线展示）
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': this.lineColor ?? getDefaultLineColor(true),
          'line-width': TRACK_LINE_WIDTH,
          'line-opacity': TRACK_LINE_OPACITY,
        },
      })
    }
    // 流动虚线层：默认隐藏，高亮时显示表示前进方向（颜色跟随轨迹）
    if (!map.getLayer(flowLayerId)) {
      map.addLayer({
        id: flowLayerId,
        type: 'line',
        source: sourceId,
        layout: { visibility: 'none' },
        paint: {
          'line-color': this.lineColor ?? getDefaultLineColor(true),
          'line-width': FLOW_LINE_WIDTH,
          'line-opacity': FLOW_LINE_OPACITY,
          'line-dasharray': FLOW_DASH_SEQUENCE[0],
        },
      })
    }
    // 加宽透明的命中层：扩大 hover/点击判定范围，置于可见线层之下
    if (!map.getLayer(hitLayerId)) {
      map.addLayer({
        id: hitLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': 'transparent',
          'line-width': TRACK_HIT_LINE_WIDTH,
          'line-opacity': 0,
        },
      }, layerId)
    }
    // 交互事件绑定到命中层（判定范围更大）
    map.on('mouseenter', hitLayerId, () => {
      // 悬停轨迹线时切换为可点击光标
      if (map.getCanvas()) map.getCanvas().style.cursor = 'pointer'
      const cb = this.hoverCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), 'enter')
    })
    map.on('mouseleave', hitLayerId, () => {
      if (map.getCanvas()) map.getCanvas().style.cursor = 'grab'
      const cb = this.hoverCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), 'leave')
    })
    map.on('click', hitLayerId, (e) => {
      const cb = this.clickCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), e)
    })
    map.on('contextmenu', hitLayerId, (e) => {
      e.preventDefault()
      const cb = this.contextMenuCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), e)
    })
    this.addEdgeMarkers(map)
    if (!this.trackInfo.name) {
      this.trackInfo = {
        ...this.trackInfo,
        name: this.trackId.replace(/\.gpx$/i, ''),
        ...computeTrackInfo(this.points),
      }
      this.pendingCallbacks.forEach((cb) => cb(this.trackInfo))
      this.pendingCallbacks = []
    }
    return { sourceId, layerId, hitLayerId, flowLayerId }
  }

  private addEdgeMarkers(map: maplibregl.Map) {
    if (this.points.length === 0) return
    const start = this.points[0]
    const end = this.points[this.points.length - 1]
    const startEl = createEdgeMarkerElement(startIconUrl, 'track-marker-start')
    const endEl = createEdgeMarkerElement(endIconUrl, 'track-marker-end')
    // 起终点标记可点击：hover 时切换为可点击光标
    const bindEdgeCursor = (el: HTMLElement) => {
      el.addEventListener('mouseenter', () => {
        if (map.getCanvas()) map.getCanvas().style.cursor = 'pointer'
      })
      el.addEventListener('mouseleave', () => {
        if (map.getCanvas()) map.getCanvas().style.cursor = 'grab'
      })
    }
    bindEdgeCursor(startEl)
    bindEdgeCursor(endEl)
    // 点击起终点标记时，等同点击轨迹线（触发高亮等回调）
    startEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerClickCallback(map, { lngLat: { lng: start.lng, lat: start.lat } })
    })
    endEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.triggerClickCallback(map, { lngLat: { lng: end.lng, lat: end.lat } })
    })
    const startMarker = new maplibregl.Marker({ element: startEl, anchor: 'bottom' })
      .setLngLat(toMapLibreLngLat(start.lat, start.lng))
      .addTo(map)
    const endMarker = new maplibregl.Marker({ element: endEl, anchor: 'bottom' })
      .setLngLat(toMapLibreLngLat(end.lat, end.lng))
      .addTo(map)
    this.disambiguateEdgeMarker(startMarker, 'start')
    this.disambiguateEdgeMarker(endMarker, 'end')
    this.edgeMarkers.set(map, [startMarker, endMarker])
    // 应用自定义起终点图标（异步解析后更新）
    if (this.startIconId) {
      this.applyEdgeIcon(startMarker, this.startIconId, 'start')
    }
    if (this.endIconId) {
      this.applyEdgeIcon(endMarker, this.endIconId, 'end')
    }
  }

  // 触发某地图上注册的轨迹点击回调（轨迹线或起终点标记点击共用）
  private triggerClickCallback(map: maplibregl.Map, e?: any) {
    const cb = this.clickCallbacks.get(map)
    if (cb) cb(this.getTrackInfo(), e)
  }

  private applyEdgeIcon(marker: maplibregl.Marker, iconId: string, type: 'start' | 'end') {
    resolveIconUrl(iconId, 'track').then((url) => {
      if (!url) return
      const img = marker.getElement()?.querySelector('img')
      if (img) {
        ;(img as HTMLImageElement).src = url
      }
    })
  }

  addMap(map: maplibregl.Map) {
    if (!map) {
      console.error('addMap called with undefined map')
      return
    }
    if (!this.mapInstances.includes(map)) {
      this.mapInstances.push(map)
    }
    if (this.coordinates.length === 0) {
      return
    }
    let ref = this.layerByMap.get(map)
    if (!ref) {
      ref = this.createLayerForMap(map)
      this.layerByMap.set(map, ref)
    } else if (map.getLayer(ref.layerId)) {
      map.setLayoutProperty(ref.layerId, 'visibility', 'visible')
    }
  }

  getTrackId() {
    return this.trackId
  }

  // 坐标解析完成（含 addMap）后触发回调，用于重新适配地图边界
  onCoordinatesReady(callback: () => void) {
    if (this.coordinatesReady) {
      callback()
    } else {
      this.coordinatesReadyCallbacks.push(callback)
    }
  }

  // 返回轨迹的坐标边界 [[minLng, minLat], [maxLng, maxLat]]，无坐标时返回 null
  getBounds(): [number, number][] | null {
    if (this.coordinates.length === 0) return null
    let minLng = Infinity
    let minLat = Infinity
    let maxLng = -Infinity
    let maxLat = -Infinity
    this.coordinates.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    })
    return [[minLng, minLat], [maxLng, maxLat]]
  }

  getTrackLayer(map?: maplibregl.Map) {
    if (map) {
      return this.layerByMap.get(map)
    }
    return undefined
  }

  removeMap(map: maplibregl.Map) {
    const ref = this.layerByMap.get(map)
    if (ref) {
      if (ref.hitLayerId && map.getLayer(ref.hitLayerId)) map.removeLayer(ref.hitLayerId)
      if (ref.flowLayerId && map.getLayer(ref.flowLayerId)) map.removeLayer(ref.flowLayerId)
      if (map.getLayer(ref.layerId)) map.removeLayer(ref.layerId)
      if (map.getSource(ref.sourceId)) map.removeSource(ref.sourceId)
    }
    // 若正在该地图上播放流动动画，先停止
    if (this.flowAnimMap === map) this.stopFlowAnimation()
    const markers = this.edgeMarkers.get(map)
    if (markers) {
      markers.forEach((m) => m.remove())
      this.edgeMarkers.delete(map)
    }
    this.layerByMap.delete(map)
    this.hoverCallbacks.delete(map)
    this.clickCallbacks.delete(map)
    this.contextMenuCallbacks.delete(map)

    const index = this.mapInstances.indexOf(map)
    if (index !== -1) {
      this.mapInstances.splice(index, 1)
    }
  }

  getMapInstances() {
    return this.mapInstances
  }

  getTrackInfo() {
    return this.trackInfo
  }

  getLineColor() {
    return this.lineColor
  }

  setHoverCallback(map: maplibregl.Map, callback: (trackInfo: Partial<TrackInfo>, event: 'enter' | 'leave') => void) {
    this.hoverCallbacks.set(map, callback)
  }

  setClickCallback(map: maplibregl.Map, callback: (trackInfo: Partial<TrackInfo>, e?: any) => void) {
    this.clickCallbacks.set(map, callback)
  }

  setContextMenuCallback(map: maplibregl.Map, callback: (trackInfo: Partial<TrackInfo>, event: any) => void) {
    this.contextMenuCallbacks.set(map, callback)
  }

  highlight(map: maplibregl.Map, mapId: string) {
    if (this.highlightedMapId === mapId) {
      return
    }
    this.unhighlight()
    this.highlightedMapId = mapId

    const ref = this.layerByMap.get(map)
    if (ref && map.getLayer(ref.layerId)) {
      map.setPaintProperty(ref.layerId, 'line-color', this.lineColor ?? getDefaultLineColor(true))
      map.setPaintProperty(ref.layerId, 'line-width', TRACK_LINE_HIGHLIGHT_WIDTH)
      map.setPaintProperty(ref.layerId, 'line-opacity', TRACK_LINE_HIGHLIGHT_OPACITY)
      map.moveLayer(ref.layerId)
    }
    // 高亮时显示流动虚线并启动前进方向动画
    if (ref?.flowLayerId && map.getLayer(ref.flowLayerId)) {
      map.setPaintProperty(ref.flowLayerId, 'line-color', this.lineColor ?? getDefaultLineColor(true))
      map.setPaintProperty(ref.flowLayerId, 'line-width', FLOW_LINE_WIDTH)
      map.setPaintProperty(ref.flowLayerId, 'line-opacity', FLOW_LINE_OPACITY)
      map.setLayoutProperty(ref.flowLayerId, 'visibility', 'visible')
      // 流动层置于最上层，虚线覆盖在实线之上
      map.moveLayer(ref.flowLayerId)
      this.startFlowAnimation(map)
    }
  }

  unhighlight() {
    if (!this.highlightedMapId) return

    this.mapInstances.forEach((map) => {
      const ref = this.layerByMap.get(map)
      if (ref && map.getLayer(ref.layerId)) {
        map.setPaintProperty(ref.layerId, 'line-color', this.lineColor ?? getDefaultLineColor(true))
        map.setPaintProperty(ref.layerId, 'line-width', TRACK_LINE_WIDTH)
        map.setPaintProperty(ref.layerId, 'line-opacity', TRACK_LINE_OPACITY)
      }
      if (ref?.flowLayerId && map.getLayer(ref.flowLayerId)) {
        map.setLayoutProperty(ref.flowLayerId, 'visibility', 'none')
      }
    })
    this.stopFlowAnimation()

    this.highlightedMapId = null
  }

  // 启动流动虚线动画：定时推进 line-dasharray 相位，产生沿轨迹前进的流动效果
  private startFlowAnimation(map: maplibregl.Map) {
    this.stopFlowAnimation()
    this.flowAnimMap = map
    this.flowAnimStep = 0
    const ref = this.layerByMap.get(map)
    if (!ref?.flowLayerId) return
    const flowLayerId = ref.flowLayerId
    let frameCount = 0
    const tick = () => {
      if (!this.flowAnimMap || !map.getLayer(flowLayerId)) {
        this.flowAnimFrame = null
        return
      }
      // 每 FLOW_FRAME_INTERVAL 帧推进一格，控制流动速度
      if (frameCount % FLOW_FRAME_INTERVAL === 0) {
        const dash = FLOW_DASH_SEQUENCE[this.flowAnimStep % FLOW_DASH_SEQUENCE.length]
        map.setPaintProperty(flowLayerId, 'line-dasharray', dash)
        this.flowAnimStep++
      }
      frameCount++
      this.flowAnimFrame = requestAnimationFrame(tick)
    }
    this.flowAnimFrame = requestAnimationFrame(tick)
  }

  // 停止流动虚线动画
  private stopFlowAnimation() {
    if (this.flowAnimFrame != null) {
      cancelAnimationFrame(this.flowAnimFrame)
      this.flowAnimFrame = null
    }
    this.flowAnimMap = null
  }

  onTrackInfoReady(callback: (trackInfo: any) => void) {
    if (this.trackInfo && this.trackInfo.name) {
      callback(this.trackInfo)
    } else {
      this.pendingCallbacks.push(callback)
    }
  }

  readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target!.result as string)
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file)
    })
  }
}
