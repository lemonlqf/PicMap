/*
 * @Author: Do not edit
 * @Date: 2025-04-30 09:38:07
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-04-30 12:50:12
 * @FilePath: \Code\picMap_fontend\src\type\schema.ts
 * @Description: 
 */


export type ISchema = {
  verison: string,
  mapInfo: {
    center: number[]
  },
  groupInfo: IGroupInfo[],
  imageInfo: IImageInfo[],
}

export type IGroupInfo = {
  name: string,
  id: string,
  groupNumbers: string[],
  GPSInfo: IGPSInfo,
}

export type IGPSInfo = {
  GPSLatitude: number
  GPSLongitude: number
  GPSAltitude?: number
}

export type IImageInfo = {
  id: string,
  GPSInfo: IGPSInfo,
  lastModified: number
  name: string,
  size: number,
  type: string,
  describe: string, // 图片描述信息
  [key: string]: any // 其他信息
}