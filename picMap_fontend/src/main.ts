/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-12 19:00:05
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-16 22:42:23
 * @FilePath: \Code\picMap_fontend\src\main.ts
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
import i18n from './i18n/index'
const app = createApp(App)

app.use(i18n).use(pinia).use(router).use(ElementPlus, { size: 'default', zIndex: 3000 })

app.mount('#app')