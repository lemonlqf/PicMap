/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-12 19:00:05
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-12 14:05:16
 * @FilePath: \PicMap\picMap_fontend\src\main.ts
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
import 'animate.css';
const app = createApp(App)

app.use(i18n).use(pinia).use(router).use(ElementPlus, { size: 'default', zIndex: 3000 })

app.mount('#app')