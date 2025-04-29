const modules = import.meta.glob('./modules/*.ts')
const api = {}
for (const path in modules) {
  modules[path]().then(mod => {
    const name = path.replace(/^\.\/modules\/(.*)\.\w+$/, '$1')
    api[name] = mod.default
  })
}

const API = api

export default API
