/*
 * @Author: Do not edit
 * @Date: 2025-04-29 18:33:43
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-06-29 16:22:21
 * @FilePath: \Code\picMap_fontend\src\http\index.ts
 * @Description: 
 */
const modules = (import.meta as any).glob('./modules/*')
const api = {}
for (const path in modules) {
  modules[path]().then(mod => {
    const name = path.replace(/^\.\/modules\/(.*)\.\w+$/, '$1')
    api[name] = mod.default
  })
}

type IAPI = {
  [key: string]: any // 动态键值对，值可以是任意类型
}

const API: IAPI = api

export default API
