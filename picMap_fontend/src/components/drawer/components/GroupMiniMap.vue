<!--
 * @Author: Do not edit
 * @Date: 2026-03-04
 * @LastEditTime: 2026-03-04 23:24:15
 * @FilePath: \PicMap\picMap_fontend\src\components\drawer\components\GroupMiniMap.vue
 * @Description: 分组小地图组件
 *   - 使用Leaflet展示分组中图片的位置
 *   - 与主地图使用相同的瓦片
 *   - 点击marker显示图片详情
 *   - hover时有大地图marker相同的动效
-->
<template>
  <div class="group-mini-map" ref="mapContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getSchemaInfoById } from '@/utils/schema';
import { getImageUrlById } from '@/utils/Image';
import { MARKER_CONSTANT, imageMarkerTranslateY } from '@/utils/constant'
import IconHTMLFactory, { IconType } from '@/utils/iconHTML';
import { useAppStore } from '@/store/appSchema';
import { useSchemaStore } from '@/store/schema';
import { getDefaultMapTile } from '@/components/mapSelector/defaultMap';

/**
 * 组件props：图片ID列表
 */
const props = defineProps<{
  imageIds: string[]
}>()

/**
 * 组件事件：marker点击事件
 */
const emit = defineEmits<{
  (e: 'markerClick', imageId: string): void
}>()

const appStore = useAppStore()
const schemaStore = useSchemaStore()
const mapContainer = ref<HTMLElement>()
let map: L.Map | null = null
const markers: L.Marker[] = []

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
    minZoom: 1,
    maxZoom: 18
  })

  // 添加瓦片图层，使用与主地图相同的瓦片
  const tileUrl = getCurrentTileUrl()
  L.tileLayer(tileUrl, {
    maxZoom: 19
  }).addTo(map)

  // 初始化标记
  await updateMarkers()
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

  // 自动调整视图范围以显示所有图片
  if (validImages.length > 0) {
    const lats = validImages.map(img => img.lat)
    const lngs = validImages.map(img => img.lng)
    const bounds = L.latLngBounds([
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ])
    map.fitBounds(bounds, { padding: [50, 50] })
  }
}

// 监听图片ID变化，更新标记
watch(() => props.imageIds, () => {
  updateMarkers()
}, { deep: true })

// 组件挂载时初始化地图
onMounted(() => {
  initMap()
})

// 组件卸载时清理地图实例
onUnmounted(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<style scoped>
.group-mini-map {
  width: 100%;
  height: 100%;
}
</style>
