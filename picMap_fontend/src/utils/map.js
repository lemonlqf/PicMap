import L from 'leaflet'

const MARKER_SIZE = [40, 40]

/**
 * @description: 添加图片到地图中
 * @param {*} map
 * @param {*} imageUrl
 * @return {*}
 */
export function addImageIconToMap(map, imageInfo) {
  let myIcon
  // 如果没有url直接用文字名称代替
  if (!imageInfo?.file?.url) {
    const span = document.createElement('span')
    span.innerHTML = imageInfo.name
    myIcon = L.icon({
      html: span,
      iconSize: MARKER_SIZE
    })
  } else {
    myIcon = L.icon({
      iconUrl: imageInfo.file.url,
      iconSize: MARKER_SIZE
    })
  }

  // 先纬度再经度
  L.marker([imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude], { icon: myIcon }).addTo(map)
}

/**
 * @description: 添加分组到地图中
 * @param {*} map
 * @param {*} groupInfo
 * @return {*}
 */
export function addGroupIconToMap(map, groupInfo) {
  const span = document.createElement('span')
  span.innerHTML = groupInfo.name
  const myIcon = L.divIcon({ html: span, iconSize: MARKER_SIZE })
  // 先纬度再经度
  L.marker([groupInfo.GPSInfo.GPSLatitude, groupInfo.GPSInfo.GPSLongitude], { icon: myIcon }).addTo(map)
}
