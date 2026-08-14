import * as maplibregl from 'maplibre-gl'
import { ElMessage } from 'element-plus'

import mapService from '@/services/map'
import { useMapStore } from '@/store/map'
import { useSchemaStore } from '@/store/schema'
import {
  MapMarkerAdapter,
  createImageMarkerIcon,
  createGroupMarkerIcon,
} from '@/services/markerAdapter'
import IconHTMLFactory, { IconType } from '@/utils/iconHTML'
import { getImageUrl, getMarkerImageUrlById } from '@/utils/Image'
import { judgeHadUploadImage } from '@/utils/schema'
import { getGroupIdsByImageId, getGroupInfoByGroupId } from '@/utils/group'
import eventBus from '@/utils/eventBus'
import { GPSInfoLegality } from '@/utils/map'
import { toMapLibreLngLat } from '@/utils/mapLibre'
import { MARKER_CONSTANT } from '@/utils/constant'
import type { IImageInfo, INewGroupFormData, IGroupInfo, IGPSInfo } from '@/type/schema'

class ClusterGroupShim {
  private clusterMembers: Set<MapMarkerAdapter> = new Set()
  private map: maplibregl.Map | null = null

  constructor(map: maplibregl.Map | null) {
    this.map = map
  }

  addLayer(marker: MapMarkerAdapter) {
    this.clusterMembers.add(marker)
    if (this.map && !this.isOnMap(marker)) {
      marker.addTo(this.map)
    }
  }

  removeLayer(marker: MapMarkerAdapter) {
    this.clusterMembers.delete(marker)
    marker.remove()
  }

  getLayers(): MapMarkerAdapter[] {
    return Array.from(this.clusterMembers)
  }

  clearLayers() {
    this.clusterMembers.forEach((m) => m.remove())
    this.clusterMembers.clear()
  }

  on(_event: string, _cb: (...args: any[]) => void) {
    // 阶段 2 无聚合，无 clusterclick 事件；阶段 3 重写
  }

  isOnMap(marker: MapMarkerAdapter): boolean {
    const el = marker.getElement()
    return !!el && !!el.parentNode
  }
}

class MarkerService {
  private MAP_INSTANCE: maplibregl.Map | null = null
  private markers: Map<string, MapMarkerAdapter> = new Map()
  private hiddenMarkerIds: Set<string> = new Set()
  private clusterGroup: ClusterGroupShim = new ClusterGroupShim(null)

  getMarkerClusters() {
    return this.clusterGroup
  }

  initMapInstance(mapInstance: maplibregl.Map) {
    if (!mapInstance) {
      throw new Error('地图实例不能为空')
    }
    this.MAP_INSTANCE = mapInstance
    this.clusterGroup = new ClusterGroupShim(mapInstance)
  }

  getMarkerById(markerId: string): MapMarkerAdapter {
    return this.markers.get(markerId)!
  }

  getGPSInfoByMarkerInstance(marker: MapMarkerAdapter): IGPSInfo {
    if (!marker) {
      ElMessage.error('没有传入marker实例')
      return { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 }
    }
    const { lat, lng } = marker.getLatLng()
    return { GPSLatitude: lat, GPSLongitude: lng, GPSAltitude: 0 }
  }

  addImageMarkerToMap(imageInfo: IImageInfo) {
    const mapStore = useMapStore()
    if (!imageInfo.GPSInfo.GPSLatitude || !imageInfo.GPSInfo.GPSLongitude) return
    const existing = this.markers.get(imageInfo.id)
    if (existing) {
      existing.setIcon(createImageMarkerIcon(imageInfo, getImageUrl(imageInfo.id) ?? imageInfo.url))
      return
    }
    const icon = createImageMarkerIcon(imageInfo, getImageUrl(imageInfo.id) ?? imageInfo.url)
    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude),
      { id: imageInfo.id, type: 'image', iconUrl: icon.iconUrl }
    )
    this.markers.set(imageInfo.id, marker)
    this.clusterGroup.addLayer(marker)
    this.markerMouseListener(marker)
    mapStore.addMarkerId(imageInfo.id)
  }

  async addGroupMarkerToMap(groupInfo: IGroupInfo) {
    if (!GPSInfoLegality(groupInfo.GPSInfo)) return
    const mapStore = useMapStore()
    const icon = await createGroupMarkerIcon(groupInfo)
    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(groupInfo.GPSInfo.GPSLatitude, groupInfo.GPSInfo.GPSLongitude),
      { id: groupInfo.id, type: 'group' }
    )
    this.markers.set(groupInfo.id, marker)
    if (groupInfo.visible === false) {
      this.hiddenMarkerIds.add(groupInfo.id)
    } else {
      marker.addTo(this.MAP_INSTANCE!)
    }
    this.markerMouseListener(marker)
    mapStore.addMarkerId(groupInfo.id)
  }

  addExistImageMarkerToMapById(imageId: string) {
    const schemaStore = useSchemaStore()
    const mapStore = useMapStore()
    if (!mapStore.visibleMarkerIdList.includes(imageId)) {
      const imageInfo = schemaStore.getSchema.imageInfo?.filter((item: IImageInfo) => item.id === imageId)[0]
      if (imageInfo) {
        this.addImageMarkerToMap(imageInfo)
      }
      this.addVisibleMarkerById(imageId)
    } else {
      this.showMarkerById(imageId)
    }
  }

  addManualLocateImageMarkerToMap(imageInfo: IImageInfo, lat?: number, lng?: number) {
    const existing = this.getMarkerById(imageInfo.id)
    if (existing) {
      this.setViewByMarkerId(imageInfo.id)
      ElMessage.warning('节点已存在！，请编辑已有节点')
      return
    }
    const map = this.MAP_INSTANCE!
    const icon = createImageMarkerIcon(imageInfo, getImageUrl(imageInfo.id) ?? imageInfo.url)
    const center = map.getCenter()
    const markerLatLng: [number, number] = lat && lng
      ? toMapLibreLngLat(lat, lng)
      : [center.lng, center.lat]
    const marker = new MapMarkerAdapter(icon, markerLatLng, {
      id: imageInfo.id,
      type: 'temporary-image',
      draggable: true,
    })
    this.markers.set(imageInfo.id, marker)
    marker.addTo(map)
    this.markerMouseListener(marker)
    return marker
  }

  async addManualLocateGroupMarkerToMap(groupInfo: INewGroupFormData, lat?: number, lng?: number) {
    const existing = this.getMarkerById(groupInfo.id)
    if (existing) {
      this.setViewByMarkerId(groupInfo.id)
      ElMessage.warning('节点已存在！，请编辑已有节点')
      return
    }
    const map = this.MAP_INSTANCE!
    const icon = await createGroupMarkerIcon(groupInfo)
    const center = map.getCenter()
    const markerLatLng: [number, number] = lat && lng
      ? toMapLibreLngLat(lat, lng)
      : [center.lng, center.lat]
    const marker = new MapMarkerAdapter(icon, markerLatLng, {
      id: groupInfo.id,
      type: 'temporary-group',
      draggable: true,
    })
    this.markers.set(groupInfo.id, marker)
    marker.addTo(map)
    this.markerMouseListener(marker)
    return marker
  }

  deleteMarkerInMap(marker: MapMarkerAdapter) {
    const mapStore = useMapStore()
    if (!marker) return
    const id = marker.options.id
    this.clusterGroup.removeLayer(marker)
    marker.remove()
    this.markers.delete(id)
    this.hiddenMarkerIds.delete(id)
    mapStore.deleteMarker(id)
  }

  deleteMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId)
    if (marker) this.deleteMarkerInMap(marker)
  }

  hiddenMarkerById(markerId: string, hiddenGroupMarker: boolean = true) {
    const marker = this.getMarkerById(markerId)
    if (!marker) {
      console.warn('Marker not found when hiding:', markerId)
      return
    }
    const markerType = marker.options.type
    const isImage = markerType === 'image' || markerType === 'temporary-image'
    const isGroup = markerType === 'group' || markerType === 'temporary-group'
    if (isImage) {
      this.clusterGroup.removeLayer(marker)
      this.hiddenMarkerIds.add(markerId)
    } else if (isGroup && hiddenGroupMarker) {
      marker.remove()
      this.hiddenMarkerIds.add(markerId)
    }
  }

  showMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId)
    if (marker) {
      const markerType = marker.options.type
      const isImage = markerType === 'image' || markerType === 'temporary-image'
      const isGroup = markerType === 'group' || markerType === 'temporary-group'
      if (isImage) {
        const layers = this.clusterGroup.getLayers()
        if (!layers.includes(marker)) {
          this.clusterGroup.addLayer(marker)
          this.hiddenMarkerIds.delete(markerId)
        }
      } else if (isGroup) {
        if (!this.hiddenMarkerIds.has(markerId)) {
          marker.addTo(this.MAP_INSTANCE!)
        }
      }
    }
  }

  observeClisterClick() {
    // 阶段 2 无聚合；阶段 3 重写为 cluster click → expansion zoom
  }

  setViewByMarkerId(id: string) {
    if (!id) return
    let marker = this.getMarkerById(id)
    if (!marker) {
      const groupId = getGroupIdsByImageId(id)?.[0]
      groupId && (marker = this.getMarkerById(groupId))
    }
    if (!marker) return
    const { lat, lng } = marker.getLatLng()
    mapService.setViewByLatLng(lat, lng)
  }

  addVisibleMarkerById(markerId: string) {
    const mapStore = useMapStore()
    mapStore.addVisibleMarkerId(markerId)
    const marker = this.getMarkerById(markerId)
    this.markerMouseListener(marker)
  }

  isMarkerInCluster(marker: MapMarkerAdapter): boolean {
    const layers = this.clusterGroup.getLayers()
    return layers.includes(marker) && this.hiddenMarkerIds.has(marker.options.id)
  }

  updateVisibleMarkers() {
    const mapStore = useMapStore()
    const visibleMarkerIdList = mapStore.getVisibleMarkerIdList
    mapStore.getMarkerIdList.forEach((markerId: string) => {
      const marker = this.getMarkerById(markerId)
      if (marker && this.isMarkerInView(marker)) {
        if (!visibleMarkerIdList.includes(markerId)) {
          if (marker.options.type === 'image') {
            this.updateImageMarker(marker)
          }
          if (marker.options.type === 'group') {
            this.updateGroupMarker(marker)
          }
          this.addVisibleMarkerById(markerId)
        }
      }
    })
  }

  async updateImageMarker(marker: MapMarkerAdapter) {
    const mapStore = useMapStore()
    const index = mapStore.getVisibleMarkerIdList.findIndex(
      (markerId: string) => markerId === marker.options.id
    )
    const isInSchema = judgeHadUploadImage(marker.options.id)
    if (index === -1 && marker.options.iconUrl) return
    if (index === -1 && isInSchema) {
      const fileUrl = await getMarkerImageUrlById(marker.options.id)
      if (!fileUrl || fileUrl === '') {
        mapStore.deleteVisbleMarkerId(marker.options.id)
        return
      }
      marker.setIcon({
        element: IconHTMLFactory.createIcon(IconType.SingleImage, fileUrl),
        iconUrl: fileUrl,
      })
    }
  }

  updateGroupMarker(_marker: MapMarkerAdapter) {
    // 分组封面更新逻辑保持惰性，阶段 4 回归时确认
  }

  isMarkerInView(marker: MapMarkerAdapter) {
    if (!marker || !this.MAP_INSTANCE) return false
    const bounds = this.MAP_INSTANCE.getBounds()
    const { lat, lng } = marker.getLatLng()
    return bounds.contains([lng, lat])
  }

  markerMouseListener(marker: MapMarkerAdapter) {
    if (!marker) return
    marker.on('click', (event: MouseEvent) => {
      eventBus.emit('show-image-data', event)
    })
    marker.on('contextmenu', (event: MouseEvent) => {
      eventBus.emit('show-content-menu', event)
    })
    marker.on('mouseover', () => {
      this.highlightMarker(marker)
    })
    marker.on('mouseout', () => {
      this.resetMarker(marker)
    })
  }

  highlightMarker(marker: MapMarkerAdapter) {
    const el = marker.getElement()
    if (el) {
      const old = el.style.transform
      const next = old.includes('scale')
        ? old.replace(/scale\([^)]*\)/, `scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`).trim()
        : `${old} scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`
      el.style.transform = next
    }
  }

  resetMarker(marker: MapMarkerAdapter) {
    const el = marker.getElement()
    if (el) {
      el.style.transform = el.style.transform
        .replace(/scale\([^)]*\)/, `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`)
        .trim()
    }
  }

  async resetIconGroupMarker(groupId: string) {
    const groupMarker = this.getMarkerById(groupId)
    const groupInfo = getGroupInfoByGroupId(groupId)
    const newIcon = await createGroupMarkerIcon(groupInfo)
    groupMarker && groupMarker.setIcon(newIcon)
  }

  filterMarkersByTimeRange(timeRange: { min: number; max: number }) {
    const schemaStore = useSchemaStore()
    this.markers.forEach((marker) => {
      const markerId = marker.options.id
      const markerType = marker.options.type
      const isImage = markerType === 'image' || markerType === 'temporary-image'
      if (isImage) {
        const imageInfo = schemaStore.getSchema.imageInfo?.find((img) => img.id === markerId)
        const imageTime = imageInfo?.authorInfo?.DateTime
        if (imageTime && typeof imageTime === 'number' && !isNaN(imageTime)) {
          if (imageTime >= timeRange.min && imageTime <= timeRange.max) {
            this.showMarkerById(markerId)
          } else {
            this.hiddenMarkerById(markerId, false)
          }
        } else {
          this.showMarkerById(markerId)
        }
      }
    })
  }

  getPermanentType(markerType: string) {
    return markerType.replace('temporary-', '')
  }

  getTemporaryType(markerType: string) {
    if (markerType.includes('temporary-')) return markerType
    return `temporary-${markerType}`
  }

  getGPSInfoById(markerId: string) {
    const marker = this.getMarkerById(markerId)
    return marker ? this.getGPSInfoByMarkerInstance(marker) : { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 }
  }

  scaleMarkerByMap() {
    // MapLibre marker 缩放动效由 hover 的 transform 处理，保留空实现
  }
}

const markerService = new MarkerService()

export default markerService
