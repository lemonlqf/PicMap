/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:08:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-16 17:25:13
 * @FilePath: \Code\picMap_fontend\src\utils\map.js
 * @Description:
 */
import L from 'leaflet'
import { useMapStore } from '@/store/map'
import imageHttp from '@/http/modules/image'
import eventBus from '@/utils/eventBus'
import { judgeHadUploadImage } from '@/utils/schema.js'
import { nextTick } from 'vue'
import { ElMessage } from 'element-plus'

const NO_IMAGE_MARKER_SIZE = [40, 40]
// marker向上偏移的量
const markerTranslateY = NO_IMAGE_MARKER_SIZE[1]

export let MARKER_SHOW_RADIO = 1
export let MARKER_HOVER_SHOW_RADIO = 1.3

/**
 * @description: 添加图片到地图中
 * @param {*} map
 * @param {*} imageUrl
 * @return {*}
 */
export function addImageIconToMap(map, imageInfo) {
  const mapStore = useMapStore()

  let myIcon = null
  // 如果没有url直接用文字名称代替
  if (!imageInfo?.url) {
    myIcon = L.divIcon({
      html: noImageUrlIcon(imageInfo.name),
      iconSize: NO_IMAGE_MARKER_SIZE,
      iconAnchor: [NO_IMAGE_MARKER_SIZE[0] / 2, markerTranslateY] // 设置锚点为底部中心
    })
  } else {
    myIcon = L.divIcon({
      // 传值使用
      iconUrl: imageInfo.url,
      html: imageUrlIcon(imageInfo.url),
      iconSize: NO_IMAGE_MARKER_SIZE,
      iconAnchor: [NO_IMAGE_MARKER_SIZE[0] / 2, markerTranslateY] // 设置锚点为底部中心
    })
  }
  if (imageInfo.GPSInfo.GPSLatitude && imageInfo.GPSInfo.GPSLongitude) {
    const isExist = mapStore.getVisibleMarkerIdList.some(markerId => {
      return markerId === imageInfo.id
    })
    if (!isExist) {
      // 如果还没有需要新建，传参先纬度再经度
      const marker = L.marker([imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude], {
        icon: myIcon,
        title: imageInfo.name,
        type: 'image',
        riseOnHover: true,
        id: imageInfo.id
      })
      marker.addTo(map)
      // 添加id到store中
      mapStore.addMarkerId(imageInfo.id)
    } else {
      // 如果已经有了就复用
      const markerId = mapStore.getVisibleMarkerIdList.find(markerId => {
        return markerId === imageInfo.id
      })
      const marker = getMarkerById(markerId, map)
      marker.setIcon(myIcon)
    }
  }
}

/**
 * @description: 添加可移动的图标
 * @param {*} map
 * @param {*} imageInfo
 * @return {*}
 */
export function addManualLocateImageToMap(map, imageInfo, lat, Lng) {
  let myIcon = null
  // 如果没有url直接用文字名称代替
  if (!imageInfo?.url) {
    myIcon = L.divIcon({
      html: noImageUrlIcon(imageInfo.name),
      iconSize: NO_IMAGE_MARKER_SIZE,
      iconAnchor: [NO_IMAGE_MARKER_SIZE[0] / 2, markerTranslateY] // 设置锚点为底部中心
    })
  } else {
    myIcon = L.divIcon({
      // 传值使用
      iconUrl: imageInfo.url,
      html: imageUrlIcon(imageInfo.url),
      iconSize: NO_IMAGE_MARKER_SIZE,
      iconAnchor: [NO_IMAGE_MARKER_SIZE[0] / 2, markerTranslateY] // 设置锚点为底部中心
    })
  }
  // 地图中心
  const markerLatLng = lat && Lng ? [lat, Lng] : [map.getCenter().lat, map.getCenter().lng]
  const marker = L.marker(markerLatLng, {
    icon: myIcon,
    title: imageInfo.name,
    type: 'image',
    riseOnHover: true,
    id: imageInfo.id,
    draggable: true
  })
  marker.addTo(map)
  return marker
}

/**
 * @description: 删除地图中的marker
 * @param {*} marker
 * @return {*}
 */
export function deleteMarkerInMap(marker, map) {
  const mapStore = useMapStore()
  if (map && marker) {
    map.removeLayer(marker)
    mapStore.deleteMarker(marker)
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
  const myIcon = L.divIcon({
    html: noImageUrlIcon(groupInfo.name),
    iconSize: NO_IMAGE_MARKER_SIZE,
    iconAnchor: [NO_IMAGE_MARKER_SIZE[0] / 2, markerTranslateY]
  })
  // 先纬度再经度
  const marker = L.marker([groupInfo.GPSInfo.GPSLatitude, groupInfo.GPSInfo.GPSLongitude], {
    icon: myIcon,
    title: groupInfo.name,
    type: 'group',
    riseOnHover: true,
    id: groupInfo.id
  })
  marker.addTo(map)
  // 添加到store中
  mapStore.addMarkerId(groupInfo.id)
}

/**
 * @description: 监听地图改变事件，用于更新marker
 * @param {*} map
 * @return {*}
 */
export function observeMapChangeToUpgradeMarker(map) {
  map.on('moveend', () => {
    // 更新在可视范围内marker的图片
    updateVisibleMarkers(map)
  })
  map.on('movestart', () => {
    // 隐藏所有右击出现的弹框
    eventBus.emit('hidden-content-menu')
  })
  // 地图缩放改变marker大小
  map.on('zoomend', () => {
    scaleMarkerByMap(map)
  })
}

/**
 * @description: 点击地图时，关闭图片信息抽屉
 * @param {*} map
 * @return {*}
 */
export function hiddenImageInfoDrawerMapClick(map) {
  map.on('click', () => {
    // 点击地图时，关闭图片详细信息抽屉
    eventBus.emit('drawer-hidden')
  })
}

/**
 * @description: 更新在可视范围内marker的图片,防抖
 * @param {*} map
 * @return {*}
 */
export function updateVisibleMarkers(map) {
  const mapStore = useMapStore()
  const visibleMarkerIdList = mapStore.getVisibleMarkerIdList
  const getMarkerIdList = mapStore.getMarkerIdList
  getMarkerIdList.forEach(markerId => {
    const marker = getMarkerById(markerId, map)
    if (marker && isMarkerInView(marker.getLatLng(), map)) {
      if (!visibleMarkerIdList.includes(markerId)) {
        if (marker.options.type === 'image') {
          // 更新一下marker
          updateMarker(marker, map)
        }
        addVisibleMarker(markerId, map)
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
 * @description: 更新marker，用于渲染图片等
 * @param {*} id
 * @param {*} newMarkerData
 * @return {*}
 */
function updateMarker(marker, map) {
  const mapStore = useMapStore()
  // 将marker添加到已经渲染的store中
  const index = mapStore.getVisibleMarkerIdList.findIndex(markerId => markerId === marker.options.id)
  // 判断是否在schema中
  const isInSchema = judgeHadUploadImage(marker.options.id)
  if (index === -1 && marker?.options?.divIcon?.options?.iconUrl) {
    // 如果本身就有照片了，那就不用请求图片了（这种情况出现在获取图片后手动上传时，此时已有图片）
    return
  }
  // move地图后请求图片数据
  if (index === -1 && isInSchema) {
    imageHttp.getImage({ imageId: marker.options.id }).then(res => {
      if (res.code !== 200) {
        // 如果没有请求成功需要先删除掉
        mapStore.deleteVisbleMarkerId(marker.options.id)
        return
      }
      const fileUrl = fileToBase64(res.data.file)
      const myIcon = L.divIcon({
        html: imageUrlIcon(fileUrl),
        // 传值使用
        iconUrl: fileUrl,
        iconSize: NO_IMAGE_MARKER_SIZE,
        iconAnchor: [NO_IMAGE_MARKER_SIZE[0] / 2, markerTranslateY] // 设置锚点为底部中心
      })
      marker.setIcon(myIcon)
    })
  }
}

/**
 * @description: 根据地图缩放比例适当缩放marker
 * @param {*} map
 * @return {*}
 */
function scaleMarkerByMap(map) {
  const mapStore = useMapStore()
  const markerIdList = mapStore.getVisibleMarkerIdList
  const zoom = map.getZoom()
  if (zoom >= 15) {
    MARKER_SHOW_RADIO = 1.4
    MARKER_HOVER_SHOW_RADIO = 1.6
  } else if (zoom < 15 && zoom >= 12) {
    MARKER_SHOW_RADIO = 1.2
    MARKER_HOVER_SHOW_RADIO = 1.6
  } else if (zoom < 10 && zoom >= 8) {
    MARKER_SHOW_RADIO = 0.8
    MARKER_HOVER_SHOW_RADIO = 1.3
  } else if (zoom < 8 && zoom >= 6) {
    MARKER_SHOW_RADIO = 0.6
    MARKER_HOVER_SHOW_RADIO = 1.2
  } else if (zoom < 6) {
    MARKER_SHOW_RADIO = 0.4
    MARKER_HOVER_SHOW_RADIO = 1.1
  }
  markerIdList.forEach(markerId => {
    const marker = getMarkerById(markerId, map)
    const markerElement = marker.getElement()
    if (markerElement) {
      const originalTransform = window.getComputedStyle(markerElement).transform
      const newTransform = originalTransform.replace(/scale\([^)]*\)/, '').trim() + ` scale(${MARKER_SHOW_RADIO})`
      markerElement.style.transform = newTransform
    }
  })
}

// 高亮marker
export function highlightMarker(marker) {
  const markerElement = marker.getElement()
  if (markerElement) {
    const oldTransformCss = markerElement.style.transform
    let newTransformCss = ''
    if (oldTransformCss.includes('scale')) {
      newTransformCss = oldTransformCss.replace(/scale\([^)]*\)/, `scale(${MARKER_HOVER_SHOW_RADIO})`).trim()
    } else {
      newTransformCss = `${oldTransformCss} scale(${MARKER_HOVER_SHOW_RADIO})`
    }
    markerElement.style.transform = newTransformCss
  }
}

// 将marker回复会原来的样式
export function resetMarker(marker) {
  const markerElement = marker.getElement()
  if (markerElement) {
    const oldTransformCss = markerElement.style.transform
    const newTransformCss = oldTransformCss.replace(/scale\([^)]*\)/, `scale(${MARKER_SHOW_RADIO})`).trim()
    markerElement.style.transform = newTransformCss
  }
}

/**
 * @description: 将后端返回的各种类型的文件转换为Base64字符串
 * @param {ArrayBuffer} buffer
 * @return {string}
 */
export function fileToBase64(file) {
  let fileUrl
  if (file?.type === 'Buffer') {
    let binary = ''
    const bytes = new Uint8Array(file?.data)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    fileUrl = `data:image/jpeg;base64,${window.btoa(binary)}`
  } else {
    fileUrl = `data:image/jpeg;base64,${file}`
  }
  return fileUrl
}

/**
 * @description: 无图片时的icon
 * @param {*} text
 * @return {*}
 */
function noImageUrlIcon(text) {
  const locationDiv = document.createElement('div')
  locationDiv.className = 'location'
  const div = document.createElement('div')
  div.appendChild(locationDiv)
  div.className = 'no-image-icon'
  div.innerHTML = text
  div.style.lineHeight = markerTranslateY + 'px'
  return div
}

/**
 * @description: 有图片时的icon
 * @param {*} text
 * @return {*}
 */
function imageUrlIcon(imgUrl) {
  const locationDiv = document.createElement('div')
  locationDiv.className = 'location'
  const div = document.createElement('div')
  div.appendChild(locationDiv)
  const img = document.createElement('img')
  img.width = `${NO_IMAGE_MARKER_SIZE[0]}`
  img.height = `${markerTranslateY}`
  img.src = imgUrl
  div.className = 'no-image-icon'
  div.appendChild(img)
  return div
}

/**
 * @description: 根据id获取地图中的marker
 * @param {*} id
 * @return {*}
 */
export function getMarkerById(markerId, map) {
  let foundMarker;
  map.eachLayer?.(layer => {
    if (layer instanceof L.Marker && layer.options.id === markerId) {
      foundMarker = layer;
    }
  });
  return foundMarker;
}

/**
 * @description: 定位到当前marker
 * @param {*} lat
 * @param {*} lng
 * @return {*}
 */
export function setView(lat, lng, map, id) {
  if (map) {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom() ?? 10, {
        animate: true,
        duration: 0.5 // 动画持续时间，单位为秒
      })
      return
    }
    if (id) {
      const marker = getMarkerById(id, map)
      const { lat, lng } = marker?.getLatLng?.()
      map.setView([lat, lng], map.getZoom() ?? 10, {
        animate: true,
        duration: 0.5 // 动画持续时间，单位为秒
      })
      return
    }
  }
}

/**
 * @description: 添加可视marker到store，并且更新实例，实现左键右键等功能
 * @param {*} markerId
 * @param {*} map
 * @return {*}
 */
export function addVisibleMarker(markerId, map) {
  const mapStore = useMapStore()
  mapStore.addVisibleMarkerId(markerId)
  const marker = getMarkerById(markerId, map)
  // 添加点击事件监听，这里的mouseEvent的target中有marker信息
  marker.on('click', event => {
    ElMessage.success('触发Marker点击事件')
    // 点击节点后弹出图片详情框
    eventBus.emit('show-image-data', event)
  })
  // 添加右击时间监听
  marker.on('contextmenu', event => {
    ElMessage.success('触发Marker右键事件')
    // 出现右键菜单
    eventBus.emit('show-content-menu', event)
  })
  // 高亮
  marker.on('mouseover', () => {
    highlightMarker(marker)
  })
  // 取消高亮
  marker.on('mouseout', () => {
    resetMarker(marker)
  })
}
