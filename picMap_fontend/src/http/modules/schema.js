/*
 * @Author: Do not edit
 * @Date: 2024-12-13 00:25:49
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2025-01-25 22:08:01
 * @FilePath: \Code\picMap_fontend\src\http\modules\image.js
 * @Description:
 */
import { set } from 'lodash-es'
import http from '../axios.js'

export default {
  getSchema: () => {
    return http({
      url: 'schema/getSchema',
      method: 'get'
    })
  },
  setSchema: data => {
    return http({
      url: 'schema/setSchema',
      method: 'post',
      data
    })
  }
}
