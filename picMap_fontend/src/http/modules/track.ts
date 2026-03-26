/*
 * @Author: Do not edit
 * @Date: 2026-03-21
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-22 21:33:12
 * @FilePath: \PicMap\picMap_fontend\src\http\modules\track.ts
 * @Description: 轨迹相关API接口封装
 */
import http from '../axios'

export default {
  /**
   * @description: 上传轨迹文件到服务器
   * @param {File} file - GPX轨迹文件
   * @return {Promise}
   */
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
  },

  /**
   * @description: 删除服务器上的轨迹文件
   * @param {string} fileName - 轨迹文件名（不含路径）
   * @return {Promise}
   */
  deleteTrack: (fileName: string) => {
    return http({
      url: 'track/deleteTrack',
      method: 'delete',
      params: { fileName }
    })
  },

  /**
   * @description: 获取轨迹文件内容
   * @param {string} fileName - 轨迹文件名（不含路径）
   * @return {Promise} 返回轨迹文件内容
   */
  getTrack: (fileName: string) => {
    return http({
      url: 'track/getTrack',
      method: 'get',
      params: { fileName }
    })
  }
}