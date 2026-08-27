/*
 * @Author: Do not edit
 * @Date: 2025-07-04 19:07:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-16 21:54:42
 * @FilePath: \Code\picMap_fontend\src\utils\user.ts
 * @Description: 
 */
import { useAppStore } from "@/store/appSchema";
import API from '@/wails/api'
import defalutImage from '@/assets/avatar/默认头像.png'
import img1 from '@/assets/avatar/三明治.png'
import img2 from '@/assets/avatar/冰淇淋.png'
import img3 from '@/assets/avatar/咖啡.png'
import img4 from '@/assets/avatar/寿司2.png'
import img5 from '@/assets/avatar/汉堡.png'
import img6 from '@/assets/avatar/煎蛋.png'
import img7 from '@/assets/avatar/面包.png'
import img8 from '@/assets/avatar/鸡腿.png'
import defaultTile from '@/assets/map/defaultTile.png'
import { saveAppSchema } from "./appSchema";
import { ElMessage } from "element-plus";
import { cloneDeep } from 'lodash-es';
import { ref } from 'vue';
import { resolveIconUrl } from '@/utils/icon';
import type { IUserInfo } from "@/type/appSchema";
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

export function getUserInfoById(userId: string) {
  const appStore = useAppStore()
  const userInfos = appStore.getUserInfos
  if (!userInfos || !Array.isArray(userInfos)) {
    return undefined
  }
  return userInfos.find(item => {
    return item.userId === userId
  })
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

// 自定义头像 URL 的响应式缓存，key = 头像 id，值 = 已解析的 dataURL
const customAvatarUrlCache = ref<Record<string, string>>({})

// 暴露缓存供组件响应式依赖（读取时建立依赖，解析后自动刷新）
export function getCustomAvatarUrlCache() {
  return customAvatarUrlCache.value
}

/**
 * @description: 获取用户头像
 * - 预设头像：直接返回 DEFAULT_AVATAR 对应 URL
 * - 自定义头像：从响应式缓存读取（首次返回空，异步解析后触发组件刷新）
 * @param {string} avatar
 * @return {string}
 */
export function getAvatarUrl(avatar: string): string {
  if (!avatar) return DEFAULT_AVATAR['default_0']
  const presetUrl = DEFAULT_AVATAR[avatar]
  if (presetUrl) return presetUrl
  // 自定义图标 id（custom_avatar_*），从缓存读取
  if (avatar.startsWith('custom_')) {
    const cached = customAvatarUrlCache.value[avatar]
    if (cached) return cached
    // 异步解析并写入响应式缓存，触发所有组件重新渲染
    resolveIconUrl(avatar, 'avatar').then((url) => {
      if (url && !customAvatarUrlCache.value[avatar]) {
        customAvatarUrlCache.value[avatar] = url
      }
    })
  }
  return DEFAULT_AVATAR['default_0']
}

export function getMapTile(imageId: string) {
  let url = ''
  if (imageId) {
    // 获取实际瓦片路径
  }
  if (url) {
    return url
  } else {
    return defaultTile
  }
}

/**
 * @description: 改变用户头像
 * @param {string} userId
 * @param {any} imgId
 * @return {*}
 */
export async function changeUsreAvatar(userId: string, imgId: any) {
  const appStore = useAppStore()
  const userInfos = appStore.getUserInfos
  const newUserInfos = userInfos.map(userInfo => {
    if (userInfo.userId === userId) {
      userInfo.userAvatar = imgId
    }
    return userInfo
  })
  appStore.setUserInfos(newUserInfos)
  const res = await saveAppSchema()
  if (res.code === 200) {
    ElMessage.success('头像更新成功')
  }
}

/**
 * @description: 判断用户id是否已经存在
 * @param {string} userName
 * @param {string} userId
 * @return {*}
 */
export function isUserIdExis(userId: string) {
  const appStore = useAppStore()
  const userInfos = appStore.getUserInfos
  return userInfos.some(userInfo => {
    return (userInfo.userId === userId)
  })
}

/**
 * @description: 判断用户name是否已经存在
 * @param {string} userName
 * @param {string} userId
 * @return {*}
 */
export function isUserNameExist(userName: string) {
  const appStore = useAppStore()
  const userInfos = appStore.getUserInfos
  return userInfos.some(userInfo => {
    return (userInfo.userName === userName)
  })
}

/**
 * @description: 添加用户
 * @param {IUserInfo} userInfo
 * @return {*}
 */
export async function createUser(userInfo: IUserInfo) {
  const appStore = useAppStore()
  const userInfos = cloneDeep(appStore.getUserInfos)
  if (isUserNameExist(userInfo.userName)) {
    ElMessage.warning('用户已存在， 请重新编辑')
  } else {
    userInfos.push(userInfo)
  }
  appStore.setUserInfos(userInfos)
  // 添加对应的目录结构
  await createUserDir(userInfo.userId)
  const res = await saveAppSchema()
  if (res.code === 200) {
    ElMessage.success('用户添加成功')
  }
}

/**
 * @description: 创建用户相关的文件和目录
 * @param {string} userId
 * @return {*}
 */
export async function createUserDir(userId: string) {
  const res = await API.user.createUserDir({userId})
  return res
}

export async function deleteUser(userInfo: IUserInfo) {
  const appStore = useAppStore()
  let userInfos = cloneDeep(appStore.getUserInfos)
  let userIndex = 0
  userInfos.forEach((item, index) => {
    if (item.userId === userInfo.userId) {
      userIndex = index
    }
  })
  userInfos = userInfos.filter(item => {
    return userInfo.userId !== item.userId
  })
  if (userInfos.length === 0) {
    ElMessage.warning('请至少保留一个用户！')
    return
  }
  appStore.setUserInfos(userInfos)
  const res = await saveAppSchema()
  // 删除对应的目录结构
  await deleteUserDir(userInfo.userId)
  if (res.code === 200) {
    // 更新currentUserInfo
    const currentUserInfo = appStore.getCurrentUserInfo
    // 如果删除的用户恰好是当前用户，则当前用户变为用户列表的第一个
    if (currentUserInfo.userId === userInfo.userId) {
      appStore.setCurrentUserInfo(userInfos[Math.max(userIndex - 1, 0)])
    }
    ElMessage.success('用户删除成功！')
  }
}

export async function deleteUserDir(userId: string) {
  const res = await API.user.deleteUserDir({ userId })
  return res
}

/**
 * @description: 创建一个新的用户id
 * @return {*}
 */
export function createUserId() {
  let newId = 'user_' + Date.now()
  while (isUserIdExis(newId)) {
    newId = 'user__' + Date.now()
  }
  return newId
}