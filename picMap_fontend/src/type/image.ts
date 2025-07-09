/*
 * @Author: Do not edit
 * @Date: 2025-04-30 18:15:56
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-09 21:21:29
 * @FilePath: \PicMap\Code\picMap_fontend\src\type\image.ts
 * @Description: 
 */
import type { IGroupInfo, IImageInfo, IGPSInfo } from './schema'
export type IImageDetailInfo = {
  id: string;
  name: string;
  url: string;
  Resolution?: any
  BrightnessValue?: any
  size?: any,
  GPSInfo: IGPSInfo,
  [key: string]: any // 其他信息
}

export type IUploadImageInfo = {
  id: string;
  name: string;
  url: string;
}

export type ICameraDetailInfo = {
  Make?: any;
  Model?: any;
  FNumber?: any;
  ExposureTime?: any;
  ISOSpeedRatings?: any;
  ExposureBiasValue?: any;
  FocalLength?: any;
  MaxApertureValue?: any;
  [key: string]: any // 其他信息
}

export type IAuthorDetailInfo = {
  Arits?: any;
  SoftWare?: any;
  DateTime?: any;
  [key: string]: any // 其他信息
}

export type IMarker = {
  id: string
  name: string
  type: IShowType
  imageInfo: IImageDetailInfo | null
  cameraInfo: ICameraDetailInfo | null
  authorInfo: IAuthorDetailInfo | null
  GPSInfo: IGPSInfo | null
  url: string,
  showType: IShowType
} & IGroupInfo & IImageInfo

export type IShowType = "image" | "group" | "temporary-image" | "temporary-group"