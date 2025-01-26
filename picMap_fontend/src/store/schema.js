/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-26 18:29:23
 * @FilePath: \Code\picMap_fontend\src\store\schema.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'

export const useSchemaStore = defineStore('schema', {
  state: () => ({
    schema: {},
    version: '',
    // 所有分组的数据
    groupInfo: [],
    // 所有图片的数据
    imageInfo: []
  }),
  getters: {
    getSchema: state => state.schema,
    getVersion: state => state.version,
    getGroupInfo: state => state.groupInfo,
    getImageInfo: state => state.imageInfo
  },
  actions: {
    setSchema(value) {
      this.schema = value
      this.setVersion(value.version)
      this.setGroupInfo(value.groupInfo)
      this.setImageInfo(value.imageInfo)
    },
    setVersion(value) {
      this.version = value
    },
    setGroupInfo(value) {
      this.groupInfo = value
    },
    setImageInfo(value) {
      this.imageInfo = value
    }
  }
})
