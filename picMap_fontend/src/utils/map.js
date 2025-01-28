/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:08:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-28 14:29:39
 * @FilePath: \Code\picMap_fontend\src\utils\map.js
 * @Description:
 */
import L from 'leaflet'
import { useMapStore } from '@/store/map'

const NO_IMAGE_MARKER_SIZE = [40, 30]

/**
 * @description: 添加图片到地图中
 * @param {*} map
 * @param {*} imageUrl
 * @return {*}
 */
export function addImageIconToMap(map, imageInfo) {
  const mapStore = useMapStore()
  try {
    let myIcon = null
    // 如果没有url直接用文字名称代替
    if (!imageInfo?.url) {
      myIcon = L.divIcon({
        html: noImageUrlIcon(imageInfo.name),
        iconSize: NO_IMAGE_MARKER_SIZE
      })
    } else {
      myIcon = L.icon({
        iconUrl: imageInfo.url,
        iconSize: NO_IMAGE_MARKER_SIZE
      })
    }

    // 先纬度再经度
    const marker = L.marker([imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude], {
      icon: myIcon,
      title: imageInfo.name,
      id: imageInfo.id
    }).addTo(map)
    // 添加到store中
    mapStore.addMarker(marker)
  } catch (error) {
    console.error('addImageIconToMap error:', error)
  }
}

/**
 * @description: 添加分组到地图中
 * @param {*} map
 * @param {*} groupInfo
 * @return {*}
 */
export function addGroupIconToMap(map, groupInfo) {
  const mapStore = useMapStore()
  const myIcon = L.divIcon({ html: noImageUrlIcon(groupInfo.name), iconSize: NO_IMAGE_MARKER_SIZE })
  // 先纬度再经度
  const marker = L.marker([groupInfo.GPSInfo.GPSLatitude, groupInfo.GPSInfo.GPSLongitude], {
    icon: myIcon,
    title: groupInfo.name,
    id: groupInfo.id
  }).addTo(map)
  // 添加到store中
  mapStore.addMarker(marker)
}

/**
 * @description: 监听地图移动事件，用于更新marker
 * @param {*} map
 * @return {*}
 */
export function observeMapMoveToUpgradeMarker(map) {
  map.on('moveend', () => {
    // 更新在可视范围内marker的图片
    updateVisibleMarkers(map)
  })
}

/**
 * @description: 更新在可视范围内marker的图片
 * @param {*} map
 * @return {*}
 */
function updateVisibleMarkers(map) {
  const mapStore = useMapStore()
  const visibleMarkers = mapStore.getVisibleMarker
  const markers = mapStore.getMarker
  markers.forEach(marker => {
    if (isMarkerInView(marker.getLatLng(), map)) {
      if (!visibleMarkers.includes(marker)) {
        // 更新一下marker
        updateMarker(marker)
      }
    }
  })
}

/**
 * @description: 判断当前marker是否在地图可视范围内
 * @param {*} markerLatLng marker.getLatLng()获取marker的经纬度
 * @param {*} map
 * @return {*}
 */
function isMarkerInView(markerLatLng, map) {
  // 获取地图的可视范围
  const bounds = map.getBounds()
  // marker.getLatLng()获取marker的经纬度
  return bounds.contains(markerLatLng)
}

/**
 * @description: 更新marker，用于渲染如片等
 * @param {*} id
 * @param {*} newMarkerData
 * @return {*}
 */
function updateMarker(marker, newMarkerData) {
  const mapStore = useMapStore()
  const index = mapStore.getMarker.findIndex(item => item.options.id === marker.options.id)
  if (index !== -1) {
    // TODO:渲染图片操作
    // this.markers[index] = { ...this.markers[index], ...newMarkerData };
    // 将marker添加到已经渲染的store中
    mapStore.addVisibleMarker(marker)
  }
}

/**
 * @description: 无图片时的icon
 * @param {*} text
 * @return {*}
 */
function noImageUrlIcon(text) {
  const div = document.createElement('div')
  div.className = 'no-image-icon'
  div.innerHTML = text
  div.style.lineHeight = NO_IMAGE_MARKER_SIZE[1] + 'px'
  return div
}
