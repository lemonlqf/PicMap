/*
 * @Author: Do not edit
 * @Date: 2024-12-12 23:57:41
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-02 22:41:22
 * @FilePath: \Code\picMap_fontend\src\router\index.ts
 */
import { createWebHashHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import PicMap from '@/views/picMap/Index.vue'
import Home from '@/views/home/Index.vue'
import NotFind from '@/views/404/Index.vue'
import Setting from '@/views/setting/Index.vue'
import SettingUser from '@/views/setting/settingUser/SettingUser.vue'
import SettingMap from '@/views/setting/settingMap/SettingMap.vue'
import SettingImg from '@/views/setting/settingImg/SettingImg.vue'

const routes = [
  { path: '/', redirect: '/picMap', },
  { path: '/home', component: Home, },
  {
    path: '/picMap',
    component: PicMap
  },
  {
    path: '/404',
    component: NotFind
  },
  {
    path: '/setting',
    redirect: '/setting/user',
    component: Setting,
    children: [
      {
        path: 'user',
        component: SettingUser
      },
      {
        path: 'map',
        component: SettingMap
      },
      {
        path: 'img',
        component: SettingImg
      }
    ]
  },
  {
    path: '/:pathMatch(.*)',
    redirect: '/404'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
