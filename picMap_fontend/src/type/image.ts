import { IGroupInfo, IImageInfo, IGPSInfo } from './schema'
export type IImageDetailInfo = {
  Resolution?: any
  BrightnessValue?: any
  size?: any,
  [key: string]: any // 其他信息
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
  imageInfo: IImageDetailInfo | null
  cameraInfo: ICameraDetailInfo | null
  authorInfo: IAuthorDetailInfo | null
  GPSInfo: IGPSInfo | null
  url: string,
  showType: 'image' | 'group'
} & IGroupInfo & IImageInfo