/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:08:00
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-05-31 14:34:35
 * @FilePath: \Code\picMap_fontend\src\utils\map.ts
 * @Description:
 */
import { nextTick } from 'vue'
import L from 'leaflet'
import { ElMessage } from 'element-plus'
import { getImageUrl } from './Image'
import imageHttp from '@/http/modules/image'
import { useMapStore } from '@/store/map'
import { useSchemaStore } from '@/store/schema'
import eventBus from '@/utils/eventBus'
import { judgeHadUploadImage } from '@/utils/schema'
import { getImageUrlById, getImageUrlByIds } from '@/utils/Image'
import type { IHttpResponse } from '@/type/http'
import type { INewimageFormData, IGPSInfo, IImageInfo, INewGroupFormData, IGroupInfo } from '@/type/schema'
import type { IMarker } from '@/type/image'

import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';


// 最大放到18
export const MAX_ZOOM = 18
// 最小3
export const MIN_ZOOM = 3

// 创建聚合组
export const markerClusters = L.markerClusterGroup({
  // spiderfyOnMaxZoom: false,
  maxClusterRadius: 20,
  // 缩放比例为MAX_ZOOM时不在成簇
  disableClusteringAtZoom: MAX_ZOOM,
  // 样式
  // iconCreateFunction: function (cluster: any) {
  //   return L.divIcon({ html: '<b>' + cluster.getChildCount() + '</b>' });
  // }
});



// 分组的marker封面图片的数量
export const GROUP_COVER_NUMBER = 4
// 正常图片的marker大小
export const IMAGE_MARKER_SIZE = [40, 40]
// 分组的marker大小
export const GROUP_MARKER_SIZE = [60, 60]
// marker向上偏移的量
export const imageMarkerTranslateY = IMAGE_MARKER_SIZE[1]
// 分组marker向上偏移的量
export const groupMarkerTranslateY = GROUP_MARKER_SIZE[1]

// 放大比例
export let MARKER_SHOW_RADIO = 1
// 鼠标悬停时的放大比例
export let MARKER_HOVER_SHOW_RADIO = 1.3
// 地图实例
export let MAP_INSTANCE: any

export function setMapInstance(map: any) {
  MAP_INSTANCE = map
}

export function getGPSInfoByMarkerInstance(marker: L.Marker): IGPSInfo {
  if (!marker) {
    ElMessage.error('没有传入marker实例')
    return { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 }
  }
  const { lat, lng, alt } = marker.getLatLng()
  const GPSLatitude = lat
  const GPSLongitude = lng
  const GPSAltitude = alt
  return {
    GPSAltitude,
    GPSLongitude,
    GPSLatitude
  }
}

/**
 * @description: 获取所有marker
 * @return {*}
 */
function getAllMarkers(): L.Marker[] {
  const markers: L.Marker[] = [];
  MAP_INSTANCE.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      markers.push(layer);
    }
  });
  return markers;
}

/**
 * @description: 添加图片到地图中
 * @param {*} map
 * @param {*} imageUrl
 * @return {*}
 */
export function addImageMarkerToMap(imageInfo) {
  const map = MAP_INSTANCE
  const mapStore = useMapStore()
  const myIcon = createImageMarkerIcon(imageInfo)
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
      markerClusters.addLayer(marker);
      // 添加聚合组到地图
      map.addLayer(markerClusters);
      // marker.addTo(map)
      // 添加id到store中
      mapStore.addMarkerId(imageInfo.id)
    } else {
      // 如果已经有了就复用
      const markerId = mapStore.getVisibleMarkerIdList.find(markerId => {
        return markerId === imageInfo.id
      })
      const marker = getMarkerById(markerId, map)
      marker?.setIcon(myIcon)
    }
  }
}

/**
 * @description: 添加分组到地图中
 * @param {*} map
 * @param {*} groupInfo
 * @return {*}
 */
export async function addGroupMarkerToMap(groupInfo: IGroupInfo) {
  const GPSInfo = groupInfo.GPSInfo
  // 定位无效，直接不加
  if (!GPSInfoLegality(GPSInfo)) {
    return
  }
  const map = MAP_INSTANCE
  const mapStore = useMapStore()
  let myIcon = await createGroupMarkerIcon(groupInfo)
  // 先纬度再经度
  const marker = L.marker([GPSInfo.GPSLatitude, GPSInfo.GPSLongitude], {
    icon: myIcon,
    title: groupInfo.name,
    type: 'group',
    riseOnHover: true,
    id: groupInfo.id
  })
  marker.addTo(map)
  // 因为涉及到异步请求数据了，所以这里需要手动添加一下鼠标事件
  markerMouseListener(marker)
  // 添加到store中
  mapStore.addMarkerId(groupInfo.id)
}

/**
 * @description: 通过图片id添加已有的图片到地图，并修改visibleMarkerIdList
 * @param {*} map
 * @param {*} imageId
 * @return {*}
 */
export function addExistImageToMapById(imageId: string) {
  const schemaStore = useSchemaStore()
  const mapStore = useMapStore()
  // 如果本来没有
  if (!mapStore.visibleMarkerIdList.includes(imageId)) {
    const imageInfo = schemaStore?.getSchema?.imageInfo?.filter?.(item => item.id === imageId)[0]
    if (imageInfo) {
      addImageMarkerToMap(imageInfo)
    } else {
      console.error('不存在图片信息')
      return
    }
    // 用这个方法，有些特殊操作
    addVisibleMarkerById(imageId)
  } else {
    showMarkerById(imageId)
  }
}

/**
 * @description: 添加可移动的图片marker
 * @param {*} imageInfo
 * @return {*}
 */
export function addManualLocateImageToMap(imageInfo: IImageInfo, lat?: number, Lng?: number) {
  // 先判断一下是不是有marker了
  const marker1 = getMarkerById(imageInfo.id)
  if (marker1) {
    // 定位到这个marker
    setViewById(imageInfo.id)
    ElMessage.warning('节点已存在！，请编辑已有节点')
    return
  }
  const map = MAP_INSTANCE
  const myIcon = createImageMarkerIcon(imageInfo)
  // 地图中心
  const markerLatLng = lat && Lng ? [lat, Lng] : [map.getCenter().lat, map.getCenter().lng]
  const marker = L.marker(markerLatLng, {
    icon: myIcon,
    title: imageInfo.name,
    type: 'temporary-image',
    riseOnHover: true,
    id: imageInfo.id,
    draggable: true
  })
  marker.addTo(map)
  markerMouseListener(marker)
  return marker
}

export async function addManualLocateGroupToMap(groupInfo: INewGroupFormData, lat?: number, Lng?: number ) {
  // 先判断一下是不是有marker了
  const marker1 = getMarkerById(groupInfo.id)
  if (marker1) {
    // 定位到这个marker
    setViewById(groupInfo.id)
    ElMessage.warning('节点已存在！，请编辑已有节点')
    return
  }
  const map = MAP_INSTANCE
  const myIcon = await createGroupMarkerIcon(groupInfo)
  // 地图中心
  const markerLatLng = lat && Lng ? [lat, Lng] : [map.getCenter().lat, map.getCenter().lng]
  const marker = L.marker(markerLatLng, {
    icon: myIcon,
    title: groupInfo.name,
    type: 'temporary-group',
    riseOnHover: true,
    id: groupInfo.id,
    draggable: true
  })
  marker.addTo(map)
  markerMouseListener(marker)
  return marker
}



/**
 * @description: 创建L.Icon实例，用于marke渲染
 * @param {IImageInfo} imageInfo
 * @return {*}
 */
export function createImageMarkerIcon(imageInfo: IImageInfo): L.Icon {
  let myIcon;
  let imageUrl = imageInfo.url ?? getImageUrl(imageInfo.id)
  // 如果没有url直接用文字名称代替
  if (!imageUrl) {
    myIcon = L.divIcon({
      html: noImageUrlIcon(imageInfo.name),
      iconSize: IMAGE_MARKER_SIZE,
      iconAnchor: [IMAGE_MARKER_SIZE[0] / 2, imageMarkerTranslateY] // 设置锚点为底部中心
    })
  } else {
    myIcon = L.divIcon({
      // 传值使用
      iconUrl: imageUrl,
      html: imageUrlIcon(imageUrl),
      iconSize: IMAGE_MARKER_SIZE,
      iconAnchor: [IMAGE_MARKER_SIZE[0] / 2, imageMarkerTranslateY] // 设置锚点为底部中心
    })
  }
  return myIcon
}

/**
 * @description: 创建L.Icon实例，用于marke渲染
 * @param {INewGroupFormData} groupInfo
 * @return {*}
 */
export async function createGroupMarkerIcon(groupInfo: INewGroupFormData): L.Icon {
  let myIcon = null
  const groupNumbers = groupInfo.groupNumbers
  // 如果没有url直接用文字名称代替
  if (groupNumbers && groupNumbers.length > 0) {
    // 请求前几张图片，并保存到
    console.log('groupInfo---', groupInfo)
    // 先只获取前4张图片
    const resImageUrls = await getImageUrlByIds(groupInfo.groupNumbers.slice(0, GROUP_COVER_NUMBER))
    if (!resImageUrls || resImageUrls.length === 0) {
      ElMessage.error('获取图片失败')
      return
    }
    const imageUrls = resImageUrls.map(item => {
      return item
    })
    myIcon = L.divIcon({
      // 传值使用
      imageUrls,
      html: imageUrlsIcon(imageUrls),
      iconSize: GROUP_MARKER_SIZE,
      iconAnchor: [GROUP_MARKER_SIZE[0] / 2, groupMarkerTranslateY]
    })
  } else {
    myIcon = L.divIcon({
      html: noImagesGroupIcon(groupInfo.name),
      iconSize: GROUP_MARKER_SIZE,
      iconAnchor: [GROUP_MARKER_SIZE[0] / 2, groupMarkerTranslateY]
    })
  }
  return myIcon
}

/**
 * @description: 删除地图中的marker
 * @param {*} marker
 * @return {*}
 */
export function deleteMarkerInMap(marker) {
  const map = MAP_INSTANCE
  const mapStore = useMapStore()
  if (map && marker) {
    map.removeLayer(marker)
    mapStore.deleteMarker(marker)
  }
}

/**
 * @description: 根据markerId删除地图中的marker
 * @param {*} markerId
 * @param {*} map
 * @return {*}
 */
export function deleteMarkerById(markerId) {
  const map = MAP_INSTANCE
  const marker = getMarkerById(markerId, map)
  deleteMarkerInMap(marker, map)
}

/**
 * @description: 隐藏marker
 * @param {*} markerId
 * @param {*} map
 * @return {*}
 */
export function hiddenMarkerById(markerId: string) {
  const marker = getMarkerById(markerId)
  if (marker) {
    marker.setOpacity(0)
  }
}

/**
 * @description: 显示marker
 * @param {string} markerId
 * @return {*}
 */
export function showMarkerById(markerId: string) {
  const marker = getMarkerById(markerId)
  if (marker) {
    marker.setOpacity(1)
  }
}

/**
 * @description: 监听地图改变事件，用于更新marker
 * @param {*} map
 * @return {*}
 */
export function observeMapChangeToUpgradeMarker() {
  // 刚开始先更新一波
  setTimeout(() => {
    updateVisibleMarkers()
  }, 100)
  const map = MAP_INSTANCE
  map.on('moveend', () => {
    // 更新在可视范围内marker的图片
    updateVisibleMarkers()
  })
  map.on('movestart', () => {
    // 隐藏所有右击出现的弹框
    eventBus.emit('hidden-content-menu')
  })
  // 地图缩放改变marker大小
  map.on('zoomend', () => {
    // scaleMarkerByMap()
  })
}

/**
 * @description: 簇点击事件，更新图片需要图片移动或缩放，有时候点击簇不会发生地图缩放
 * ，导致图片不会加载，所有在点击时手动出发可视marker的更新
 * @return {*}
 */
export function observeClisterClick() {
  markerClusters.on('clusterclick', function (a) {
    // a.layer is actually a cluster
    setTimeout(() => {
      updateVisibleMarkers()
    }, 100)
  });
}

/**
 * @description: 点击地图时，关闭图片信息抽屉
 * @param {*} map
 * @return {*}
 */
export function hiddenImageInfoDrawerMapClick() {
  const map = MAP_INSTANCE
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
export function updateVisibleMarkers() {
  const map = MAP_INSTANCE
  const mapStore = useMapStore()
  const visibleMarkerIdList = mapStore.getVisibleMarkerIdList
  const getMarkerIdList = mapStore.getMarkerIdList
  getMarkerIdList.forEach(markerId => {
    const marker = getMarkerById(markerId)
    if (marker && isMarkerInView(marker.getLatLng())) {
      if (!visibleMarkerIdList.includes(markerId)) {
        if (marker.options.type === 'image') {
          // 更新一下marker
          updateImageMarker(marker)
        }
        if (marker.options.type === 'group') {
          // 更新分组的图片
          updateGroupMarker(marker)
        }
        addVisibleMarkerById(markerId, map)
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
function isMarkerInView(markerLatLng) {
  const map = MAP_INSTANCE
  // 获取地图的可视范围
  const bounds = map.getBounds()
  // marker.getLatLng()获取marker的经纬度
  if (!markerLatLng) {
    return false
  }
  return bounds.contains(markerLatLng)
}

/**
 * @description: 更新marker，用于渲染图片等
 * @param {*} id
 * @param {*} newMarkerData
 * @return {*}
 */
async function updateImageMarker(marker) {
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
    const fileUrl = await getImageUrlById(marker.options.id)
    if (!fileUrl || fileUrl === '') {
      // 如果没有请求成功需要先删除掉
      mapStore.deleteVisbleMarkerId(marker.options.id)
      return
    }
    const myIcon = L.divIcon({
      html: imageUrlIcon(fileUrl),
      // 传值使用
      iconUrl: fileUrl,
      iconSize: IMAGE_MARKER_SIZE,
      iconAnchor: [IMAGE_MARKER_SIZE[0] / 2, imageMarkerTranslateY] // 设置锚点为底部中心
    })
    marker.setIcon(myIcon)
  }
}

function updateGroupMarker(marker) {
  const mapStore = useMapStore()
  // 将marker添加到已经渲染的store中
  const index = mapStore.getVisibleMarkerIdList.findIndex(markerId => markerId === marker.options.id)
  console.log('marker---', marker)
  // 判断是否在schema中
  const isInSchema = judgeHadUploadImage(marker.options.id)
  if (index === -1 && marker?.options?.divIcon?.options?.iconUrl) {
    // 如果本身就有照片了，那就不用请求图片了（这种情况出现在获取图片后手动上传时，此时已有图片）
    return
  }
  if (index === -1 && isInSchema) {

  }
}

/**
 * @description: 根据地图缩放比例适当缩放marker
 * @param {*} map
 * @return {*}
 */
function scaleMarkerByMap() {
  const map = MAP_INSTANCE
  const mapStore = useMapStore()
  const markerIdList = mapStore.getMarkerIdList
  const zoom = map.getZoom()
  
  if (zoom >= 15) {
    MARKER_SHOW_RADIO = 1.1
    MARKER_HOVER_SHOW_RADIO = 1.2
  } else if (zoom < 15 && zoom >= 13) {
    MARKER_SHOW_RADIO = 1
    MARKER_HOVER_SHOW_RADIO = 1.1
  } else if (zoom < 13 && zoom >= 11) {
    MARKER_SHOW_RADIO = 0.9
    MARKER_HOVER_SHOW_RADIO = 1
  } else if (zoom < 11 && zoom >= 9) {
    MARKER_SHOW_RADIO = 0.8
    MARKER_HOVER_SHOW_RADIO = 0.9
  } else if (zoom < 9 && zoom >= 6) {
    MARKER_SHOW_RADIO = 0.7
    MARKER_HOVER_SHOW_RADIO = 0.8
  } else if (zoom < 6) {
    MARKER_SHOW_RADIO = 0.6
    MARKER_HOVER_SHOW_RADIO = 0.7
  }
  console.log('zoom', zoom, MARKER_SHOW_RADIO)
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
  div.className = 'image-icon'
  div.style.lineHeight = imageMarkerTranslateY + 'px'
  div.innerHTML = text
  div.appendChild(locationDiv)
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
  const img = document.createElement('img') as HTMLImageElement
  img.width = IMAGE_MARKER_SIZE[0]
  img.height = imageMarkerTranslateY
  img.src = imgUrl
  div.className = 'image-icon'
  div.appendChild(img)
  return div
}

/**
 * @description: 有多张图片时的icon
 * @param {string} imgUrls
 * @return {*}
 */
export function imageUrlsIcon(imgUrls: string[]) {
  if (!imgUrls ||imgUrls.length === 0) {
    return noImagesGroupIcon('暂无图片')
  }
  const locationDiv = document.createElement('div')
  locationDiv.className = 'location group-location'
  const div = document.createElement('div')
  div.appendChild(locationDiv)
  for (let i = 0; i < imgUrls.length; i++) {
    const img = document.createElement('img') as HTMLImageElement
    img.width = GROUP_MARKER_SIZE[0] / 2
    img.height = GROUP_MARKER_SIZE[1] / 2
    img.src = imgUrls[i]
    div.className = 'image-icon'
    div.appendChild(img)
  }
  return div
}

export function noImagesGroupIcon(text) {
  const locationDiv = document.createElement('div')
  locationDiv.className = 'location group-location'
  const div = document.createElement('div')
  div.className = 'image-icon'
  div.style.lineHeight = imageMarkerTranslateY + 'px'
  div.innerHTML = text
  div.appendChild(locationDiv)
  return div
}


/**
 * @description: 根据id获取地图中的marker
 * @param {*} markerId
 * @param {*} map 地图实例
 * @return {*}
 */
export function getMarkerById(markerId: string): L.Marker {
  let foundMarker;
  const map = MAP_INSTANCE
  map.eachLayer?.(layer => {
    if (layer instanceof L.Marker && layer.options.id === markerId) {
      foundMarker = layer;
    }
  });
  return foundMarker;
}

/**
 * @description: 获取marker的GPS信息
 * @param {string} markerId
 * @param {*} map
 * @return {*}
 */
export function getGPSInfoById(markerId: string) {
  const map = MAP_INSTANCE
  return getGPSInfoByMarkerInstance(getMarkerById(markerId, map))
}

/**
 * @description: 定位到当前marker
 * @param {number} lat 维度
 * @param {number} lng 精度
 * @return {*}
 */
export function setViewByLatLng(lat: number, lng: number) {
  const map = MAP_INSTANCE
  if (lat && lng) {
    map?.setView?.([lat, lng], map.getZoom() ?? 10, {
      animate: true,
      duration: 0.5 // 动画持续时间，单位为秒
    })
    return
  }
}

/**
 * @description: 根据
 * @param {string} markerId
 * @return {*}
 */
export function setViewById(markerId: string) {
  const map = MAP_INSTANCE
  if (markerId) {
    const marker = getMarkerById(markerId, map)
    if (!marker) {
      console.error('节点不存在')
      return
    }
    const { lat, lng } = marker?.getLatLng?.()
    map.setView([lat, lng], map.getZoom() ?? 10, {
      animate: true,
      duration: 0.5 // 动画持续时间，单位为秒
    })
    return
  }
}

/**
 * @description: 添加可视marker到store，并且更新实例，实现左键右键等功能
 * @param {*} markerId
 * @param {*} map
 * @return {*}
 */
export function addVisibleMarkerById(markerId: string) {
  const mapStore = useMapStore()
  mapStore.addVisibleMarkerId(markerId)
  const marker = getMarkerById(markerId)
  // 鼠标事件监听
  markerMouseListener(marker)
}

/**
 * @description: 添加鼠标事件监听
 * @param {*} marker marker实例
 * @return {*}
 */
function markerMouseListener(marker) {
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

/**
 * @description: 判断GPSInfo值是否有效
 * @return {*}
 */
export function GPSInfoLegality(GPSInfo: any) {
  if (!GPSInfo) {
    return false
  }
  const { GPSLatitude, GPSLongitude, GPSAltitude } = GPSInfo
  if (typeof GPSLatitude !== 'number' || typeof GPSLongitude !== 'number') {
    return false
  }
  if (GPSAltitude && typeof GPSAltitude !== 'number') {
    return false
  }
  return true
}

/**
 * @description: 获取固定marker的type
 * @param {string} markerType
 * @return {*}
 */
export function getPermanentType(markerType: string) {
  return markerType.replace('temporary-', '')
}

/**
 * @description: 获取临时marker的type
 * @param {string} markerType
 * @return {*}
 */
export function getTemporaryType(markerType: string) {
  if (markerType.includes('temporary-')) {
    return markerType
  }
  return `temporary-${markerType}`
}
