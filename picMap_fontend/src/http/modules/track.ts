/*
 * @Author: Do not edit
 * @Date: 2026-03-21
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-21
 * @FilePath: \PicMap\picMap_fontend\src\http\modules\track.ts
 * @Description: 对轨迹库的操作，上传相关
 */
import http from '../axios'

export default {
  uploadTrack: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return http({
      url: 'track/uploadTrack',
      method: 'post',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}