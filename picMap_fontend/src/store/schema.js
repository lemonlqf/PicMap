/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 13:37:37
 * @FilePath: \Code\picMap_fontend\src\store\schema.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import { isExistInImageInfo } from '../utils/schema'

export const useSchemaStore = defineStore('schema', {
  state: () => ({
    schema: {}
  }),
  getters: {
    getSchema: state => state.schema
  },
  actions: {
    setSchema(value) {
      this.schema = value
    },
    setSchemaAttr(key, value) {
      this.schema[key] = value
    },
    pushImagesToImageInfo(value) {
      if (value.length) {
        value.forEach(item => {
          // 如果没有就添加
          !isExistInImageInfo(item.id) && this.schema.imageInfo.push(item)
        })
      }
    },
    deleteImageInImageInfo(imageId) {
      this.schema.imageInfo = this.schema.imageInfo.filter(item => {
        return item.id !== imageId
      })
    },
    setVersion(value) {
      this.schema.version = value
    },
    setGroupInfo(value) {
      this.schema.groupInfo = value
    },
    setImageInfo(value) {
      this.schema.imageInfo = value
    }
  }
})
