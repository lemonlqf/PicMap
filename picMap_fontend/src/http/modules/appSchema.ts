import http from '../axios'
import type { IUserInfo } from '@/type/appSchema'
import type { IHttpResponse } from '@/type/http'
export default {
  getUserInfos: (params?: any): Promise<IHttpResponse> => {
    return http({
      url: 'appSchema/getUserInfos',
      method: 'get',
      params
    })
  },
  getAppSchema: (): Promise<IHttpResponse> => {
    return http({
      url: 'appSchema/getSchema',
      method: 'get',
    })
  },
  setAppSchema: data => {
    return http({
      url: 'appSchema/setSchema',
      method: 'post',
      data
    })
  }
}
