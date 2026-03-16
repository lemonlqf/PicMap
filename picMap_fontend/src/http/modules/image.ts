/*
 * @Author: Do not edit
 * @Date: 2024-12-13 00:25:49
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-16 19:20:13
 * @FilePath: \PicMap\picMap_fontend\src\http\modules\image.ts
 * @Description: 对图片库的操作，CRUD相关
 */
import http from '../axios'
import type { IImageDetailInfo, IUploadImageInfo } from '@/type/image'

type IRequestPayload = Record<string, unknown>

export default {
  uploadImages: (data: IImageDetailInfo[]) => {
    return http({
      url: 'image/uploadImages',
      method: 'post',
      data
    })
  },
  getImage: (data: IRequestPayload) => {
    return http({
      url: 'image/getSmallImage',
      method: 'post',
      data
    })
  },
  getImages: (data: IRequestPayload) => {
    return http({
      url: 'image/getSmallImages',
      method: 'post',
      data
    })
  },
  deleteImages: (data: IRequestPayload) => {
    return http({
      url: 'image/deleteImages',
      method: 'post',
      data
    })
  },
  updateImages: (data: IRequestPayload) => {
    return http({
      url: 'image/updateImages',
      method: 'post',
      data
    })
  },
  downloadImage: (data: IRequestPayload) => {
    return http({
      url: 'image/downloadImage',
      method: 'post',
      data
    })
  },
  getJPGImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return http({
      url: 'image/getJPGImage',
      method: 'post',
      responseType: 'blob',
      data: formData
    })
  }
}
