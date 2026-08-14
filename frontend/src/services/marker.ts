import * as maplibregl from 'maplibre-gl'
import Supercluster from 'supercluster'
import { ElMessage } from 'element-plus'

import mapService from '@/services/map'
import { useMapStore } from '@/store/map'
import { useSchemaStore } from '@/store/schema'
import {
  MapMarkerAdapter,
  createImageMarkerIcon,
  createGroupMarkerIcon,
  createClusterIcon,
  type MarkerIcon,
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

interface ImagePointFeature {
  type: 'Feature'
  properties: { id: string }
  geometry: { type: 'Point'; coordinates: [number, number] }
}

// 兼容旧接口的簇组 shim：上层通过 getMarkerClusters() 调用 clearLayers
class ClusterGroupShim {
  private members: Set<MapMarkerAdapter> = new Set()

  addLayer(marker: MapMarkerAdapter) {
    this.members.add(marker)
  }

  removeLayer(marker: MapMarkerAdapter) {
    this.members.delete(marker)
  }

  getLayers(): MapMarkerAdapter[] {
    return Array.from(this.members)
  }

  clearLayers() {
    this.members.forEach((m) => m.remove())
    this.members.clear()
  }

  on(_event: string, _cb: (...args: any[]) => void) {
    // 聚合点击由 MarkerService 内部处理
  }
}

class MarkerService {
  private MAP_INSTANCE: maplibregl.Map | null = null
  private markers: Map<string, MapMarkerAdapter> = new Map()
  private hiddenMarkerIds: Set<string> = new Set()
  private clusterMarkers: Map<number, MapMarkerAdapter> = new Map()
  private imagePoints: ImagePointFeature[] = []
  private clusterIndex: Supercluster | null = null
  private clusterGroup: ClusterGroupShim = new ClusterGroupShim()
  // 上次渲染的单点显示状态（用于聚合/离散过渡动画）
  private lastShownImageIds: Set<string> = new Set()
  // 上次渲染时每个单点所属的 cluster 中心（imageId -> [lng, lat]）
  private lastClusterCenters: Map<string, [number, number]> = new Map()
  // 上次渲染的聚合点 id 集合（避免聚合点反复重建导致闪烁）
  private lastClusterIds: Set<number> = new Set()
  // 上次渲染的缩放级别（区分缩放导致的聚合/离散 vs 平移导致的视野变化）
  private lastZoom: number = -1

  getMarkerClusters() {
    return this.clusterGroup
  }

  initMapInstance(mapInstance: maplibregl.Map) {
    if (!mapInstance) {
      throw new Error('地图实例不能为空')
    }
    this.MAP_INSTANCE = mapInstance
    this.rebuildClusterIndex()
    this.renderClusters()
  }

  // 重建聚合索引（supercluster load 后不可变，图片增删需重建）
  private rebuildClusterIndex() {
    this.clusterIndex = new Supercluster({ radius: 50, maxZoom: 17 })
    this.clusterIndex.load(this.imagePoints as any)
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

    // 维护聚合索引
    this.imagePoints.push({
      type: 'Feature',
      properties: { id: imageInfo.id },
      geometry: {
        type: 'Point',
        coordinates: toMapLibreLngLat(imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude),
      },
    })
    this.rebuildClusterIndex()
    this.renderClusters()
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
    marker.remove()
    this.markers.delete(id)
    this.hiddenMarkerIds.delete(id)
    mapStore.deleteMarker(id)

    // 维护聚合索引
    this.imagePoints = this.imagePoints.filter((p) => p.properties.id !== id)
    this.rebuildClusterIndex()
    this.renderClusters()
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
      this.hiddenMarkerIds.add(markerId)
      this.renderClusters()
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
        this.hiddenMarkerIds.delete(markerId)
        this.renderClusters()
      } else if (isGroup) {
        if (!this.hiddenMarkerIds.has(markerId)) {
          marker.addTo(this.MAP_INSTANCE!)
        }
      }
    }
  }

  observeClisterClick() {
    // 聚合点点击由 renderClusters 里绑定的 onClusterClick 处理
  }

  // 聚合点点击 → 展开
  private onClusterClick(clusterId: number, coords: [number, number]) {
    if (!this.clusterIndex) return
    const zoom = this.clusterIndex.getClusterExpansionZoom(clusterId)
    this.MAP_INSTANCE?.easeTo({ center: coords, zoom })
  }

  // 渲染聚合：moveend 时根据当前视野决定聚合点与单点
  private renderClusters() {
    const map = this.MAP_INSTANCE
    if (!map || !this.clusterIndex) return

    // 清除当前聚合点
    this.clusterMarkers.forEach((m) => m.remove())
    this.clusterMarkers.clear()

    // 无图片点时移除所有单点
    if (this.imagePoints.length === 0) {
      this.markers.forEach((m) => m.remove())
      this.lastShownImageIds.clear()
      this.lastClusterCenters.clear()
      return
    }

    const bounds = map.getBounds()
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]
    const zoom = Math.floor(map.getZoom())
    // 缩放级别是否变化：变化时才做飞散合体动画，平移（视野变化）时直接显示/隐藏，不做动画
    const zoomChanged = zoom !== this.lastZoom

    const clusters = this.clusterIndex.getClusters(bbox, zoom)
    const visibleImageIds = new Set<string>()
    // 当前渲染中每个单点所属的 cluster 中心（imageId -> [lng, lat]）
    const currentClusterCenters = new Map<string, [number, number]>()
    // 当前渲染的聚合点 id 集合
    const currentClusterIds = new Set<number>()

    clusters.forEach((feature: any) => {
      const coords = feature.geometry.coordinates as [number, number]
      const isCluster = !!feature.properties.cluster
      if (isCluster) {
        const count = feature.properties.point_count
        const clusterId = feature.properties.cluster_id
        currentClusterIds.add(clusterId)
        const icon = createClusterIcon(count)
        const marker = new MapMarkerAdapter(icon, coords, { id: `cluster-${clusterId}`, type: 'cluster' })
        marker.addTo(map)
        marker.on('click', () => {
          this.onClusterClick(clusterId, coords)
        })
        this.clusterMarkers.set(clusterId, marker)
        // 聚合点不做弹出动画（避免拖动/缩放时从无到有的闪烁）
        // 记录该聚合点的成员（用于离散时从中心飞散）
        const leaves = this.clusterIndex.getLeaves(clusterId, Infinity, 0) as any[]
        leaves.forEach((leaf) => {
          currentClusterCenters.set(leaf.properties.id, coords)
        })
      } else {
        const id = feature.properties.id as string
        if (!this.hiddenMarkerIds.has(id)) {
          visibleImageIds.add(id)
        }
      }
    })

    // 图片单点过渡：聚合时飞向 cluster 中心，离散时从中心飞散
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t !== 'image' && t !== 'temporary-image') return

      const shouldShow = visibleImageIds.has(m.options.id)
      const wasShown = this.lastShownImageIds.has(m.options.id)
      const latlng = m.getLatLng()

      if (shouldShow && !wasShown) {
        // 离散：缩放时从 cluster 中心飞散到单点位置，平移时直接显示
        if (zoomChanged) {
          const from = this.lastClusterCenters.get(m.options.id)
          if (from) {
            this.animateFlyIn(m, from, [latlng.lng, latlng.lat])
          } else {
            m.addTo(map)
          }
        } else {
          m.addTo(map)
        }
      } else if (!shouldShow && wasShown) {
        // 聚合：缩放时飞向 cluster 中心缩小，平移时直接移除
        if (zoomChanged) {
          const to = currentClusterCenters.get(m.options.id)
          if (to) {
            this.animateFlyOut(m, [latlng.lng, latlng.lat], to)
          } else {
            m.remove()
          }
        } else {
          m.remove()
        }
      } else if (shouldShow && wasShown) {
        if (!this.isMarkerOnMap(m)) {
          m.addTo(map)
        }
      }
    })

    // 重新显示非聚合的分组 marker（分组不参与聚合）
    this.markers.forEach((m) => {
      if (m.options.type === 'group' && !this.hiddenMarkerIds.has(m.options.id)) {
        if (!this.isMarkerOnMap(m)) {
          m.addTo(map)
        }
      }
    })

    // 更新上次状态
    this.lastShownImageIds = new Set(visibleImageIds)
    this.lastClusterCenters.clear()
    currentClusterCenters.forEach((center, id) => {
      this.lastClusterCenters.set(id, center)
    })
    this.lastClusterIds = currentClusterIds
    this.lastZoom = zoom
  }

  // 聚合动画：单点飞向 cluster 中心，缩小淡出
  private animateFlyOut(marker: MapMarkerAdapter, fromLngLat: [number, number], toLngLat: [number, number]) {
    const map = this.MAP_INSTANCE
    if (!map) {
      marker.remove()
      return
    }
    const el = marker.getElement()
    const from = map.project(fromLngLat)
    const to = map.project(toLngLat)

    // 从 MapLibre 脱离，手动 append 到 canvas 容器控制 transform
    marker.remove()
    map.getCanvasContainer().appendChild(el)
    el.style.zIndex = '1000'

    const anim = el.animate(
      [
        { transform: `translate(-50%, -100%) translate(${from.x}px, ${from.y}px)` },
        { transform: `translate(-50%, -100%) translate(${to.x}px, ${to.y}px) scale(0.3)` },
      ],
      { duration: 260, easing: 'ease-in' }
    )
    anim.onfinish = () => {
      el.remove()
    }
  }

  // 离散动画：单点从 cluster 中心飞散到各自位置，放大出现
  private animateFlyIn(marker: MapMarkerAdapter, fromLngLat: [number, number], toLngLat: [number, number]) {
    const map = this.MAP_INSTANCE
    if (!map) {
      marker.addTo(map!)
      return
    }
    const el = marker.getElement()
    const inner = marker.getInnerElement()
    const from = map.project(fromLngLat)
    const to = map.project(toLngLat)

    // 从 MapLibre 脱离，手动控制 transform
    marker.remove()
    map.getCanvasContainer().appendChild(el)
    el.style.zIndex = '1000'
    inner.style.transform = 'scale(0.3)'

    const anim = el.animate(
      [
        { transform: `translate(-50%, -100%) translate(${from.x}px, ${from.y}px)` },
        { transform: `translate(-50%, -100%) translate(${to.x}px, ${to.y}px)` },
      ],
      { duration: 260, easing: 'ease-out' }
    )
    anim.onfinish = () => {
      inner.style.transform = 'scale(1)'
      // 交还给 MapLibre 定位
      marker.addTo(map)
    }
  }

  private isMarkerOnMap(marker: MapMarkerAdapter): boolean {
    const el = marker.getElement()
    return !!el && !!el.parentNode
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
    return this.hiddenMarkerIds.has(marker.options.id)
  }

  // moveend 时触发（由 map.ts 防抖调用）
  updateVisibleMarkers() {
    this.renderClusters()
    // 视口内的单点图片 marker 加载缩略图
    const mapStore = useMapStore()
    const visibleMarkerIdList = mapStore.getVisibleMarkerIdList
    this.clusterMarkers.forEach((_m, clusterId) => {
      // 聚合点不加载缩略图
    })
    mapStore.getMarkerIdList.forEach((markerId: string) => {
      const marker = this.getMarkerById(markerId)
      if (marker && marker.options.type === 'image' && this.isMarkerInView(marker)) {
        if (!visibleMarkerIdList.includes(markerId)) {
          this.updateImageMarker(marker)
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
    // 分组封面更新逻辑保持惰性
  }

  isMarkerInView(marker: MapMarkerAdapter) {
    if (!marker || !this.MAP_INSTANCE) return false
    const bounds = this.MAP_INSTANCE.getBounds()
    const { lat, lng } = marker.getLatLng()
    return bounds.contains([lng, lat])
  }

  markerMouseListener(marker: MapMarkerAdapter) {
    if (!marker) return
    marker.on('click', (event: any) => {
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
    const el = marker.getInnerElement()
    if (el) {
      el.style.transform = `scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`
    }
  }

  resetMarker(marker: MapMarkerAdapter) {
    const el = marker.getInnerElement()
    if (el) {
      el.style.transform = `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`
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
