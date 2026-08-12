/*
 * @Author: Do not edit
 * @Date: 2025-04-30 18:15:56
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-17 17:10:45
 * @FilePath: \PicMap\picMap_fontend\src\type\image.ts
 * @Description: 
 */
import en from '@/i18n/lang/en';
import type { IGroupInfo, IImageInfo, IGPSInfo } from './schema'
export type IImageDetailInfo = {
  id: string;
  name: string;
  url: string;
  // 新增一个thumbnailUrl字段，用于存储缩略图的url,主要用于传递给后端用来保存
  thumbnailUrl?: string;
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

// export enum ImageType {
//   JPEG = 'image/jpeg',
//   JPG = 'image/jpg',
//   PNG = 'image/png',
//   GIF = 'image/gif',
//   BMP = 'image/bmp',
//   WEBP = 'image/webp',
//   HEIC = 'image/heic',
//   HEIF = 'image/heif',
//   RAW = 'image/x-raw',
//   DNG = 'image/x-adobe-dng',
//   CR2 = 'image/x-canon-cr2',
//   CR3 = 'image/x-canon-cr3',
//   NEF = 'image/x-nikon-nef',
//   ORF = 'image/x-olympus-orf',
//   RW2 = 'image/x-panasonic-rw2',
//   ARW = 'image/x-sony-arw',
//   RAF = 'image/x-fuji-raf',
// }

export enum ImageType {
  // 通用位图格式（原有）
  JPEG = 'image/jpeg',
  JPG = 'image/jpg',
  PNG = 'image/png',
  GIF = 'image/gif',
  BMP = 'image/bmp',
  WEBP = 'image/webp',

  // 新增的高效图像格式（HEIC/HEIF）
  HEIC = 'image/heic',
  HEIF = 'image/heif',

  // 通用 RAW 格式（核心推荐，兼容所有品牌 RAW）
  RAW = 'image/raw',

  // 主流品牌专属 RAW 格式（可选，按需保留）
  RAW_CANON_CR2 = 'image/x-canon-cr2', // 佳能旧款 RAW
  RAW_CANON_CR3 = 'image/x-canon-cr3', // 佳能新款 RAW
  RAW_NIKON_NEF = 'image/x-nikon-nef', // 尼康 RAW
  RAW_SONY_ARW = 'image/x-sony-arw',   // 索尼 RAW
  RAW_FUJIFILM_RAF = 'image/x-fujifilm-raf', // 富士 RAW
  RAW_OLYMPUS_ORF = 'image/x-olympus-orf',   // 奥林巴斯/松下 RAW
  RAW_ADOBE_DNG = 'image/x-adobe-dng',       // Adobe 通用 RAW（推荐
  RAW_PANASONIC_RW2 = 'image/x-panasonic-rw2', // 松下专属 RAW
  RAW_EPSON_ERF = 'image/erf',       // 爱普生专属 RAW
  RAW_GOPRO_GPR = 'image/x-gopro-gpr',     // GoPro 专属 RAW
}