/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-12 19:00:05
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-13 11:09:05
 * @FilePath: \picMap_fontend\src\main.js
 * @Description:
 */

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from '@/router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
const pinia = createPinia()

createApp(App).use(router).use(pinia).use(ElementPlus, { size: 'default', zIndex: 3000 }).mount('#app')
