import { set } from 'lodash-es';
/*
 * @Author: Do not edit
 * @Date: 2025-06-29 14:27:31
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-05 14:46:22
 * @FilePath: \Code\picMap_fontend\src\store\appSchema.ts
 * @Description: 
 */

// 应用schema
import { defineStore } from 'pinia'
import type { IUserInfo, IAppSchema } from '@/type/appSchema'
import type { ISchema } from '@/type/schema';
import { getAppSchema } from '@/utils/appSchema';
export const useAppStore = defineStore('appInfo', {
  state: () => ({
    appSchema: {} as IAppSchema,
    // userInfos: [] as IUserInfo[],
    currentUserInfo: {} as IUserInfo
  }),
  getters: {
    getAppSchema: state => state.appSchema as IAppSchema,
    getUserInfos: state => state.appSchema.userInfos as IUserInfo[],
    getCurrentUserInfo: state => state.currentUserInfo as IUserInfo,
  },
  actions: {
    setUserInfos(value: IUserInfo[]) {
      this.appSchema.userInfos = value
    },
    setAppSchema(value: IAppSchema) {
      this.appSchema = value
    },
    setCurrentUserInfo(value: IUserInfo) {
      this.currentUserInfo = value
    }
  }
})