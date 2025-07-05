/*
 * @Author: Do not edit
 * @Date: 2025-06-29 15:27:39
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-05 14:59:52
 * @FilePath: \Code\picMap_fontend\src\type\appSchema.ts
 * @Description: 
 */
export type IAppSchema = {
  version: string
  userInfos: IUserInfo[]
}

export type IUserInfo = {
  userId: string
  userName: string;
  userAvatar?: string;
  createTime?: number;
}