/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:08:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-27 21:12:43
 * @FilePath: \Code\picMap_fontend\src\utils\map.js
 * @Description:
 */
import L from 'leaflet'

const NO_IMAGE_MARKER_SIZE = [40, 30]

/**
 * @description: 添加图片到地图中
 * @param {*} map
 * @param {*} imageUrl
 * @return {*}
 */
export function addImageIconToMap(map, imageInfo) {
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
    L.marker([imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude], {
      icon: myIcon,
      title: imageInfo.name
    }).addTo(map)
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
  const myIcon = L.divIcon({ html: noImageUrlIcon(groupInfo.name), iconSize: NO_IMAGE_MARKER_SIZE })
  // 先纬度再经度
  L.marker([groupInfo.GPSInfo.GPSLatitude, groupInfo.GPSInfo.GPSLongitude], {
    icon: myIcon,
    title: groupInfo.name
  }).addTo(map)
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
