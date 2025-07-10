/*
 * @Author: Do not edit
 * @Date: 2025-04-30 09:38:07
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-10 22:25:50
 * @FilePath: \PicMap\Code\picMap_fontend\src\type\schema.ts
 * @Description: 
 */



export type ISchema = {
  verison: string,
  mapInfo: IMapInfo,
  groupInfo: IGroupInfo[],
  imageInfo: IImageInfo[],
}

export type IMapInfo = {
  center: number[],
  maxZoom: number,
  minZoom: number,
  zoom: number,
  activeTiles: string[]
}

export type IGroupInfo = {
  name: string,
  id: string,
  GPSInfo: IGPSInfo,
  groupNumbers?: string[],
}

export type IGPSInfo = {
  GPSLatitude: number
  GPSLongitude: number
  GPSAltitude?: number
}

export type IImageInfo = {
  id: string,
  GPSInfo: IGPSInfo,
  lastModified?: number
  name: string,
  size?: number,
  type: string,
  describe?: string, // 图片描述信息
  [key: string]: any // 其他信息
}

export type INewimageFormData = {
  id: string,
  GPSInfo: IGPSInfo,
  name: string,
  url?: string,
  [key: string]: any // 其他信息
}

// 创建新分组时需要的数据
export type INewGroupFormData = {
  name: string,
  id: string,
  GPSInfo?: IGPSInfo,
  groupNumbers?: string[]
}