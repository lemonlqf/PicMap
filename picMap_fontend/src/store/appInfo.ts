import { set } from 'lodash-es';
/*
 * @Author: Do not edit
 * @Date: 2025-06-29 14:27:31
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 15:35:00
 * @FilePath: \Code\picMap_fontend\src\store\appInfo.ts
 * @Description: 
 */
import { defineStore } from 'pinia'
import type { IUserInfo } from '@/type/appInfo'
export const useAppStore = defineStore('appInfo', {
  state: () => ({
    userInfos: [] as IUserInfo[],
    currentUserInfo: {} as IUserInfo
  }),
  getters: {
    getUserInfos: state => state.userInfos as IUserInfo[],
    getCurrentUserInfo: state => state.currentUserInfo as IUserInfo
  },
  actions: {
    setUserInfos(value: IUserInfo[]) {
      this.userInfos = value
    },
    setCurrentUserInfo(value: IUserInfo) {
      this.currentUserInfo = value
    }
  }
})