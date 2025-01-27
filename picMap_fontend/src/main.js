/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-12 19:00:05
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-27 19:39:01
 * @FilePath: \Code\picMap_fontend\src\main.js
 * @Description:
 */

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { createPinia } from 'pinia'
import router from '@/router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/style/index.scss'
const pinia = createPinia()

createApp(App).use(pinia).use(router).use(ElementPlus, { size: 'default', zIndex: 3000 }).mount('#app')
