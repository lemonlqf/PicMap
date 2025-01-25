/*
 * @Author: Do not edit
 * @Date: 2024-12-13 00:25:49
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-14 18:23:33
 * @FilePath: \picMap_fontend\src\http\modules\image.js
 * @Description:
 */
import http from '../axios.js'

export default {
  uploadImages: data => {
    http({
      url: 'image/uploadImages',
      method: 'post',
      data
    })
  }
}
