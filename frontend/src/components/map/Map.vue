<!--
 * @Author: Do not edit
 * @Date: 2026-03-04
 * @LastEditTime: 2026-03-27 15:12:32
 * @FilePath: \PicMap\picMap_fontend\src\components\map\Map.vue
 * @Description: 单独的地图组件
 *   - 使用MapLibre展示分组中图片的位置
 *   - 与主地图使用相同的瓦片
 *   - 点击marker显示图片详情
 *   - hover时有大地图marker相同的动效
-->
<template>
  <div class="map" ref="mapContainer" :class="{ 'is-fullscreen': isFullscreen }" @mousemove="handleMouseMove">
    <!-- 全屏按钮 -->
    <FullscreenButton v-if="showFullscreenButton" :is-fullscreen="isFullscreen" @click="toggleFullscreen" />

    <!-- 悬浮卡片 -->
    <TrackHoverCard :visible="hoverCardVisible" :trackInfo="hoverTrackInfo" :position="hoverCardPosition" />

    <!-- 详情卡片（全屏时显示） -->
    <TrackDetailPanel v-if="isFullscreen" :visible="detailPanelVisible" :trackList="detailPanelTrackList"
      :currentTrackId="detailPanelTrackId" :trackInfo="detailPanelTrackInfo"
      @update:visible="detailPanelVisible = $event"
      @video-focus="handleVideoFocus" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, type PropType, nextTick } from 'vue';
import * as maplibregl from 'maplibre-gl';
import { ElIcon } from 'element-plus';
import { getSchemaInfoById } from '@/utils/schema';
import { getVideoInfoById, getVideoGPSInfo } from '@/utils/schema';
import { getMarkerImageUrlById } from '@/utils/Image';
import { getVideoThumbnailUrl } from '@/utils/video';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MARKER_CONSTANT, MARKER_OVERLAP_THRESHOLD, MAP_CONSTANT } from '@/utils/constant'
import { createImageMarkerIcon, createVideoMarkerIcon, MapMarkerAdapter } from '@/services/markerAdapter';
import { toMapLibreLngLat } from '@/utils/mapLibre';
import { useAppStore } from '@/store/appSchema';
import { useSchemaStore } from '@/store/schema';
import { getDefaultMapTile } from '@/components/mapSelector/defaultMap';
import trackService from '@/services/track';
import mapService from '@/services/map';
import API from '@/wails/api';
import { fetchTrackPoints, extractSegmentCoords, getVideoColor, resolveVideoSegmentAtPoint, VIDEO_SEG_LINE_WIDTH, VIDEO_SEG_LINE_OPACITY } from '@/utils/videoNode'
import eventBus from '@/utils/eventBus'
import TrackHoverCard from '@/components/trackHoverCard/TrackHoverCard.vue';
import TrackDetailPanel from '@/components/trackDetail/TrackDetailPanel.vue';
import FullscreenButton from '@/components/common/FullscreenButton.vue';

/**
 * 组件props：图片ID列表
 */
const props = defineProps({
  // 图片id列表，用于在地图上显示对应的marker
  imageIds: {
    type: Object as PropType<string[]>,
    default: () => []
  },
  // 轨迹id列表，用于在地图上显示对应的轨迹（如果需要）
  trackIds: {
    type: Object as PropType<string[]>,
    default: () => []
  },
  // 视频id列表，用于在地图上显示对应的视频节点
  videoIds: {
    type: Object as PropType<string[]>,
    default: () => []
  },
  // 是否展示全屏按钮
  showFullscreenButton: {
    type: Boolean,
    default: true
  }
})

/**
 * 组件事件：marker点击事件
 */
const emit = defineEmits<{
  (e: 'markerClick', imageId: string): void
  (e: 'markerContextMenu', markerId: string, event: MouseEvent): void
}>()

const appStore = useAppStore()
const schemaStore = useSchemaStore()
const mapContainer = ref<HTMLElement>()
const isFullscreen = ref(false)
let map: maplibregl.Map | null = null
let styleLoaded = false
const markers: MapMarkerAdapter[] = []
let normalViewState: { center: { lng: number; lat: number }; zoom: number } | null = null

// spiderfy 展开状态：记录已展开的 marker 及其原始经纬度
const spiderfiedMarkers: { marker: MapMarkerAdapter; original: [number, number] }[] = []
// 刚触发展开的标记：忽略紧随其后的地图 click（避免刚展开就被收回）
let spiderfyJustTriggered = false

const hoverCardVisible = ref(false)
const hoverCardPosition = ref({ x: 0, y: 0 })
const hoverTrackInfo = ref<any>(null)

const detailPanelVisible = ref(false)
const detailPanelTrackId = ref('')
const detailPanelTrackInfo = ref<any>(null)
const detailPanelTrackList = ref<any[]>([])
const loadedTrackInstances = ref<Set<any>>(new Set())
const mapInstanceIdMap = new WeakMap<maplibregl.Map, string>()
let mapIdCounter = 0
let currentSelectedInstance: any = null

function handleMouseMove(e: MouseEvent) {
  hoverCardPosition.value = { x: e.clientX, y: e.clientY }
}

function handleTrackChange(instanceId: string) {
  const track = detailPanelTrackList.value.find(t => t.instanceId === instanceId)
  if (track) {
    if (currentSelectedInstance && currentSelectedInstance !== track.instance) {
      currentSelectedInstance.unhighlight()
    }
    if (track.instance && map) {
      track.instance.highlight(map, instanceId)
      currentSelectedInstance = track.instance
    }
    detailPanelTrackId.value = instanceId
    detailPanelTrackInfo.value = track
    const bounds = track.instance?.getBounds?.()
    if (map && bounds) {
      map.fitBounds(bounds as any, { padding: 60, duration: 500 })
    }
  }
}

/**
 * @description: 点击轨迹绑定视频 → 聚焦并高亮其所属轨迹（聚焦到视频在轨迹上对应的弧段，与"对齐视频"效果一致）
 * @param {string} videoId - 视频ID
 * @param {string} instanceId - 视频所属轨迹的实例ID
 * @return {*}
 */
async function handleVideoFocus(videoId: string, instanceId: string) {
  handleTrackChange(instanceId)
  if (!map) return
  // 优先从轨迹列表取，找不到时回退到当前详情面板的轨迹信息（异步加载的轨迹可能不在列表里）
  const track =
    detailPanelTrackList.value.find(t => t.instanceId === instanceId) ??
    (detailPanelTrackInfo.value?.instanceId === instanceId ? detailPanelTrackInfo.value : undefined)
  const trackId = track?.id
  if (!trackId) return
  const gpx = await fetchTrackPoints(trackId)
  const trackSchema = (schemaStore.getSchema.trackInfo || []).find(
    (t: any) => normalizeTrackId(t.id) === normalizeTrackId(trackId)
  )
  const videos = trackSchema?.videos || []
  const refIndex = videos.findIndex((v: any) => v.videoId === videoId)
  const ref = refIndex >= 0 ? videos[refIndex] : undefined
  const durationMs = (schemaStore.getSchema.videoInfo || []).find((v) => v.id === videoId)?.durationMs || 0
  const segCoords = extractSegmentCoords(gpx || [], ref?.timeOffsetMs ?? 0, durationMs)
  if (segCoords.length >= 2) {
    drawVideoSegmentHighlight(getVideoColor(refIndex), segCoords)
    map.fitBounds(
      segCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(segCoords[0], segCoords[0])) as any,
      { padding: 60, duration: 500, maxZoom: 17 }
    )
    eventBus.emit('video-tag-scroll-to', { trackId, videoId })
  }
}

/**
 * @description: 根据点击位置判断命中的视频弧段，高亮并滚动对应视频标签到可视区
 * @param {string} trackId - 轨迹 ID
 * @param {{lng:number,lat:number}} lngLat - 点击位置（GCJ02）
 */
async function focusVideoSegmentAtPoint(trackId: string, lngLat: { lng: number; lat: number }) {
  const trackSchema = (schemaStore.getSchema.trackInfo || []).find(
    (t: any) => normalizeTrackId(t.id) === normalizeTrackId(trackId)
  )
  const videos = trackSchema?.videos || []
  if (videos.length === 0) return
  const gpx = await fetchTrackPoints(trackId)
  const hit = resolveVideoSegmentAtPoint(
    gpx || [],
    videos,
    schemaStore.getSchema.videoInfo || [],
    lngLat
  )
  if (!hit) return
  drawVideoSegmentHighlight(hit.color, hit.segCoords)
  eventBus.emit('video-tag-scroll-to', { trackId, videoId: hit.videoId })
}

// 视频弧段高亮图层固定 id（与对齐视频界面配色一致）；加 fullscreen 前缀避免与主地图同名冲突
const VIDEO_SEG_SOURCE = 'video-seg-highlight-source-fullscreen'
const VIDEO_SEG_LAYER = 'video-seg-highlight-layer-fullscreen'

/**
 * @description: 在地图上用指定颜色高亮绘制视频对应的弧段（覆盖上一次的高亮）
 * @param {string} color - 视频配色（与对齐视频界面一致）
 * @param {[number, number][]} coords - GCJ02 弧段坐标
 */
function drawVideoSegmentHighlight(color: string, coords: [number, number][]) {
  if (!map) return
  if (map.getLayer(VIDEO_SEG_LAYER)) map.removeLayer(VIDEO_SEG_LAYER)
  if (map.getSource(VIDEO_SEG_SOURCE)) map.removeSource(VIDEO_SEG_SOURCE)
  map.addSource(VIDEO_SEG_SOURCE, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
  })
  map.addLayer({
    id: VIDEO_SEG_LAYER,
    type: 'line',
    source: VIDEO_SEG_SOURCE,
    paint: { 'line-color': color, 'line-width': VIDEO_SEG_LINE_WIDTH, 'line-opacity': VIDEO_SEG_LINE_OPACITY },
  })
}

/**
 * @description: 清除视频弧段高亮图层
 */
function clearVideoSegmentHighlight() {
  if (!map) return
  if (map.getLayer(VIDEO_SEG_LAYER)) map.removeLayer(VIDEO_SEG_LAYER)
  if (map.getSource(VIDEO_SEG_SOURCE)) map.removeSource(VIDEO_SEG_SOURCE)
}

function afterResizeTransition(callback: () => void) {
  setTimeout(() => {
    nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(callback)
      })
    })
  }, 100)
}

function toggleFullscreen() {
  if (!map) return

  if (!isFullscreen.value) {
    const c = map.getCenter()
    normalViewState = {
      center: { lng: c.lng, lat: c.lat },
      zoom: map.getZoom()
    }
    isFullscreen.value = true
    afterResizeTransition(() => {
      map?.resize()
      fitAllBounds()
    })
    return
  }

  isFullscreen.value = false
  afterResizeTransition(() => {
    if (!map) return
    map.resize()
    if (normalViewState) {
      map.jumpTo({ center: [normalViewState.center.lng, normalViewState.center.lat], zoom: normalViewState.zoom })
    } else {
      fitAllBounds()
    }
  })
}

function getMapInstance(): maplibregl.Map | null {
  return map
}

/**
 * 获取当前地图瓦片URL
 * 优先使用默认瓦片（defaultTileId），其次使用激活的瓦片
 * @returns 瓦片URL字符串
 */
function getCurrentTileUrl(): String {
  const activeTiles = schemaStore.getSchema?.mapInfo?.activeTiles ?? []
  const customTiles = appStore.getAppSchema?.mapInfo?.mapTiles ?? []
  const defaultTileId = appStore.getAppSchema?.mapInfo?.defaultTileId ?? ''
  const defaultTiles = getDefaultMapTile()

  const allTiles = [...defaultTiles, ...customTiles]

  if (defaultTileId && activeTiles.includes(defaultTileId)) {
    const defaultTile = allTiles.find(tile => tile.id === defaultTileId)
    if (defaultTile) {
      return defaultTile.url
    }
  }

  const currentTile = allTiles.find(tile => activeTiles.includes(tile.id))

  return currentTile?.url as string || defaultTiles[0]?.url
}

/**
 * 初始化地图
 * 创建MapLibre地图实例并添加瓦片图层
 */
async function initMap() {
  if (!mapContainer.value) return

  // 与主地图保持一致的中心、缩放、朝向与俯仰角，避免从默认位置（非洲）移动过来
  const mainMap = mapService.getMapInstance()
  const mainCenter = mainMap?.getCenter()
  const mainZoom = mainMap?.getZoom()

  map = new maplibregl.Map({
    container: mapContainer.value,
    style: { version: 8, sources: {}, layers: [] },
    attributionControl: false,
    minZoom: MAP_CONSTANT.MIN_ZOOM,
    maxZoom: MAP_CONSTANT.MAX_ZOOM,
    center: mainCenter ? [mainCenter.lng, mainCenter.lat] : undefined,
    zoom: mainZoom,
    bearing: mainMap?.getBearing() ?? 0,
    pitch: mainMap?.getPitch() ?? 0,
  })

  mapInstanceIdMap.set(map, String(++mapIdCounter))

  // style 异步加载完成后再添加瓦片、标记、轨迹
  map.on('load', async () => {
    styleLoaded = true
    const tileUrl = getCurrentTileUrl()
    map!.addSource('tile', { type: 'raster', tiles: [tileUrl as string], tileSize: 256, maxzoom: MAP_CONSTANT.MAX_ZOOM })
    map!.addLayer({ id: 'tile-layer', type: 'raster', source: 'tile' })

    await updateMarkers()
    await updateTracks()
    invalidateMapSize()
  })

  // 点击地图空白处收回展开的节点（marker 点击会 stopPropagation，不会触发）
  map.on('click', (e: any) => {
    if (spiderfyJustTriggered) return
    if (e?.originalEvent?.defaultPrevented || e?.defaultPrevented) return
    unspiderfy()
  })
}

/**
 * 用于在地图容器显示后调用
 */
function invalidateMapSize() {
  setTimeout(() => {
    map?.resize()
  }, 100)
}

/**
 * 适配所有图层（标记和轨迹）的边界
 * 使所有内容都在地图可视区域内显示
 */
function fitAllBounds() {
  if (!map) return
  map.resize()
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  markers.forEach(marker => {
    const latlng = marker.getLatLng()
    if (isFinite(latlng.lng) && isFinite(latlng.lat)) {
      minLng = Math.min(minLng, latlng.lng)
      minLat = Math.min(minLat, latlng.lat)
      maxLng = Math.max(maxLng, latlng.lng)
      maxLat = Math.max(maxLat, latlng.lat)
    }
  })

  // 加入当前显示轨迹的边界
  const targetTrackIds = (props.trackIds || []).map(id => normalizeTrackId(id))
  trackService.getInstances().forEach(instance => {
    if (targetTrackIds.includes(normalizeTrackId(instance.getTrackId()))) {
      const bounds = instance.getBounds()
      if (bounds) {
        bounds.forEach(([lng, lat]) => {
          if (isFinite(lng) && isFinite(lat)) {
            minLng = Math.min(minLng, lng)
            minLat = Math.min(minLat, lat)
            maxLng = Math.max(maxLng, lng)
            maxLat = Math.max(maxLat, lat)
          }
        })
      }
    }
  })

  if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]] as any, { padding: 20, duration: 300 })
  } else {
    map.jumpTo({ center: toMapLibreLngLat(DEFAULT_CENTER[0], DEFAULT_CENTER[1]), zoom: DEFAULT_ZOOM })
  }
}

/**
 * 清除所有标记
 * 遍历markers数组，从地图上移除每个标记
 */
function clearMarkers() {
  // 节点整体重建时直接清空展开状态（元素会被移除，无需收回动画）
  spiderfiedMarkers.length = 0
  markers.forEach(marker => {
    marker.remove()
  })
  markers.length = 0
}

/**
 * 高亮marker（hover效果）
 * @param marker MapLibre标记适配器
 */
function highlightMarker(marker: MapMarkerAdapter) {
  marker.setZIndexOffset(1000)

  // 缩放作用在内层图标（.image-icon 带 transition），与外层定位 translate 分离，hover 才有过渡动画
  const markerElement = marker.getInnerElement();
  if (markerElement) {
    markerElement.style.transform = `scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`;
  }
}

/**
 * 重置marker（取消hover效果）
 * @param marker MapLibre标记适配器
 */
function resetMarker(marker: MapMarkerAdapter) {
  marker.setZIndexOffset(0)

  const markerElement = marker.getInnerElement();
  if (markerElement) {
    markerElement.style.transform = `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`;
  }
}

/**
 * 找出与指定 marker 同位置（极近）的节点，用于重叠检测（已展开的节点跳过）
 */
function getOverlappingMarkers(marker: MapMarkerAdapter): MapMarkerAdapter[] {
  const { lat, lng } = marker.getLatLng()
  const result: MapMarkerAdapter[] = []
  markers.forEach((m) => {
    if (spiderfiedMarkers.some(s => s.marker === m)) return
    const ll = m.getLatLng()
    if (Math.abs(ll.lat - lat) < MARKER_OVERLAP_THRESHOLD && Math.abs(ll.lng - lng) < MARKER_OVERLAP_THRESHOLD) {
      result.push(m)
    }
  })
  return result
}

/**
 * 蜘蛛网展开：把重叠的节点沿圆周展开，临时偏移位置（带过渡动画）
 */
function spiderfy(overlapping: MapMarkerAdapter[]) {
  if (!map || overlapping.length <= 1) return
  const center = overlapping[0].getLatLng()
  const centerPoint = map.project([center.lng, center.lat])
  const n = overlapping.length
  // 展开半径：按约 1 米实际地理距离计算，但至少保证节点能分开（不小于 marker 尺寸）
  const metersPerPixel = 40075016.686 * Math.cos((center.lat * Math.PI) / 180) / (256 * Math.pow(2, map.getZoom()))
  const radiusPx = Math.max(1 / metersPerPixel, 36)

  spiderfyJustTriggered = true
  setTimeout(() => { spiderfyJustTriggered = false }, 300)
  overlapping.forEach((m, i) => {
    const angle = (i * 2 * Math.PI) / n
    const px = centerPoint.x + radiusPx * Math.cos(angle)
    const py = centerPoint.y + radiusPx * Math.sin(angle)
    const ll = map!.unproject(new maplibregl.Point(px, py))
    const cur = m.getLatLng()
    spiderfiedMarkers.push({ marker: m, original: [cur.lng, cur.lat] })
    const el = m.getElement()
    // 展开动画：临时加 transform 过渡，让节点平滑移动到新位置
    el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1.2, 0.36, 1)'
    m.setLatLng(ll.lat, ll.lng)
    setTimeout(() => { el.style.transition = '' }, 320)
    // 标记展开节点（红色尖角）
    el.classList.add('spiderfied-marker')
    m.setZIndexOffset(2000 + i)
  })
}

/**
 * 收回展开的 marker，恢复原始位置
 */
function unspiderfy() {
  if (spiderfiedMarkers.length === 0) return
  const list = spiderfiedMarkers.splice(0, spiderfiedMarkers.length)
  list.forEach(({ marker, original }) => {
    const el = marker.getElement()
    el.classList.remove('spiderfied-marker')
    // 合并动画：临时加 transform 过渡，让节点平滑回到原位置
    el.style.transition = 'transform 0.3s cubic-bezier(0.22, 1.2, 0.36, 1)'
    marker.setLatLng(original[1], original[0])
    setTimeout(() => { el.style.transition = '' }, 320)
    marker.setZIndexOffset(0)
  })
}

/**
 * 处理 marker 点击：重叠时蜘蛛网展开，否则触发点击回调
 */
function handleMarkerClick(marker: MapMarkerAdapter, id: string) {
  // 已展开状态下点击某张：直接显示该节点详情
  if (spiderfiedMarkers.length > 0) {
    emit('markerClick', id)
    return
  }
  const overlapping = getOverlappingMarkers(marker)
  if (overlapping.length > 1) {
    spiderfy(overlapping)
  } else {
    emit('markerClick', id)
  }
}

/**
 * 更新地图标记
 * 根据图片的GPS信息添加marker，并添加hover事件监听
 */
async function updateMarkers() {
  if (!map) return
  if (!styleLoaded) {
    map.once('load', () => updateMarkers())
    return
  }

  clearMarkers()

  const validImages: { id: string; lat: number; lng: number }[] = []

  for (const imgId of props.imageIds) {
    const imageInfoDetail = getSchemaInfoById(imgId) as any
    if (imageInfoDetail) {
      const GPSInfo = imageInfoDetail.GPSInfo || {}
      if (GPSInfo.GPSLatitude && GPSInfo.GPSLongitude) {
        validImages.push({
          id: imgId,
          lat: GPSInfo.GPSLatitude,
          lng: GPSInfo.GPSLongitude
        })
      }
    }
  }

  for (const img of validImages) {
    const imageUrl = await getMarkerImageUrlById(img.id)
    const imageInfoDetail = getSchemaInfoById(img.id) as any
    const icon = createImageMarkerIcon(
      { id: img.id, name: imageInfoDetail?.name || '无', type: '', GPSInfo: {} as any } as any,
      imageUrl || undefined
    )

    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(img.lat, img.lng),
      { id: img.id, type: 'image', iconUrl: icon.iconUrl }
    )

    marker.on('click', () => {
      handleMarkerClick(marker, img.id)
    })

    marker.on('contextmenu', (ev: any) => {
      emit('markerContextMenu', img.id, ev?.originalEvent ?? ev)
    })

    marker.on('mouseover', () => {
      highlightMarker(marker)
    })
    marker.on('mouseout', () => {
      resetMarker(marker)
    })

    marker.addTo(map!)
    markers.push(marker)
  }

  // 视频节点：仅渲染有独立 GPS 坐标的视频
  for (const videoId of (props.videoIds || [])) {
    const videoInfo = getVideoInfoById(videoId) as any
    const videoGps = getVideoGPSInfo(videoInfo)
    if (!videoGps) continue
    const coverUrl = await getVideoThumbnailUrl(videoId)
    const icon = createVideoMarkerIcon(videoInfo, coverUrl || undefined)
    const marker = new MapMarkerAdapter(
      icon,
      toMapLibreLngLat(videoGps.GPSLatitude, videoGps.GPSLongitude),
      { id: videoId, type: 'video', name: videoInfo.name, iconUrl: coverUrl || '' }
    )
    marker.on('click', () => {
      handleMarkerClick(marker, videoId)
    })
    marker.on('contextmenu', (ev: any) => {
      emit('markerContextMenu', videoId, ev?.originalEvent ?? ev)
    })
    marker.on('mouseover', () => {
      highlightMarker(marker)
    })
    marker.on('mouseout', () => {
      resetMarker(marker)
    })
    marker.addTo(map!)
    markers.push(marker)
  }

  setTimeout(() => {
    fitAllBounds()
  }, 100)
}

/**
 * @description: 更新轨迹显示
 * @return {*}
 */
async function updateTracks() {
  if (!map) return
  if (!styleLoaded) {
    map.once('load', () => updateTracks())
    return
  }

  const targetTrackIds = props.trackIds || []
  const normalizedTargetIds = targetTrackIds.map(id => normalizeTrackId(id))

  trackService.getInstances().forEach(instance => {
    const isTarget = normalizedTargetIds.includes(normalizeTrackId(instance.getTrackId()))
    if (!isTarget) {
      // 完整移除：layer + source + 起终点 marker，并清理缓存，保证切换回来能重建
      instance.removeMap(map!)
    }
  })

  detailPanelTrackList.value = []
  loadedTrackInstances.value.clear()

  for (const trackId of targetTrackIds) {
    const instance = await ensureTrackLoaded(trackId)
    if (instance) {
      if (loadedTrackInstances.value.has(instance)) {
        continue
      }
      loadedTrackInstances.value.add(instance)

      instance.addMap(map)

      // 坐标解析完成后重新适配边界（图片 + 轨迹）
      instance.onCoordinatesReady(() => {
        fitAllBounds()
      })

      const mapId = mapInstanceIdMap.get(map) || 'unknown'
      const instanceId = trackId + '_' + mapId

      if (!detailPanelTrackList.value.find(t => t.instanceId === instanceId)) {
        instance.onTrackInfoReady((info: any) => {
          if (!detailPanelTrackList.value.find(t => t.instanceId === instanceId)) {
            detailPanelTrackList.value.push({ instanceId, id: trackId, instance, ...info })
          }
        })
      } else {
        const existingTrack = detailPanelTrackList.value.find(t => t.instanceId === instanceId)
        if (existingTrack && !existingTrack.instance) {
          existingTrack.instance = instance
        }
      }

      instance.setHoverCallback(map, (info: any, event: string) => {
        if (event === 'enter') {
          hoverCardVisible.value = true
          hoverTrackInfo.value = info
        } else {
          hoverCardVisible.value = false
        }
      })

      instance.setClickCallback(map, (info: any, e?: any) => {
        if (!isFullscreen.value) {
          return
        }
        if (currentSelectedInstance && currentSelectedInstance !== instance) {
          currentSelectedInstance.unhighlight()
        }
        instance.highlight(map!, instanceId)
        currentSelectedInstance = instance
        detailPanelTrackId.value = instanceId
        detailPanelTrackInfo.value = { instanceId, id: trackId, instance, ...info }
        detailPanelVisible.value = true

        // 点击位置若落在轨迹关联视频的弧段上，高亮该弧段并滚动对应标签到可视区
        if (e?.lngLat) {
          focusVideoSegmentAtPoint(trackId, e.lngLat)
        }
      })

      const normalizedTrackId = normalizeTrackId(trackId)
      const trackInfo = schemaStore.getSchema.trackInfo?.find((t: any) => normalizeTrackId(t.id) === normalizedTrackId)
      if (trackInfo?.setting?.lineColor) {
        trackService.updateTrackColor(trackId, trackInfo.setting.lineColor)
      }
    }
  }

  setTimeout(() => {
    fitAllBounds()
  }, 100)
}

function normalizeTrackId(trackId: string) {
  return trackId.replace(/\.gpx$/i, '').toLowerCase()
}

function getTrackInstance(trackId: string) {
  const direct = trackService.getTrackInstanceById(trackId)
  if (direct) return direct

  const withSuffix = `${normalizeTrackId(trackId)}.gpx`
  const bySuffix = trackService.getTrackInstanceById(withSuffix)
  if (bySuffix) return bySuffix

  const normalized = normalizeTrackId(trackId)
  return trackService.getInstances().find(instance => normalizeTrackId(instance.getTrackId()) === normalized)
}

async function ensureTrackLoaded(trackId: string) {
  const existing = getTrackInstance(trackId)
  if (existing) return existing

  try {
    const res = await API.track.getTrack(trackId)
    const payload = (res as any)?.data?.code !== undefined ? (res as any).data : res
    const fileContent = payload?.data?.fileContent || payload?.fileContent
    if (!fileContent) {
      return undefined
    }
    const fileName = trackId.includes('.gpx') ? trackId : `${trackId}.gpx`
    const file = new File([new Blob([fileContent], { type: 'application/gpx+xml' })], fileName, {
      type: 'application/gpx+xml'
    })
    return trackService.activeTrack(file)
  } catch (error) {
    console.error('加载轨迹失败:', trackId, error)
    return undefined
  }
}

// 监听图片ID变化，更新标记
watch(() => props.imageIds, () => {
  updateMarkers()
}, { deep: true })

// 监听视频ID变化，更新标记
watch(() => props.videoIds, () => {
  updateMarkers()
}, { deep: true })

// 监听轨迹ID变化，更新轨迹显示
watch(() => props.trackIds, () => {
  updateTracks()
}, { deep: true, immediate: true })

// 监听详情面板关闭，取消高亮
watch(detailPanelVisible, (newVal) => {
  if (!newVal) {
    clearVideoSegmentHighlight()
    if (currentSelectedInstance) {
      currentSelectedInstance.unhighlight()
      currentSelectedInstance = null
    }
  }
})

// 组件挂载时初始化地图
onMounted(() => {
  initMap()
})

// 组件卸载时清理地图实例
onUnmounted(() => {
  isFullscreen.value = false
  if (currentSelectedInstance) {
    currentSelectedInstance.unhighlight()
    currentSelectedInstance = null
  }
  if (map) {
    trackService.deleteTracksInMap(map)
    map.remove()
    map = null
  }
})

defineExpose({
  invalidateMapSize,
  getMapInstance,
  fitAllBounds
})
</script>

<style scoped>
.map {
  background-color: rgba(0, 0, 0, 0.9);
  width: 100%;
  height: 100%;
  position: relative;
  transition: all 0.1s ease;
}

.map.is-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
}
</style>
