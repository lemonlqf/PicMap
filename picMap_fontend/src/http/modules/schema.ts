/*
 * @Author: Do not edit
 * @Date: 2024-12-13 00:25:49
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 16:28:34
 * @FilePath: \Code\picMap_fontend\src\http\modules\schema.ts
 * @Description:
 */
import { set } from 'lodash-es'
import http from '../axios'

export default {
  getSchema: (params?: any) => {
    return http({
      url: 'schema/getSchema',
      method: 'get',
      params
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
