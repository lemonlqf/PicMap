/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:08:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 20:51:21
 * @FilePath: \Code\picMap_fontend\src\utils\map.js
 * @Description:
 */
import L from 'leaflet'
import { useMapStore } from '@/store/map'
import imageHttp from '@/http/modules/image'
import eventBus from '@/utils/eventBus'
import { judgeHadUploadImage } from '@/utils/schema.js'

const NO_IMAGE_MARKER_SIZE = [40]

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
      iconSize: NO_IMAGE_MARKER_SIZE
    })
  } else {
    myIcon = L.icon({
      iconUrl: imageInfo.url,
      iconSize: NO_IMAGE_MARKER_SIZE
    })
  }
  if (imageInfo.GPSInfo.GPSLatitude && imageInfo.GPSInfo.GPSLongitude) {
    const isExist = mapStore.getVisibleMarkers.some(item => {
      return item.options.id === imageInfo.id
    })
    if (!isExist) {
      // 如果还没有需要新建，传参先纬度再经度
      const marker = L.marker([imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude], {
        icon: myIcon,
        title: imageInfo.name,
        type: 'image',
        id: imageInfo.id
      }).addTo(map)
      // 添加到store中
      mapStore.addMarker(marker)
    } else {
      // 如果已经有了就复用
      const marker = mapStore.getVisibleMarkers.find(item => {
        return item.options.id === imageInfo.id
      })
      marker.setIcon(myIcon)
    }
  }
}

/**
 * @description: 删除地图中的marker
 * @param {*} marker
 * @return {*}
 */
export function deleteMarkerInMap(marker, map) {
  if (map && marker) {
    map.removeLayer(marker)
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
    type: 'group',
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
  map.on('movestart', () => {
    // 隐藏所有右击出现的弹框
    eventBus.emit('hidden-content-menu')
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
  const visibleMarkers = mapStore.getVisibleMarkers
  const markers = mapStore.getMarkers
  markers.forEach(marker => {
    if (isMarkerInView(marker.getLatLng(), map)) {
      if (!visibleMarkers.includes(marker)) {
        if (marker.options.type === 'image') {
          // 更新一下marker
          updateMarker(marker, map)
        }
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
  // TODO:将marker添加到已经渲染的store中
  const index = mapStore.getVisibleMarkers.findIndex(item => item.options.id === marker.options.id)
  // 判断是否在schema中
  const isInSchema = judgeHadUploadImage(marker.options.id)
  if (index === -1 && marker?.options?.icon?.options?.iconUrl) {
    // 如果本身就有照片了，那就不用请求图片了（这种情况出现在获取图片后手动上传时，此时已有图片）
    mapStore.addVisibleMarker(marker)
    return
  }
  // move地图后请求图片数据
  if (index === -1 && isInSchema) {
    mapStore.addVisibleMarker(marker)
    imageHttp.getImage({ imageId: marker.options.id }).then(res => {
      if (res.code !== 200) {
        // 如果没有请求成功需要先删除掉
        mapStore.deleteVisbleMarker(marker)
        return
      }
      const fileUrl = fileToBase64(res.data.file)
      const myIcon = L.icon({
        iconUrl: fileUrl,
        iconSize: NO_IMAGE_MARKER_SIZE
      })
      marker.setIcon(myIcon)
    })
  }
}

/**
 * @description: 将后端返回的各种类型的文件转换为Base64字符串
 * @param {ArrayBuffer} buffer
 * @return {string}
 */
function fileToBase64(file) {
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
  const div = document.createElement('div')
  div.className = 'no-image-icon'
  div.innerHTML = text
  div.style.lineHeight = NO_IMAGE_MARKER_SIZE[1] + 'px'
  return div
}

/**
 * @description: 根据id获取marker
 * @param {*} id
 * @return {*}
 */
export function getMarkerById(id) {
  const mapStore = useMapStore()
  const markers = mapStore.getMarkers
  let res
  markers.forEach(marker => {
    if (marker.options.id === id) {
      res = marker
    }
  })
  return res
}

/**
 * @description: 定位到当前marker
 * @param {*} lat
 * @param {*} lng
 * @return {*}
 */
export function setView(lat, lng, map) {
  if (map) {
    map.setView([lat, lng], map.getZoom() ?? 10, {
      animate: true,
      duration: 0.5 // 动画持续时间，单位为秒
    })
  }
}
