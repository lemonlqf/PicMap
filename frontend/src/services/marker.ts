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
  // 上次渲染的 cluster marker 引用（用于合并时做飞出动画）
  private lastClusterMarkers: Map<number, MapMarkerAdapter> = new Map()
  // 上次渲染的 cluster 中心（clusterId -> [lng, lat]）
  private lastClusterCentersById: Map<number, [number, number]> = new Map()
  // 索引是否需要重建（批量添加图片后统一重建，避免逐张 rebuild 导致动画混乱）
  private clusterDirty = false
  // 进行中的飞行动画（地图移动时打断，避免错位）
  private animatingMarkers: Set<MapMarkerAdapter> = new Set()
  // 时间轴筛选范围（null 表示不筛选，重建聚合索引时按此过滤图片点）
  private timeRange: { min: number; max: number } | null = null

  getMarkerClusters() {
    return this.clusterGroup
  }

  // 取消所有进行中的飞行动画（地图移动时打断，直接跳到终点状态，避免错位）
  cancelAllFlyAnimations() {
    this.animatingMarkers.forEach((m) => m.finishAnimation())
    this.animatingMarkers.clear()
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
    this.clusterIndex = new Supercluster({ radius: 30, maxZoom: 17 })
    this.clusterIndex.load(this.getFilteredPoints() as any)
    // 索引重建后 cluster id 全部重新分配，清空旧状态避免 getChildren 报错
    this.lastClusterIds.clear()
    this.lastClusterCentersById.clear()
    this.lastClusterMarkers.clear()
    this.lastClusterCenters.clear()
    this.lastShownImageIds.clear()
  }

  // 按时间轴筛选范围过滤图片点（无时间信息的图片始终保留）
  private getFilteredPoints(): ImagePointFeature[] {
    if (!this.timeRange) return this.imagePoints
    const schemaStore = useSchemaStore()
    const imageInfo = schemaStore.getSchema.imageInfo ?? []
    const timeMap = new Map<string, number>()
    imageInfo.forEach((img) => {
      const t = img.authorInfo?.DateTime
      if (t && typeof t === 'number' && !isNaN(t)) {
        timeMap.set(img.id, t)
      }
    })
    return this.imagePoints.filter((p) => {
      const t = timeMap.get(p.properties.id)
      if (t === undefined) return true
      return t >= this.timeRange!.min && t <= this.timeRange!.max
    })
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

    // 维护聚合索引（标记脏，批量添加后统一重建，避免逐张 rebuild 导致动画混乱）
    this.imagePoints.push({
      type: 'Feature',
      properties: { id: imageInfo.id },
      geometry: {
        type: 'Point',
        coordinates: toMapLibreLngLat(imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude),
      },
    })
    this.clusterDirty = true
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
    if (!map) return

    // 批量添加图片后统一重建索引
    if (this.clusterDirty || !this.clusterIndex) {
      this.rebuildClusterIndex()
      this.clusterDirty = false
    }
    if (!this.clusterIndex) return

    // 保存上次的 cluster marker 引用与中心（用于合并/分裂动画）
    this.lastClusterMarkers.clear()
    this.lastClusterCentersById.clear()
    this.clusterMarkers.forEach((marker, id) => {
      this.lastClusterMarkers.set(id, marker)
      const ll = marker.getLatLng()
      this.lastClusterCentersById.set(id, [ll.lng, ll.lat])
    })

    // 清除当前聚合点
    this.clusterMarkers.clear()

    // 无图片点时移除所有单点
    if (this.imagePoints.length === 0) {
      this.lastClusterMarkers.forEach((m) => m.remove())
      this.lastClusterMarkers.clear()
      this.markers.forEach((m) => m.remove())
      this.lastShownImageIds.clear()
      this.lastClusterCenters.clear()
      this.lastClusterIds.clear()
      this.lastClusterCentersById.clear()
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
    const zoomChanged = zoom !== this.lastZoom

    const clusters = this.clusterIndex.getClusters(bbox, zoom)
    const visibleImageIds = new Set<string>()
    const currentClusterCenters = new Map<string, [number, number]>()
    const currentClusterIds = new Set<number>()

    // 收集当前 cluster 信息
    clusters.forEach((feature: any) => {
      if (feature.properties.cluster) {
        currentClusterIds.add(feature.properties.cluster_id)
      } else {
        const id = feature.properties.id as string
        if (!this.hiddenMarkerIds.has(id)) {
          visibleImageIds.add(id)
        }
      }
    })

    // 合并动画（zoom out）：上次的小 cluster 合并成当前大 cluster，小 cluster 飞向大 cluster 中心
    if (zoomChanged) {
      clusters.forEach((feature: any) => {
        if (!feature.properties.cluster) return
        const parentId = feature.properties.cluster_id
        const parentCenter = feature.geometry.coordinates as [number, number]
        if (this.lastClusterIds.has(parentId)) return
        let children: any[]
        try {
          children = this.clusterIndex.getChildren(parentId) as any[]
        } catch {
          return
        }
        children.forEach((child) => {
          if (!child.properties.cluster) return
          const childId = child.properties.cluster_id
          const oldMarker = this.lastClusterMarkers.get(childId)
          if (oldMarker) {
            // 起点用当前 zoom 下子 cluster 的投影，与终点父 cluster 投影同参考系，轨迹为平移
            const childCoords = child.geometry.coordinates as [number, number]
            const fromScreen = map.project(childCoords)
            const toScreen = map.project(parentCenter)
            this.animateFlyOutToScreen(oldMarker, fromScreen, toScreen)
            this.lastClusterMarkers.delete(childId)
          }
        })
      })
    }

    // 渲染当前 cluster
    clusters.forEach((feature: any) => {
      const coords = feature.geometry.coordinates as [number, number]
      if (!feature.properties.cluster) return
      const clusterId = feature.properties.cluster_id
      const count = feature.properties.point_count
      const icon = createClusterIcon(count)
      const marker = new MapMarkerAdapter(icon, coords, { id: `cluster-${clusterId}`, type: 'cluster' })
      marker.addTo(map)
      marker.on('click', () => {
        this.onClusterClick(clusterId, coords)
      })
      this.clusterMarkers.set(clusterId, marker)

      // 分裂动画（zoom in）：新 cluster 从父 cluster 中心飞入
      if (zoomChanged && !this.lastClusterIds.has(clusterId)) {
        const parentCenter = this.findParentClusterCenter(clusterId)
        if (parentCenter) {
          this.animateFlyInToScreen(marker, map.project(parentCenter), map.project(coords))
        }
      }

      // 记录成员（用于单点离散时从中心飞散）
      const leaves = this.clusterIndex.getLeaves(clusterId, Infinity, 0) as any[]
      leaves.forEach((leaf) => {
        currentClusterCenters.set(leaf.properties.id, coords)
      })
    })

    // 移除残留的上次 cluster marker（未参与合并动画的）
    this.lastClusterMarkers.forEach((m) => {
      m.remove()
    })
    this.lastClusterMarkers.clear()

    // 图片单点过渡：聚合时飞向 cluster 中心，离散时从中心飞散
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t !== 'image' && t !== 'temporary-image') return
      // 跳过动画中的 marker，避免连续缩放时状态冲突
      if (m.animating) return

      const shouldShow = visibleImageIds.has(m.options.id)
      const wasShown = this.lastShownImageIds.has(m.options.id)
      const latlng = m.getLatLng()

      if (shouldShow && !wasShown) {
        if (zoomChanged) {
          const fromLngLat = this.lastClusterCenters.get(m.options.id)
          const fromScreen = fromLngLat ? map.project(fromLngLat) : undefined
          const toScreen = map.project([latlng.lng, latlng.lat])
          if (fromScreen) {
            this.animateFlyInToScreen(m, fromScreen, toScreen)
          } else {
            m.addTo(map)
          }
        } else {
          m.addTo(map)
        }
      } else if (!shouldShow && wasShown) {
        if (zoomChanged) {
          const toLngLat = currentClusterCenters.get(m.options.id)
          if (toLngLat) {
            // 起点用当前 zoom 下的单点投影，与终点 cluster 中心投影同参考系，轨迹为平移
            const fromScreen = map.project([latlng.lng, latlng.lat])
            const toScreen = map.project(toLngLat)
            this.animateFlyOutToScreen(m, fromScreen, toScreen)
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

  // 查找 cluster 的父 cluster 中心（分裂动画时子 cluster 从父中心飞入）
  private findParentClusterCenter(clusterId: number): [number, number] | undefined {
    for (const [parentId, parentCenter] of this.lastClusterCentersById) {
      if (parentId === clusterId) continue
      let children: any[]
      try {
        children = this.clusterIndex!.getChildren(parentId) as any[]
      } catch {
        continue
      }
      for (const child of children) {
        if (child.properties.cluster && child.properties.cluster_id === clusterId) {
          return parentCenter
        }
      }
    }
    return undefined
  }

  // 聚合动画：单点从旧屏幕位置飞向 cluster 中心（新屏幕位置），不缩小，渐变消失
  private animateFlyOutToScreen(marker: MapMarkerAdapter, fromScreen: { x: number; y: number }, toScreen: { x: number; y: number }) {
    const map = this.MAP_INSTANCE
    if (!map) {
      marker.remove()
      return
    }
    const el = marker.getElement()

    // 从 MapLibre 脱离，手动 append 到 canvas 容器控制 transform
    marker.remove()
    map.getCanvasContainer().appendChild(el)
    el.style.zIndex = '1000'

    marker.runFlyAnimation(
      el,
      [
        { transform: `translate(-50%, -100%) translate(${fromScreen.x}px, ${fromScreen.y}px)`, opacity: '1' },
        { transform: `translate(-50%, -100%) translate(${toScreen.x}px, ${toScreen.y}px)`, opacity: '0' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
      () => {
        this.animatingMarkers.delete(marker)
        el.remove()
      }
    )
    this.animatingMarkers.add(marker)
  }

  // 离散动画：单点从 cluster 中心（旧屏幕位置）飞散到单点位置（新屏幕位置），不缩小，逐渐淡入
  private animateFlyInToScreen(marker: MapMarkerAdapter, fromScreen: { x: number; y: number }, toScreen: { x: number; y: number }) {
    const map = this.MAP_INSTANCE
    if (!map) {
      marker.addTo(map!)
      return
    }
    const el = marker.getElement()

    // 从 MapLibre 脱离，手动控制 transform
    marker.remove()
    map.getCanvasContainer().appendChild(el)
    el.style.zIndex = '1000'

    marker.runFlyAnimation(
      el,
      [
        { transform: `translate(-50%, -100%) translate(${fromScreen.x}px, ${fromScreen.y}px) scale(1)`, opacity: '0' },
        { transform: `translate(-50%, -100%) translate(${toScreen.x}px, ${toScreen.y}px) scale(1)`, opacity: '1' },
      ],
      { duration: 300, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
      () => {
        this.animatingMarkers.delete(marker)
        el.style.opacity = '1'
        // 交还给 MapLibre 定位
        marker.addTo(map)
      }
    )
    this.animatingMarkers.add(marker)
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
    // 悬浮时置顶，避免被其他节点遮挡
    marker.setZIndexOffset(1000)
  }

  resetMarker(marker: MapMarkerAdapter) {
    const el = marker.getInnerElement()
    if (el) {
      el.style.transform = `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`
    }
    marker.setZIndexOffset(0)
  }

  async resetIconGroupMarker(groupId: string) {
    const groupMarker = this.getMarkerById(groupId)
    const groupInfo = getGroupInfoByGroupId(groupId)
    const newIcon = await createGroupMarkerIcon(groupInfo)
    groupMarker && groupMarker.setIcon(newIcon)
  }

  filterMarkersByTimeRange(timeRange: { min: number; max: number }) {
    // 重建聚合索引（只包含时间范围内的图片点），使 cluster 数量与成员跟随筛选
    this.timeRange = timeRange
    // 先移除所有单点图片 marker，renderClusters 会重新添加时间范围内的
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t === 'image' || t === 'temporary-image') {
        m.remove()
      }
    })
    this.rebuildClusterIndex()
    this.renderClusters()
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
