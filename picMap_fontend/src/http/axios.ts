/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:07:10
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-13 15:21:00
 * @FilePath: \Code\picMap_fontend\src\http\axios.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/store/appSchema'

const ip = 'http://localhost'
const port = '5120'

const http = axios.create({
  baseURL: `${ip}:${port}`,
  timeout: 10000
})

// 添加请求拦截器
http.interceptors.request.use(
  function (config) {

    const appStore = useAppStore()
    // 请求添加上userId
    const currentUserId = appStore.getCurrentUserInfo.userId; // 这里可以从 store、cookie、localStorage 获取
    // GET 请求
    if (config.method === 'get') {
      config.params = config.params || {};
      config.params.currentUserId = currentUserId;
    }
    // POST/PUT/PATCH 请求
    else if (
      config.method === 'post' ||
      config.method === 'put' ||
      config.method === 'patch'
    ) {
      if (config.headers && config.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
        // 如果是表单，需特殊处理
        const params = new URLSearchParams(config.data || '');
        params.set('currentUserId', currentUserId);
        config.data = params.toString();
      } else {
        // 普通 JSON
        config.data = config.data || {};
        config.data.currentUserId = currentUserId;
      }
    }
    return config;
  },
  function (error) {
    // 对请求错误做些什么
    return Promise.reject(error)
  }
)

// 添加响应拦截器
http.interceptors.response.use(
  function (response) {
    // 2xx 范围内的状态码都会触发该函数。
    // 对响应数据做点什么
    return Promise.resolve(response.data)
  },
  function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    ElMessage.error(error.msg ?? error.message)
    // 对响应错误做点什么
    return Promise.reject(error)
  }
)

export default http
