import L from 'leaflet'

const MARKER_SIZE = [40, 40]

/**
 * @description: 添加图片到地图中
 * @param {*} map
 * @param {*} imageUrl
 * @return {*}
 */
export function addImageToMap(map, imageInfo) {
  const myIcon = L.icon({
    iconUrl: imageInfo.file.url,
    iconSize: MARKER_SIZE
  })
  // 先纬度再经度
  L.marker([imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude], { icon: myIcon }).addTo(map)
}
