/*
 * @Author: Do not edit
 * @Date: 2025-07-04 19:07:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-04 19:48:37
 * @FilePath: \Code\picMap_fontend\src\utils\user.ts
 * @Description: 
 */
import { useAppStore } from "@/store/appInfo";
import defalutImage from '@/assets/avatar/默认头像.png'
import img1 from '@/assets/avatar/三明治.png'
import img2 from '@/assets/avatar/冰淇淋.png'
import img3 from '@/assets/avatar/咖啡.png'
import img4 from '@/assets/avatar/寿司2.png'
import img5 from '@/assets/avatar/汉堡.png'
import img6 from '@/assets/avatar/煎蛋.png'
import img7 from '@/assets/avatar/面包.png'
import img8 from '@/assets/avatar/鸡腿.png'

/**
 * @description: 切换当前用户
 * @param {string} userId
 * @return {*}
 */
export function changeCurrentUser(userId: string) {
  const appStore = useAppStore()
  const userInfos = appStore.getUserInfos
  const currentUserInfo = userInfos.find(userInfo => {
    return userInfo.userId === userId
  })
  currentUserInfo && appStore.setCurrentUserInfo(currentUserInfo)
  localStorage.setItem('currentUserId', userId)
}

export const DEFAULT_AVATAR: any = {
  "default_0": defalutImage,
  "default_1": img1,
  "default_2": img2,
  "default_3": img3,
  "default_4": img4,
  "default_5": img5,
  "default_6": img6,
  "default_7": img7,
  "default_8": img8,
}

/**
 * @description: 获取用户头像
 * @param {string} avatar
 * @return {*}
 */
export function getAvatarUrl(avatar: string): string {
  let url = DEFAULT_AVATAR[avatar]
  if (!url) {
    // 请求实际的图片
  }
  return url ?? DEFAULT_AVATAR['default_0']
}