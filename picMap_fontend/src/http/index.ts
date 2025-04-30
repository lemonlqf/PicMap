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
