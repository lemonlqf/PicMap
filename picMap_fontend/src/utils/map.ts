/*
 * @Author: Do not edit
 * @Date: 2025-01-26 14:08:00
 * @LastEditors: Please set LastEditors
 * @LastEditTime: 2025-09-13 14:14:38
 * @FilePath: \Code\picMap_fontend\src\utils\map.ts
 * @Description:
 */
import eventBus from '@/utils/eventBus'
import mapService from '@/services/map'

/**
 * @description: 点击地图时，关闭图片信息抽屉
 * @param {*} map
 * @return {*}
 */
export function hiddenImageInfoDrawerMapClick() {
  const map = mapService.getMapInstance()
  map.on('click', () => {
    // 点击地图时，关闭图片详细信息抽屉
    eventBus.emit('drawer-hidden')
  })
}

/**
 * @description: 将后端返回的各种类型的文件转换为Base64字符串
 * @param {ArrayBuffer} buffer
 * @return {string}
 */
export function fileToBase64(file: any) {
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
 * @description: 判断GPSInfo值是否有效
 * @return {*}
 */
export function GPSInfoLegality(GPSInfo: any) {
  if (!GPSInfo) {
    return false
  }
  const { GPSLatitude, GPSLongitude, GPSAltitude } = GPSInfo
  if (!GPSLatitude || !GPSLongitude) {
    return
  }
  if (typeof +GPSLatitude !== 'number' || typeof +GPSLongitude !== 'number') {
    return false
  }
  if (GPSAltitude && typeof +GPSAltitude !== 'number') {
    return false
  }
  return true
}
