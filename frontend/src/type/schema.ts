/*
 * @Author: Do not edit
 * @Date: 2025-04-30 09:38:07
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-10 22:25:50
 * @FilePath: \PicMap\Code\picMap_fontend\src\type\schema.ts
 * @Description: 
 */



export type IResult = {
  code: number
  msg: string
  data: any
}

export type ISchema = {
  version: string,
  mapInfo: IMapInfo,
  groupInfo: IGroupInfo[],
  imageInfo: IImageInfo[],
  trackInfo?: ITrackInfo[],
  videoInfo?: IVideoInfo[],
}

export type IVideoRef = {
  videoId: string,
  timeOffsetMs?: number
}

export type IVideoInfo = {
  id: string,
  name?: string,
  path?: string,
  durationMs?: number,
  trackId?: string,
  timeMode?: 'absolute' | 'offset',
  startTimeMs?: number,
  timeOffsetMs?: number,
  viewType?: string,
  size?: number,
  lastModified?: number,
  GPSLatitude?: number,
  GPSLongitude?: number
}

export type ITrackInfo = {
  id: string,
  name?: string,
  distance?: number,
  startTime?: string,
  endTime?: string,
  movingTime?: number,
  totalTime?: number,
  movingPace?: number,
  movingSpeed?: number,
  totalSpeed?: number,
  elevationMin?: number,
  elevationMax?: number,
  elevationGain?: number,
  elevationLoss?: number,
  speedMax?: number,
  averageHr?: number,
  averageCadence?: number,
  averageTemp?: number,
  setting?: {
    lineColor?: string
  },
  videos?: IVideoRef[]
  images?: string[]
}

export type IMapInfo = {
  center: number[],
  maxZoom: number,
  minZoom: number,
  zoom: number,
  pitch?: number,
  bearing?: number,
  activeTiles: string[],
  defaultTileId?: string
}

export type IGroupInfo = {
  name: string,
  id: string,
  GPSInfo: IGPSInfo,
  groupNumbers?: string[],
  videoNumbers?: string[],
  trackNumbers?: string[],
  visible?: boolean,
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
  url?: string,
  blobUrl?: string,
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