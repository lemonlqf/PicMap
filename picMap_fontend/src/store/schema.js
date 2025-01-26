/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-26 16:32:15
 * @FilePath: \Code\picMap_fontend\src\store\schema.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import { version } from 'vue'

export const useSchemaStore = defineStore('schema', {
  state: () => ({
    schema: {},
    version: ''
  }),
  getters: {
    getSchema: state => state.schema,
    getVersion: state => state.version
  },
  actions: {
    setSchema(value) {
      this.schema = value
    },
    setVersion(value) {
      this.version = value
    }
  }
})
