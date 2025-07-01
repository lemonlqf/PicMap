/*
* @Author: Do not edit
* @Date: 2025-06-29 15:35:12
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-01 20:05:05
 * @FilePath: \Code\picMap_fontend\src\utils\appInfo.ts
* @Description: 
*/
import type { IUserInfo } from '@/type/appInfo';
import AppInfoHttp from '@/http/modules/appInfo'
import { useAppStore } from '@/store/appInfo'

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