<!--
 * @Author: Do not edit
 * @Date: 2026-03-04
 * @LastEditTime: 2026-03-27 15:12:32
 * @FilePath: \PicMap\picMap_fontend\src\components\map\Map.vue
 * @Description: 单独的地图组件
 *   - 使用Leaflet展示分组中图片的位置
 *   - 与主地图使用相同的瓦片
 *   - 点击marker显示图片详情
 *   - hover时有大地图marker相同的动效
-->
<template>
  <div class="map" ref="mapContainer" :class="{ 'is-fullscreen': isFullscreen }" @mousemove="handleMouseMove">
    <!-- 全屏按钮 -->
    <button v-if="showFullscreenButton" class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
      <el-icon :size="16">
        <Close v-if="isFullscreen"></Close>
        <FullScreen v-else></FullScreen>
      </el-icon>
    </button>

    <!-- 悬浮卡片 -->
    <TrackHoverCard :visible="hoverCardVisible" :trackInfo="hoverTrackInfo" :position="hoverCardPosition" />

    <!-- 详情卡片（全屏时显示） -->
    <TrackDetailPanel v-if="isFullscreen" :visible="detailPanelVisible" :trackList="detailPanelTrackList"
      :currentTrackId="detailPanelTrackId" :trackInfo="detailPanelTrackInfo"
      @update:visible="detailPanelVisible = $event" @track-change="handleTrackChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, type PropType, nextTick } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ElIcon } from 'element-plus';
import { FullScreen, Close } from '@element-plus/icons-vue';
import { getSchemaInfoById } from '@/utils/schema';
import { getImageUrlById } from '@/utils/Image';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MARKER_CONSTANT, imageMarkerTranslateY } from '@/utils/constant'
import IconHTMLFactory, { IconType } from '@/utils/iconHTML';
import { useAppStore } from '@/store/appSchema';
import { useSchemaStore } from '@/store/schema';
import { getDefaultMapTile } from '@/components/mapSelector/defaultMap';
import trackService from '@/services/track';
import trackApi from '@/http/modules/track';
import TrackHoverCard from '@/components/trackHoverCard/TrackHoverCard.vue';
import TrackDetailPanel from '@/components/trackDetail/TrackDetailPanel.vue';

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
  // 是否展示全屏按钮
  showFullscreenButton: {
    type: Object as PropType<boolean>,
    default: true
  }
})

/**
 * 组件事件：marker点击事件
 */
const emit = defineEmits<{
  (e: 'markerClick', imageId: string): void
}>()

const appStore = useAppStore()
const schemaStore = useSchemaStore()
const mapContainer = ref<HTMLElement>()
const isFullscreen = ref(false)
let map: L.Map | null = null
const markers: L.Marker[] = []
let normalViewState: { center: L.LatLng; zoom: number } | null = null

const hoverCardVisible = ref(false)
const hoverCardPosition = ref({ x: 0, y: 0 })
const hoverTrackInfo = ref<any>(null)

const detailPanelVisible = ref(false)
const detailPanelTrackId = ref('')
const detailPanelTrackInfo = ref<any>(null)
const detailPanelTrackList = ref<any[]>([])
const loadedTrackInstances = ref<Set<any>>(new Set())
const mapInstanceIdMap = new WeakMap<L.Map, string>()
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
  }
}

function afterResizeTransition(callback: () => void) {
  // 与 .map 的 0.3s transition 对齐，避免在尺寸动画中间计算边界。
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
    normalViewState = {
      center: map.getCenter(),
      zoom: map.getZoom()
    }
    isFullscreen.value = true
    afterResizeTransition(() => {
      map?.invalidateSize()
      fitAllBounds()
    })
    return
  }

  isFullscreen.value = false
  afterResizeTransition(() => {
    if (!map) return
    map.invalidateSize()
    if (normalViewState) {
      map.setView(normalViewState.center, normalViewState.zoom, { animate: false })
    } else {
      fitAllBounds()
    }
  })
}

function getMapInstance(): L.Map | null {
  return map
}

/**
 * 获取当前地图瓦片URL
 * 优先使用默认瓦片（defaultTileId），其次使用激活的瓦片
 * @returns 瓦片URL字符串
 */
function getCurrentTileUrl(): String {
  // 获取激活的瓦片ID列表（从schemaStore获取）
  const activeTiles = schemaStore.getSchema?.mapInfo?.activeTiles ?? []
  // 获取用户自定义瓦片（从appStore获取）
  const customTiles = appStore.getAppSchema?.mapInfo?.mapTiles ?? []
  // 获取默认瓦片ID
  const defaultTileId = appStore.getAppSchema?.mapInfo?.defaultTileId ?? ''
  // 获取默认瓦片
  const defaultTiles = getDefaultMapTile()

  // 合并所有瓦片
  const allTiles = [...defaultTiles, ...customTiles]

  // 优先使用 defaultTileId 对应的瓦片
  if (defaultTileId && activeTiles.includes(defaultTileId)) {
    const defaultTile = allTiles.find(tile => tile.id === defaultTileId)
    if (defaultTile) {
      return defaultTile.url
    }
  }

  // 其次使用激活的瓦片中第一个
  const currentTile = allTiles.find(tile => activeTiles.includes(tile.id))

  // 返回瓦片URL，默认使用高德卫星图
  return currentTile?.url as string || defaultTiles[0]?.url
}

/**
 * 初始化地图
 * 创建Leaflet地图实例并添加瓦片图层
 */
async function initMap() {
  if (!mapContainer.value) return

  // 创建地图实例
  map = L.map(mapContainer.value, {
    zoomControl: false,      // 隐藏缩放控件
    attributionControl: false, // 隐藏归属信息
    minZoom: 3,
    maxZoom: 18
  })

  // 为当前地图实例生成唯一 ID
  mapInstanceIdMap.set(map, String(++mapIdCounter))

  // 添加瓦片图层，使用与主地图相同的瓦片
  const tileUrl = getCurrentTileUrl()
  L.tileLayer(tileUrl, {
    maxZoom: 19
  }).addTo(map)

  // 初始化标记
  await updateMarkers()

  await updateTracks()

  // 修复地图在隐藏容器中初始化时瓦片不加载的问题
  invalidateMapSize()
}

/**
 * 用于在地图容器显示后调用
 */
function invalidateMapSize() {
  setTimeout(() => {
    map?.invalidateSize()
  }, 100)
}

/**
 * 适配所有图层（标记和轨迹）的边界
 * 使所有内容都在地图可视区域内显示
 */
function fitAllBounds() {
  if (!map) return
  // 先使地图尺寸生效，确保边界计算正确
  map.invalidateSize()
  const allBounds: L.LatLngBoundsExpression[] = []

  // 获取所有marker的边界
  markers.forEach(marker => {
    const latlng = marker.getLatLng()
    allBounds.push([latlng.lat, latlng.lng])
  })

  // 获取地图上可见的轨迹的边界
  trackService.getInstances().forEach(instance => {
    const trackLayer = instance.getTrackLayer(map)
    if (trackLayer && map?.hasLayer(trackLayer)) {
      console.log('fitAllBounds found track layer:', trackLayer)
      allBounds.push(trackLayer.getBounds())
    }
  })

  console.log('fitAllBounds allBounds count:', allBounds.length)
  if (allBounds.length > 0) {
    const bounds = L.latLngBounds(allBounds)
    map.fitBounds(bounds, { padding: [10, 10] })
  } else {
    // 如果没有任何标记或轨迹，则使用默认中心和缩放级别
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  }
}

/**
 * 清除所有标记
 * 遍历markers数组，从地图上移除每个标记
 */
function clearMarkers() {
  markers.forEach(marker => {
    map?.removeLayer(marker)
  })
  markers.length = 0
}

/**
 * 高亮marker（hover效果）
 * 通过修改CSS transform实现放大效果，与大地图marker动效一致
 * 同时将marker的z-index提高，使其显示在最前面
 * @param marker Leaflet标记实例
 */
function highlightMarker(marker: L.Marker) {
  // 提高z-index使marker显示在最前面
  marker.setZIndexOffset(1000)

  const markerElement = marker.getElement();
  if (markerElement) {
    const oldTransformCss = markerElement.style.transform;
    let newTransformCss = "";
    if (oldTransformCss.includes("scale")) {
      // 如果已存在scale，则替换为hover比例
      newTransformCss = oldTransformCss
        .replace(
          /scale\([^)]*\)/,
          `scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`
        )
        .trim();
    } else {
      // 如果不存在scale，则添加hover比例
      newTransformCss = `${oldTransformCss} scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`;
    }
    markerElement.style.transform = newTransformCss;
  }
}

/**
 * 重置marker（取消hover效果）
 * 将scale恢复为正常比例，同时恢复z-index
 * @param marker Leaflet标记实例
 */
function resetMarker(marker: L.Marker) {
  // 恢复z-index
  marker.setZIndexOffset(0)

  const markerElement = marker.getElement();
  if (markerElement) {
    const oldTransformCss = markerElement.style.transform;
    const newTransformCss = oldTransformCss
      .replace(
        /scale\([^)]*\)/,
        `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`
      )
      .trim();
    markerElement.style.transform = newTransformCss;
  }
}

/**
 * 更新地图标记
 * 根据图片的GPS信息添加marker，并添加hover事件监听
 */
async function updateMarkers() {
  if (!map) return

  // 清除现有标记
  clearMarkers()

  // 收集有GPS信息的图片
  const validImages: { id: string; lat: number; lng: number }[] = []

  for (const imgId of props.imageIds) {
    const imageInfoDetail = getSchemaInfoById(imgId) as any
    if (imageInfoDetail) {
      const GPSInfo = imageInfoDetail.GPSInfo || {}
      // 检查GPS坐标是否有效
      if (GPSInfo.GPSLatitude && GPSInfo.GPSLongitude) {
        validImages.push({
          id: imgId,
          lat: GPSInfo.GPSLatitude,
          lng: GPSInfo.GPSLongitude
        })
      }
    }
  }

  // 为每张图片创建marker
  for (const img of validImages) {
    // 获取图片URL
    const imageUrl = await getImageUrlById(img.id)
    let icon: L.DivIcon

    if (imageUrl) {
      // 有图片的情况
      icon = L.divIcon({
        html: IconHTMLFactory.createIcon(IconType.SingleImage, imageUrl),
        iconUrl: imageUrl,
        iconSize: MARKER_CONSTANT.IMAGE_MARKER_SIZE,
        iconAnchor: [MARKER_CONSTANT.IMAGE_MARKER_SIZE[0] / 2, imageMarkerTranslateY]
      })
    } else {
      // 无图片的情况
      const imageInfoDetail = getSchemaInfoById(img.id) as any
      icon = L.divIcon({
        html: IconHTMLFactory.createIcon(IconType.NoImage, imageInfoDetail?.name || '无'),
        iconSize: MARKER_CONSTANT.IMAGE_MARKER_SIZE,
        iconAnchor: [MARKER_CONSTANT.IMAGE_MARKER_SIZE[0] / 2, imageMarkerTranslateY]
      })
    }

    // 创建marker
    const marker = L.marker([img.lat, img.lng], {
      icon,
      title: getSchemaInfoById(img.id)?.name || ''
    })

    // 点击事件：显示图片详情
    marker.on('click', () => {
      emit('markerClick', img.id)
    })

    // hover事件：与大地图marker一致的动效
    marker.on('mouseover', () => {
      highlightMarker(marker)
    })
    marker.on('mouseout', () => {
      resetMarker(marker)
    })

    // 添加到地图
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

  const targetTrackIds = props.trackIds || []
  const normalizedTargetIds = targetTrackIds.map(id => normalizeTrackId(id))

  // 先隐藏不在目标列表中的轨迹
  trackService.getInstances().forEach(instance => {
    const trackLayer = instance.getTrackLayer(map)
    if (!trackLayer) return
    const isTarget = normalizedTargetIds.includes(normalizeTrackId(instance.getTrackId()))
    if (!isTarget && map?.hasLayer(trackLayer)) {
      map.removeLayer(trackLayer)
    }
  })

  // 预加载所有轨迹到详情面板列表
  detailPanelTrackList.value = []
  loadedTrackInstances.value.clear()

  // 再确保目标轨迹都已加载并显示到当前地图
  for (const trackId of targetTrackIds) {
    const instance = await ensureTrackLoaded(trackId)
    if (instance) {
      if (loadedTrackInstances.value.has(instance)) {
        continue
      }
      loadedTrackInstances.value.add(instance)

      instance.addMap(map)

      const mapId = mapInstanceIdMap.get(map) || 'unknown'
      const instanceId = trackId + '_' + mapId

      if (!detailPanelTrackList.value.find(t => t.instanceId === instanceId)) {
        instance.onTrackInfoReady((info) => {
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

      instance.setHoverCallback(map, (info, event) => {
        if (event === 'enter') {
          hoverCardVisible.value = true
          hoverTrackInfo.value = info
        } else {
          hoverCardVisible.value = false
        }
      })

      instance.setClickCallback(map, (info) => {
        console.log('Click callback triggered for track:', trackId, 'instanceId:', instanceId)
        if (!isFullscreen.value) {
          console.log('Not fullscreen, skipping');
          return
        }
        if (currentSelectedInstance && currentSelectedInstance !== instance) {
          console.log('Unhighlighting previous instance');
          currentSelectedInstance.unhighlight()
        }
        const mapId = mapInstanceIdMap.get(map)
        console.log('Highlighting track, mapId:', mapId);
        instance.highlight(map, instanceId)
        currentSelectedInstance = instance
        detailPanelTrackId.value = instanceId
        detailPanelTrackInfo.value = { instanceId, id: trackId, instance, ...info }
        detailPanelVisible.value = true
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
    const res = await trackApi.getTrack(trackId)
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

// 监听轨迹ID变化，更新轨迹显示
watch(() => props.trackIds, () => {
  updateTracks()
}, { deep: true, immediate: true })

// 监听详情面板关闭，取消高亮
watch(detailPanelVisible, (newVal) => {
  if (!newVal && currentSelectedInstance) {
    currentSelectedInstance.unhighlight()
    currentSelectedInstance = null
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

.fullscreen-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1000;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fullscreen-btn:hover {
  background: #fff;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.fullscreen-btn:active {
  transform: scale(0.95);
}
</style>
