/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:07:10
 * @LastEditors: 吕奇峰 1353041516@qq.com
 * @LastEditTime: 2024-12-13 01:14:46
 * @FilePath: \picMap_fontend\src\http\index.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import axios from 'axios'

const baseURL = 'http://localhost:5001'

const http = axios.create({
  baseURL: baseURL,
  timeout: 3000
})

// 添加请求拦截器
http.interceptors.request.use(
  function (config) {
    // 在发送请求之前做些什么
    return config
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
    return response
  },
  function (error) {
    // 超出 2xx 范围的状态码都会触发该函数。
    // 对响应错误做点什么
    return Promise.reject(error)
  }
)

export default http
