import http from '../axios'
import type { IUserInfo } from '@/type/appInfo'
import type { IHttpResponse } from '@/type/http'
export default {
  getUserInfos: (params?: any): Promise<IHttpResponse> => {
    return http({
      url: 'appInfo/getUserInfos',
      method: 'get',
      params
    })
  }
}