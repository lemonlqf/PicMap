import * as maplibregl from 'maplibre-gl'
import { wgs84ToGcj02 } from '../utils/WGS84-GCJ02'
import API from '@/wails/api'
import { getDefaultLineColor } from '@/utils/track'
import { resolveIconUrl } from '@/utils/icon'
import { useSchemaStore } from '@/store/schema'
import { toMapLibreLngLat } from '@/utils/mapLibre'

const startIconUrl = new URL('../assets/icon/起点.png', import.meta.url).href
const endIconUrl = new URL('../assets/icon/终点.png', import.meta.url).href

const defaultOptions = {}

const TRACK_INSTANCE_GC_DELAY_MS = 2000

// 轨迹渲染引用：每个地图独立的 source/layer id
interface TrackLayerRef {
  sourceId: string
  layerId: string
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
      if (map) {
        const ref = trackInstance.getTrackLayer(map)
        if (ref && map.getLayer(ref.layerId)) {
          map.setLayoutProperty(ref.layerId, 'visibility', 'none')
        }
      } else {
        trackInstance.getMapInstances().forEach((m) => {
          const ref = trackInstance.getTrackLayer(m)
          if (ref && m.getLayer(ref.layerId)) {
            m.setLayoutProperty(ref.layerId, 'visibility', 'none')
          }
        })
      }
    }
  }

  hideAllTracks(map: maplibregl.Map) {
    this.getInstances().forEach((trackInstance) => {
      const ref = trackInstance.getTrackLayer(map)
      if (ref && map.getLayer(ref.layerId)) {
        map.setLayoutProperty(ref.layerId, 'visibility', 'none')
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
  const doc = parser.parseFromString(gpxText, 'text/xml')
  const points: GpxPoint[] = []
  doc.querySelectorAll('trkpt').forEach((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '')
    const lon = parseFloat(pt.getAttribute('lon') || '')
    if (!isFinite(lat) || !isFinite(lon)) return
    const [gcjLng, gcjLat] = wgs84ToGcj02(lon, lat)
    if (!isFinite(gcjLng) || !isFinite(gcjLat)) return
    const ele = pt.getElementsByTagName('ele')[0]?.textContent
    const time = pt.getElementsByTagName('time')[0]?.textContent
    const hr = pt.getElementsByTagName('hr')[0]?.textContent
    const cad = pt.getElementsByTagName('cad')[0]?.textContent
    const temp = pt.getElementsByTagName('atemp')[0]?.textContent
    points.push({
      lat: Number(gcjLat),
      lng: Number(gcjLng),
      ele: ele ? parseFloat(ele) : null,
      time: time ? new Date(time).getTime() : null,
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
  private clickCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>) => void> = new Map()
  private contextMenuCallbacks: Map<maplibregl.Map, (trackInfo: Partial<TrackInfo>, event: any) => void> = new Map()
  private highlightedMapId: string | null = null
  private edgeMarkers: Map<maplibregl.Map, maplibregl.Marker[]> = new Map()

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
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': this.lineColor ?? getDefaultLineColor(true),
          'line-width': 3,
          'line-opacity': 0.8,
        },
      })
    }
    map.on('mouseenter', layerId, () => {
      const cb = this.hoverCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), 'enter')
    })
    map.on('mouseleave', layerId, () => {
      const cb = this.hoverCallbacks.get(map)
      if (cb) cb(this.getTrackInfo(), 'leave')
    })
    map.on('click', layerId, () => {
      const cb = this.clickCallbacks.get(map)
      if (cb) cb(this.getTrackInfo())
    })
    map.on('contextmenu', layerId, (e) => {
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
    return { sourceId, layerId }
  }

  private addEdgeMarkers(map: maplibregl.Map) {
    if (this.points.length === 0) return
    const start = this.points[0]
    const end = this.points[this.points.length - 1]
    const startEl = createEdgeMarkerElement(startIconUrl, 'track-marker-start')
    const endEl = createEdgeMarkerElement(endIconUrl, 'track-marker-end')
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
      if (map.getLayer(ref.layerId)) map.removeLayer(ref.layerId)
      if (map.getSource(ref.sourceId)) map.removeSource(ref.sourceId)
    }
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

  setClickCallback(map: maplibregl.Map, callback: (trackInfo: Partial<TrackInfo>) => void) {
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
      map.setPaintProperty(ref.layerId, 'line-color', '#409eff')
      map.setPaintProperty(ref.layerId, 'line-width', 6)
      map.setPaintProperty(ref.layerId, 'line-opacity', 1)
      map.moveLayer(ref.layerId)
    }
  }

  unhighlight() {
    if (!this.highlightedMapId) return

    this.mapInstances.forEach((map) => {
      const ref = this.layerByMap.get(map)
      if (ref && map.getLayer(ref.layerId)) {
        map.setPaintProperty(ref.layerId, 'line-color', this.lineColor ?? getDefaultLineColor(true))
        map.setPaintProperty(ref.layerId, 'line-width', 3)
        map.setPaintProperty(ref.layerId, 'line-opacity', 0.8)
      }
    })

    this.highlightedMapId = null
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
