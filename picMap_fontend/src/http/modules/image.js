/*
 * @Author: Do not edit
 * @Date: 2024-12-13 00:25:49
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-02 19:01:44
 * @FilePath: \Code\picMap_fontend\src\http\modules\image.ts
 * @Description: 对图片库的操作，CRUD相关
 */
import http from '../axios.ts'

export default {
  uploadImages: data => {
    return http({
      url: 'image/uploadImages',
      method: 'post',
      data
    })
  },
  getImage: data => {
    return http({
      url: 'image/getSmallImage',
      method: 'post',
      data
    })
  },
  deleteImages: data => {
    return http({
      url: 'image/deleteImages',
      method: 'post',
      data
    })
  },
  updateImages: data => {
    return http({
      url: 'image/updateImages',
      method: 'post',
      data
    })
  },
  downloadImage: data => {
    return http({
      url: 'image/downloadImage',
      method: 'post',
      data
    })
  }
}
