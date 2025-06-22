/*
 * @Author: Do not edit
 * @Date: 2024-12-12 23:57:41
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-13 11:52:46
 * @FilePath: \picMap_fontend\src\router\index
 */
import { createWebHashHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import PicMap from '@/views/picMap/Index.vue'
import Home from '@/views/home/Index.vue'
import NotFind from '@/views/404/Index.vue'

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
    path: '/:pathMatch(.*)',
    redirect: '/404'
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
