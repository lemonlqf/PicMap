/*
 * @Author: Do not edit
 * @Date: 2025-07-05 20:41:57
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-05 20:59:01
 * @FilePath: \Code\picMap_fontend\src\http\modules\user.ts
 * @Description: 
 */
import http from '../axios'

export default {
  createUserDir: (data: {userId: string}) => {
    return http({
      url: 'user/createUser',
      method: 'post',
      data
    })
  },
  deleteUserDir: (data: { userId: string }) => {
    return http({
      url: 'user/deleteUser',
      method: 'post',
      data
    })
  }
}