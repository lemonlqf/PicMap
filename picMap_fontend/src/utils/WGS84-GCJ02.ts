/*
 * @Author: Do not edit
 * @Date: 2025-02-02 00:00:32
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 14:36:50
 * @FilePath: \Code\picMap_fontend\src\utils\WGS84-GCJ02.ts
 * @Description:
 */
const PI = 3.1415926535897932384626
const A = 6378245.0 // 长半轴
const EE = 0.00669342162296594323 // 扁率

/**
 * @description: 将 WGS84 坐标转换为 GCJ02 坐标
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @return {Array} - 返回转换后的 GCJ02 坐标 [lng, lat]
 */
function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) {
    return [lng, lat]
  }
  let dlat = transformLat(lng - 105.0, lat - 35.0)
  let dlng = transformLng(lng - 105.0, lat - 35.0)
  const radlat = (lat / 180.0) * PI
  let magic = Math.sin(radlat)
  magic = 1 - EE * magic * magic
  const sqrtmagic = Math.sqrt(magic)
  dlat = (dlat * 180.0) / (((A * (1 - EE)) / (magic * sqrtmagic)) * PI)
  dlng = (dlng * 180.0) / ((A / sqrtmagic) * Math.cos(radlat) * PI)
  let mglat = (lat + dlat).toFixed(7)
  let mglng = (lng + dlng).toFixed(7)
  if (mglat === 'NaN') {
    mglat = undefined
  }
  if (mglng === 'NaN') {
    mglng = undefined
  }
  return [mglng, mglat]
}

/**
 * @description: 将 GCJ02 坐标转换为 WGS84 坐标
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @return {Array} - 返回转换后的 WGS84 坐标 [lng, lat]
 */
function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) {
    return [lng, lat]
  }
  let dlat = transformLat(lng - 105.0, lat - 35.0)
  let dlng = transformLng(lng - 105.0, lat - 35.0)
  const radlat = (lat / 180.0) * PI
  let magic = Math.sin(radlat)
  magic = 1 - EE * magic * magic
  const sqrtmagic = Math.sqrt(magic)
  dlat = (dlat * 180.0) / (((A * (1 - EE)) / (magic * sqrtmagic)) * PI)
  dlng = (dlng * 180.0) / ((A / sqrtmagic) * Math.cos(radlat) * PI)
  const mglat = lat + dlat
  const mglng = lng + dlng
  return [lng * 2 - mglng, lat * 2 - mglat]
}

/**
 * @description: 判断是否在中国境外
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @return {boolean} - 返回是否在中国境外
 */
function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

/**
 * @description: 转换纬度
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @return {number} - 返回转换后的纬度
 */
function transformLat(lng, lat) {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng))
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

/**
 * @description: 转换经度
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @return {number} - 返回转换后的经度
 */
function transformLng(lng, lat) {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng))
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

export { wgs84ToGcj02, gcj02ToWgs84 }
