/*
* @Author: Do not edit
* @Date: 2025-06-29 15:35:12
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-05 15:14:14
 * @FilePath: \Code\picMap_fontend\src\utils\appSchema.ts
* @Description: 
*/
import type { IAppSchema, IUserInfo } from '@/type/appSchema';
import AppInfoHttp from '@/http/modules/appSchema'
import { cloneDeep, set } from 'lodash-es'
import API from '@/http/index'
import { useAppStore } from '@/store/appSchema'

// 将用户信息保存在store中
export async function getUserInfos() {
  const appStore = useAppStore()
  // 如果id已经存在就不需要请求了，在请求拦截中会自动带上userId
  const userId = appStore.getCurrentUserInfo.userId
  if (userId) {
    return
  }
  const res = await AppInfoHttp.getUserInfos()
  if (res.code === 200) {
    appStore.setUserInfos(res.data)
    const userId = localStorage.getItem('currentUserId')
    const currentUserInfo = res.data.find((item: IUserInfo) => {
      return userId === item.userId
    })
    appStore.setCurrentUserInfo(currentUserInfo ?? res.data[0])
  }
}

export async function getAppSchema() {
  const appStore = useAppStore()
  const res = await AppInfoHttp.getAppSchema()
  if (res.code === 200) {
    const appSchema: IAppSchema = res.data
    appStore.setAppSchema(appSchema)
    const userId = localStorage.getItem('currentUserId')
    const currentUserInfo = appSchema.userInfos.find((item: IUserInfo) => {
      return userId === item.userId
    })
    appStore.setCurrentUserInfo(currentUserInfo ?? appSchema.userInfos?.[0])
  }
}

/**
 * @description: 保存appSchema
 * @return {*}
 */
export async function saveAppSchema() {
  const appStore = useAppStore()
  const schema = cloneDeep(appStore.getAppSchema)
  const res = await API.appSchema.setAppSchema({ schema: JSON.stringify(schema) })
  return res
}