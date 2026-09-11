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
  createVideoMarkerIcon,
  Easing,
  type MarkerIcon,
  type FlyAnimationOptions,
} from '@/services/markerAdapter'
import IconHTMLFactory, { IconType } from '@/utils/iconHTML'
import { getImageUrl, getMarkerImageUrlById } from '@/utils/Image'
import { getVideoThumbnailUrl } from '@/utils/video'
import { judgeHadUploadImage, getSchemaInfoById, getVideoInfoById } from '@/utils/schema'
import { getGroupIdsByImageId, getGroupInfoByGroupId } from '@/utils/group'
import eventBus from '@/utils/eventBus'
import { GPSInfoLegality } from '@/utils/map'
import { toMapLibreLngLat } from '@/utils/mapLibre'
import { MARKER_CONSTANT, MARKER_OVERLAP_THRESHOLD } from '@/utils/constant'
import { useSelectStore } from '@/store/select'
import type { IImageInfo, INewGroupFormData, IGroupInfo, IGPSInfo, IVideoInfo } from '@/type/schema'

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
  // clusterId -> 叶子图片 id 缓存，避免重复 getLeaves（getLeaves 是递归遍历，开销大）
  private clusterLeafCache: Map<number, string[]> = new Map()
  // 进行中的飞行动画（地图移动时打断，避免错位）
  private animatingMarkers: Set<MapMarkerAdapter> = new Set()
  // 聚合/合并过渡配置：节点从各自位置飞向 cluster 中心，逐渐变透明（40% 时已全透明）
  private clusterMergeOptions: FlyAnimationOptions = {
    duration: 300,
    easing: Easing.easeInOutCubic,
    fade: true,
    fadeFrom: 1,
    fadeTo: 0,
    fadeEasing: Easing.fadeOutAt40,
  }
  // 散开/分裂过渡配置：节点从 cluster 中心飞出到各自位置，由透明变为不透明
  private clusterSplitOptions: FlyAnimationOptions = {
    duration: 300,
    easing: Easing.easeInOutCubic,
    fade: true,
    fadeFrom: 0,
    fadeTo: 1,
    fadeEasing: Easing.fadeInFrom20,
  }
  // 时间轴筛选范围（null 表示不筛选，重建聚合索引时按此过滤图片点）
  private timeRange: { min: number; max: number } | null = null
  // spiderfy 展开状态：记录被展开的 marker 及其原始坐标
  private spiderfiedMarkers: { marker: MapMarkerAdapter; original: [number, number] }[] = []
  // 刚触发展开的标志，避免紧随的 map click 立即收回
  private spiderfyJustTriggered = false
  // 视频封面正在做带重试加载的节点 id（避免拖动过程中并发重复加载）
  private videoCoverLoading: Set<string> = new Set()

  getMarkerClusters() {
    return this.clusterGroup
  }

  // 配置聚合/散开过渡动画（速度、缓动、透明度等），供外部自由调整
  // type 指定动画方向：'merge' 聚合（变透明）、'split' 散开（变不透明）、'all' 两者
  setClusterTransitionOptions(options: Partial<FlyAnimationOptions>, type: 'merge' | 'split' | 'all' = 'all') {
    if (type === 'merge' || type === 'all') {
      this.clusterMergeOptions = { ...this.clusterMergeOptions, ...options }
    }
    if (type === 'split' || type === 'all') {
      this.clusterSplitOptions = { ...this.clusterSplitOptions, ...options }
    }
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
    // 点击地图空白处收回 spiderfy 展开的标记（marker 点击已 preventDefault，此处跳过）
    mapInstance.on('click', (e: any) => {
      if (this.spiderfyJustTriggered) return
      if (e?.originalEvent?.defaultPrevented || e?.defaultPrevented) return
      this.unspiderfy()
    })
  }

  // 清空所有 marker 与聚合状态（切换用户时调用，重新加载当前用户数据）
  reset() {
    this.cancelAllFlyAnimations()
    this.unspiderfy()
    this.markers.forEach((m) => m.remove())
    this.markers.clear()
    this.clusterMarkers.forEach((m) => m.remove())
    this.clusterMarkers.clear()
    this.clusterGroup.clearLayers()
    this.hiddenMarkerIds.clear()
    this.imagePoints = []
    this.clusterIndex = null
    this.lastShownImageIds.clear()
    this.lastClusterCenters.clear()
    this.lastClusterIds.clear()
    this.lastClusterMarkers.clear()
    this.lastClusterCentersById.clear()
    this.lastZoom = -1
    this.timeRange = null
    this.clusterDirty = false
    this.clusterLeafCache.clear()
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
    this.clusterLeafCache.clear()
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

  // 返回所有 marker（含单点图片、分组、聚合点），用于框选命中检测
  getAllMarkers(): MapMarkerAdapter[] {
    return [...Array.from(this.markers.values()), ...Array.from(this.clusterMarkers.values())]
  }

  /**
   * 展开聚合点，返回其叶子（成员图片）id 列表。
   * 若 marker 非聚合点（image/group），返回 [id]。
   * cluster 叶子 id 有缓存，避免重复 getLeaves（递归遍历开销大）。
   */
  getMarkerLeafIds(marker: MapMarkerAdapter): string[] {
    const type = marker.options.type
    if (type === 'cluster') {
      const id = marker.options.id
      const clusterId = Number(id.replace('cluster-', ''))
      if (isNaN(clusterId) || !this.clusterIndex) return []
      // 优先读缓存
      const cached = this.clusterLeafCache.get(clusterId)
      if (cached) return cached
      const leaves = this.clusterIndex.getLeaves(clusterId, Infinity, 0) as any[]
      const leafIds = leaves.map((leaf) => leaf.properties.id as string)
      this.clusterLeafCache.set(clusterId, leafIds)
      return leafIds
    }
    // 单点图片 / 分组 / 临时节点：本身就是叶子
    return [marker.options.id]
  }

  // 根据选中集刷新单个 marker 的选中态样式
  applySelectionState(marker: MapMarkerAdapter) {
    if (!marker) return
    const selectStore = useSelectStore()
    const el = marker.getElement()
    if (!el) return

    const type = marker.options.type
    if (type === 'cluster') {
      const leafIds = this.getMarkerLeafIds(marker)
      const selected = leafIds.filter((id) => selectStore.isSelected(id))
      el.classList.remove('pm-selected', 'pm-selected-partial')
      if (selected.length > 0 && selected.length === leafIds.length) {
        el.classList.add('pm-selected')
      } else if (selected.length > 0) {
        el.classList.add('pm-selected-partial')
      }
    } else {
      const isSelected = selectStore.isSelected(marker.options.id)
      el.classList.toggle('pm-selected', isSelected)
      el.classList.remove('pm-selected-partial')
    }
  }

  // 按选中集刷新所有 marker 的选中态（框选结束 / 删除后调用）
  refreshSelection() {
    this.markers.forEach((m) => this.applySelectionState(m))
    this.clusterMarkers.forEach((m) => this.applySelectionState(m))
  }

  // 聚合点专用：复用调用方已取得的叶子 id，避免重复 getLeaves 开销
  private applyClusterSelectionState(marker: MapMarkerAdapter, leafIds: string[]) {
    const selectStore = useSelectStore()
    const el = marker.getElement()
    if (!el) return
    const selected = leafIds.filter((id) => selectStore.isSelected(id))
    el.classList.remove('pm-selected', 'pm-selected-partial')
    if (selected.length > 0 && selected.length === leafIds.length) {
      el.classList.add('pm-selected')
    } else if (selected.length > 0) {
      el.classList.add('pm-selected-partial')
    }
  }

  // 清除所有 marker 的选中态（仅视觉，不动选中集）
  clearSelectionVisual() {
    this.markers.forEach((m) => {
      const el = m.getElement()
      if (el) {
        el.classList.remove('pm-selected', 'pm-selected-partial')
      }
    })
    this.clusterMarkers.forEach((m) => {
      const el = m.getElement()
      if (el) {
        el.classList.remove('pm-selected', 'pm-selected-partial')
      }
    })
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
      this.applySelectionState(existing)
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
    this.applySelectionState(marker)

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
    this.applySelectionState(marker)
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

  // 手动定位视频节点：可拖拽的临时节点，用于导入前在地图上调整位置
  addManualLocateVideoMarkerToMap(videoInfo: IVideoInfo, lat?: number, lng?: number) {
    const existing = this.getMarkerById(videoInfo.id)
    if (existing) {
      this.setViewByMarkerId(videoInfo.id)
      ElMessage.warning('节点已存在！，请编辑已有节点')
      return
    }
    const map = this.MAP_INSTANCE!
    const icon = createVideoMarkerIcon(videoInfo)
    const center = map.getCenter()
    const markerLatLng: [number, number] = lat && lng
      ? toMapLibreLngLat(lat, lng)
      : [center.lng, center.lat]
    const marker = new MapMarkerAdapter(icon, markerLatLng, {
      id: videoInfo.id,
      type: 'temporary-video',
      draggable: true,
    })
    this.markers.set(videoInfo.id, marker)
    marker.addTo(map)
    this.markerMouseListener(marker)
    return marker
  }

  // 添加视频标记（有坐标的视频在地图上显示一个节点，封面为视频第一帧）
  // coverUrl 可选：待上传场景传入原路径封面，导入后省略则从用户目录拉取
  // 视频标记与图片一样参与聚合：进入 imagePoints 由 renderClusters 统一管理（聚合/离散/懒加载封面）
  async addVideoMarkerToMap(videoInfo: IVideoInfo, coverUrl?: string) {
    if (!videoInfo.GPSLatitude || !videoInfo.GPSLongitude) return
    if (this.markers.has(videoInfo.id)) return
    if (!this.MAP_INSTANCE) return
    const mapStore = useMapStore()
    const icon = createVideoMarkerIcon(videoInfo, coverUrl)
    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(videoInfo.GPSLatitude, videoInfo.GPSLongitude),
      { id: videoInfo.id, type: 'video', name: videoInfo.name, iconUrl: coverUrl || '' }
    )
    this.markers.set(videoInfo.id, marker)
    // 与图片一致：只登记到 clusterGroup，实际放置由 renderClusters 决定（聚合时不显示单点）
    this.clusterGroup.addLayer(marker)
    // 视频标记与图片走同一套交互：点击做重叠展开检测，单点/已展开时播放视频
    this.markerMouseListener(marker)
    mapStore.addMarkerId(videoInfo.id)
    this.applySelectionState(marker)

    // 维护聚合索引（与图片一致，标记脏，批量添加后统一重建）
    this.imagePoints.push({
      type: 'Feature',
      properties: { id: videoInfo.id },
      geometry: {
        type: 'Point',
        coordinates: toMapLibreLngLat(videoInfo.GPSLatitude, videoInfo.GPSLongitude),
      },
    })
    this.clusterDirty = true

    // 传入封面立即设置；未传时由 updateVisibleMarkers 在单点进入视口时懒加载
    if (coverUrl) {
      marker.setIcon(createVideoMarkerIcon(videoInfo, coverUrl))
      marker.options.iconUrl = coverUrl
    }
  }

  // 惰性加载视频第一帧封面：仅在 marker 位于视口内时才请求（内部缓存防重）
  // @returns 是否成功设置了封面（失败时调用方不应将节点标记为"已加载"，以便后续再次尝试）
  private async ensureVideoCover(marker: MapMarkerAdapter): Promise<boolean> {
    if (!marker) return false
    if (marker.options.iconUrl) return true
    if (!this.isMarkerInView(marker)) return false
    const url = await getVideoThumbnailUrl(marker.options.id)
    if (!url) return false
    const current = this.markers.get(marker.options.id)
    if (current && current === marker && !current.options.iconUrl) {
      // 查 schema 取全景标记，重建图标时保留角标
      const vi = getVideoInfoById(marker.options.id)
      current.setIcon(createVideoMarkerIcon({ id: marker.options.id, name: marker.options.name, isPanorama: vi?.isPanorama }, url))
      current.options.iconUrl = url
      return true
    }
    return false
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
    const isImage = markerType === 'image' || markerType === 'temporary-image' || markerType === 'video'
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
      const isImage = markerType === 'image' || markerType === 'temporary-image' || markerType === 'video'
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
    this.clusterLeafCache.clear()

    // 无聚合点时移除所有图片/视频单点（分组仍按视口单独加载/卸载）
    if (this.imagePoints.length === 0) {
      this.lastClusterMarkers.forEach((m) => m.remove())
      this.lastClusterMarkers.clear()
      this.markers.forEach((m) => {
        const t = m.options.type
        if (t === 'image' || t === 'temporary-image' || t === 'video') {
          m.remove()
        }
      })
      this.lastShownImageIds.clear()
      this.lastClusterCenters.clear()
      this.lastClusterIds.clear()
      this.lastClusterCentersById.clear()
      // 分组按当前视口加载/卸载
      this.updateEdgeMarkersVisibility(map.getBounds())
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
    // 有选中集时才需要为 cluster 计算叶子 id 与选中态 class（无选中时最常见的平移/缩放帧可跳过）
    const selectionActive = useSelectStore().getSelectedCount() > 0

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
            // 子 cluster 平滑飞向父 cluster 中心，动画结束后移除
            const childCoords = child.geometry.coordinates as [number, number]
            oldMarker.animateToLatLng(parentCenter[1], parentCenter[0], this.clusterMergeOptions, () => {
              oldMarker.remove()
              this.animatingMarkers.delete(oldMarker)
            })
            this.animatingMarkers.add(oldMarker)
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

      // 平移（非缩放）时复用上次同 id 的 cluster marker，避免实时移动时反复重建导致卡顿
      let marker = this.lastClusterMarkers.get(clusterId)
      if (!zoomChanged && marker && this.isMarkerOnMap(marker)) {
        this.lastClusterMarkers.delete(clusterId)
        marker.setLatLng(coords[1], coords[0])
      } else {
        const icon = createClusterIcon(count)
        marker = new MapMarkerAdapter(icon, coords, { id: `cluster-${clusterId}`, type: 'cluster' })
        marker.addTo(map)
        marker.on('click', () => {
          this.onClusterClick(clusterId, coords)
        })
        // 右键 cluster：触发批量菜单（若其成员被选中）
        marker.on('contextmenu', (event: any) => {
          eventBus.emit('show-content-menu', event)
        })
      }
      this.clusterMarkers.set(clusterId, marker)

      // 分裂动画（zoom in）：新 cluster 从父 cluster 中心飞入（淡入）
      if (zoomChanged && !this.lastClusterIds.has(clusterId)) {
        const parentCenter = this.findParentClusterCenter(clusterId)
        if (parentCenter) {
          // 先定位到父中心，再平滑飞到当前坐标
          marker.setLatLng(parentCenter[1], parentCenter[0])
          marker.animateToLatLng(coords[1], coords[0], this.clusterSplitOptions, () => {
            this.animatingMarkers.delete(marker)
          })
          this.animatingMarkers.add(marker)
        }
        // 聚合合并产生的新 cluster：直接显示，不做渐变
      }

      // 记录成员（用于单点离散时从中心飞散）
      const leaves = this.clusterIndex.getLeaves(clusterId, Infinity, 0) as any[]
      leaves.forEach((leaf) => {
        currentClusterCenters.set(leaf.properties.id, coords)
      })
      // 无选中集时跳过叶子 id 数组构造与 classList 操作（平移热路径最常见场景）
      if (selectionActive) {
        const leafIds = leaves.map((leaf) => leaf.properties.id as string)
        this.clusterLeafCache.set(clusterId, leafIds)
        this.applyClusterSelectionState(marker, leafIds)
      }
    })

    // 移除残留的上次 cluster marker（未参与合并动画的）
    this.lastClusterMarkers.forEach((m) => {
      m.remove()
    })
    this.lastClusterMarkers.clear()

    // 单点过渡（图片/视频）：聚合时飞向 cluster 中心，离散时从中心飞散（参照 Leaflet.markercluster）
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t !== 'image' && t !== 'temporary-image' && t !== 'video') return
      // 跳过动画中的 marker，避免连续缩放时状态冲突
      if (m.animating) return

      const shouldShow = visibleImageIds.has(m.options.id)
      const wasShown = this.lastShownImageIds.has(m.options.id)
      const latlng = m.getLatLng()

      if (shouldShow && !wasShown) {
        // 散开（zoom in）：从父 cluster 中心飞散到真实位置
        if (zoomChanged) {
          const fromLngLat = this.lastClusterCenters.get(m.options.id)
          // 目标用真实坐标（imagePoints），避免聚合动画已把 marker 经纬度改为 cluster 中心
          const realCoord = this.getImageRealCoord(m.options.id)
          const toLatLng = realCoord ?? [latlng.lng, latlng.lat]
          if (fromLngLat) {
            m.addTo(map)
            m.setLatLng(fromLngLat[1], fromLngLat[0])
            m.animateToLatLng(toLatLng[1], toLatLng[0], this.clusterSplitOptions, () => {
              this.animatingMarkers.delete(m)
            })
            this.animatingMarkers.add(m)
          } else {
            m.addTo(map)
          }
        } else {
          m.addTo(map)
        }
      } else if (!shouldShow && wasShown) {
        // 聚合（zoom out）：从当前位置飞向 cluster 中心，动画结束后移除
        if (zoomChanged) {
          const toLngLat = currentClusterCenters.get(m.options.id)
          if (toLngLat) {
            m.animateToLatLng(toLngLat[1], toLngLat[0], this.clusterMergeOptions, () => {
              // 恢复原始经纬度再移除，避免下次散开时位置错误（参照 Leaflet._backupLatlng）
              const realCoord = this.getImageRealCoord(m.options.id)
              if (realCoord) m.setLatLng(realCoord[1], realCoord[0])
              m.remove()
              this.animatingMarkers.delete(m)
            })
            this.animatingMarkers.add(m)
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

    // 分组不参与聚合：仅加载当前可视范围内的，视口外的移除（实时 move 触发）
    this.updateEdgeMarkersVisibility(bounds)

    // 更新上次状态
    this.lastShownImageIds = new Set(visibleImageIds)
    this.lastClusterCenters.clear()
    currentClusterCenters.forEach((center, id) => {
      this.lastClusterCenters.set(id, center)
    })
    this.lastClusterIds = currentClusterIds
    this.lastZoom = zoom
  }

  // 分组节点按当前视口加载/卸载：视口内且未隐藏 → 显示；视口外 → 移除
  // 视频与图片一样参与聚合，不在此处按视口单独管理（其封面由 updateVisibleMarkers 懒加载）
  private updateEdgeMarkersVisibility(bounds: maplibregl.LngLatBounds) {
    const map = this.MAP_INSTANCE
    if (!map) return
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t !== 'group' && t !== 'temporary-group') return
      if (this.hiddenMarkerIds.has(m.options.id)) {
        if (this.isMarkerOnMap(m)) m.remove()
        return
      }
      const { lat, lng } = m.getLatLng()
      const inView = bounds.contains([lng, lat])
      if (inView) {
        if (!this.isMarkerOnMap(m)) m.addTo(map)
      } else if (this.isMarkerOnMap(m)) {
        m.remove()
      }
    })
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

  // 获取图片的真实经纬度 [lng, lat]（聚合动画可能临时改变了 marker 坐标，需从 imagePoints 恢复）
  private getImageRealCoord(imageId: string): [number, number] | undefined {
    const point = this.imagePoints.find((p) => p.properties.id === imageId)
    return point ? point.geometry.coordinates : undefined
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
    // marker 创建时已绑定 mouse 监听，无需重复绑定（重复会导致 click 触发两次）
  }

  isMarkerInCluster(marker: MapMarkerAdapter): boolean {
    return this.hiddenMarkerIds.has(marker.options.id)
  }

  // moveend 时触发（由 map.ts 防抖调用）
  updateVisibleMarkers() {
    this.renderClusters()
    // 只对当前显示为单点的图片/视频加载缩略图/封面（聚合在 cluster 中的不加载，避免大量并发）
    const mapStore = useMapStore()
    // 用 Set 做成员判断，避免数组 includes 导致的 O(n²)（可见单点数量大时明显）
    const visibleMarkerIdSet = new Set(mapStore.getVisibleMarkerIdList)
    this.lastShownImageIds.forEach((imageId: string) => {
      const marker = this.getMarkerById(imageId)
      if (!marker || visibleMarkerIdSet.has(imageId)) return
      if (marker.options.type === 'image') {
        this.updateImageMarker(marker, visibleMarkerIdSet)
        this.addVisibleMarkerById(imageId)
      } else if (marker.options.type === 'video') {
        // 封面加载成功后才标记为"已加载"；失败时短暂重试几次，避免拖入视口后封面迟迟不出现
        this.loadVideoCoverWithRetry(marker, imageId)
      }
    })
  }

  // 视频单点封面加载：成功才标记可见；失败做几次带间隔的重试（封面提取为 ffmpeg，可能偶发失败/较慢）
  private loadVideoCoverWithRetry(marker: MapMarkerAdapter, videoId: string, attempt = 0) {
    if (this.videoCoverLoading.has(videoId)) return
    this.videoCoverLoading.add(videoId)
    this.ensureVideoCover(marker).then((ok) => {
      this.videoCoverLoading.delete(videoId)
      if (ok) {
        this.addVisibleMarkerById(videoId)
        return
      }
      // 提取失败：短暂延迟后重试（最多 3 次），期间不标记可见，保证后续 move 也能继续尝试
      if (attempt < 3 && marker.options.type === 'video' && !marker.options.iconUrl) {
        setTimeout(() => this.loadVideoCoverWithRetry(marker, videoId, attempt + 1), 800 * (attempt + 1))
      }
    })
  }

  async updateImageMarker(marker: MapMarkerAdapter, visibleMarkerIdSet: Set<string>) {
    const mapStore = useMapStore()
    const isVisible = visibleMarkerIdSet.has(marker.options.id)
    const isInSchema = judgeHadUploadImage(marker.options.id)
    if (!isVisible && marker.options.iconUrl) return
    if (!isVisible && isInSchema) {
      const fileUrl = await getMarkerImageUrlById(marker.options.id)
      if (!fileUrl || fileUrl === '') {
        mapStore.deleteVisbleMarkerId(marker.options.id)
        return
      }
      // 复用 createImageMarkerIcon：保留全景角标等标识（聚合节点进入视口时重建图标不能丢角标）
      const schemaInfo = getSchemaInfoById(marker.options.id) as IImageInfo | null
      marker.setIcon(createImageMarkerIcon(schemaInfo ?? { id: marker.options.id } as IImageInfo, fileUrl))
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

  // 展示某个节点自身的详情：已导入视频→播放弹窗；图片/临时图→图片详情
  private showMarkerDetail(marker: MapMarkerAdapter, event: any) {
    if (marker.options.type === 'video') {
      eventBus.emit('show-video-play', { videoId: marker.options.id })
      return
    }
    eventBus.emit('show-image-data', event)
  }

  markerMouseListener(marker: MapMarkerAdapter) {
    if (!marker) return
    marker.on('click', (event: any) => {
      // 展开状态下点击某张：保持展开，直接显示该节点自身详情
      if (this.spiderfiedMarkers.length > 0) {
        this.showMarkerDetail(marker, event)
        return
      }
      // 检测同位置重叠的图片/视频，重叠则蜘蛛网展开
      const overlapping = this.getOverlappingMarkers(marker)
      if (overlapping.length > 1) {
        this.spiderfy(overlapping)
      } else {
        this.showMarkerDetail(marker, event)
      }
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

  // 找出与指定 marker 同位置（极近）的图片/视频 marker，用于重叠检测（分组不参与展开）
  private getOverlappingMarkers(marker: MapMarkerAdapter): MapMarkerAdapter[] {
    const { lat, lng } = marker.getLatLng()
    const result: MapMarkerAdapter[] = []
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t !== 'image' && t !== 'temporary-image' && t !== 'video') return
      if (!this.isMarkerOnMap(m)) return
      const ll = m.getLatLng()
      if (Math.abs(ll.lat - lat) < MARKER_OVERLAP_THRESHOLD && Math.abs(ll.lng - lng) < MARKER_OVERLAP_THRESHOLD) {
        result.push(m)
      }
    })
    return result
  }

  // 蜘蛛网展开：把重叠的照片沿圆周展开，临时偏移位置
  private spiderfy(markers: MapMarkerAdapter[]) {
    if (markers.length <= 1 || !this.MAP_INSTANCE) return
    const map = this.MAP_INSTANCE
    const center = markers[0].getLatLng()
    const centerPoint = map.project([center.lng, center.lat])
    const n = markers.length
    // 展开半径：按约 1 米实际地理距离计算，但至少保证节点能分开（不小于 marker 尺寸）
    const metersPerPixel = 40075016.686 * Math.cos((center.lat * Math.PI) / 180) / (256 * Math.pow(2, map.getZoom()))
    const radiusPx = Math.max(1 / metersPerPixel, 36)

    this.spiderfiedMarkers = []
    this.spiderfyJustTriggered = true
    setTimeout(() => {
      this.spiderfyJustTriggered = false
    }, 300)
    markers.forEach((m, i) => {
      const angle = (i * 2 * Math.PI) / n
      const px = centerPoint.x + radiusPx * Math.cos(angle)
      const py = centerPoint.y + radiusPx * Math.sin(angle)
      const ll = map.unproject({ x: px, y: py })
      const cur = m.getLatLng()
      this.spiderfiedMarkers.push({ marker: m, original: [cur.lng, cur.lat] })
      const el = m.getElement()
      // 展开动画：临时加 transform 过渡，让节点平滑移动到新位置
      el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1.2, 0.36, 1)'
      m.setLatLng(ll.lat, ll.lng)
      setTimeout(() => {
        el.style.transition = ''
      }, 320)
      // 标记展开节点（红色尖角）
      el.classList.add('spiderfied-marker')
      m.setZIndexOffset(2000 + i)
    })
  }

  // 收回展开的 marker，恢复原始位置
  unspiderfy() {
    if (this.spiderfiedMarkers.length === 0) return
    const markers = this.spiderfiedMarkers
    this.spiderfiedMarkers = []
    markers.forEach(({ marker, original }) => {
      const el = marker.getElement()
      el.classList.remove('spiderfied-marker')
      // 合并动画：临时加 transform 过渡，让节点平滑回到原位置
      el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1.2, 0.36, 1)'
      marker.setLatLng(original[1], original[0])
      setTimeout(() => {
        el.style.transition = ''
      }, 320)
      marker.setZIndexOffset(0)
    })
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
    // 先移除所有单点图片/视频 marker，renderClusters 会重新添加时间范围内的
    this.markers.forEach((m) => {
      const t = m.options.type
      if (t === 'image' || t === 'temporary-image' || t === 'video') {
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
