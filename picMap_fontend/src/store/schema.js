/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-16 14:26:40
 * @FilePath: \Code\picMap_fontend\src\store\schema.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import { judgeHadUploadImage } from '../utils/schema'

export const useSchemaStore = defineStore('schema', {
  state: () => ({
    schema: {},
    // 暂时还没有上传的图片，在保存schema时需要剔除掉这部分图片
    uploadedImageIds: []
  }),
  getters: {
    getSchema: state => state.schema,
    getUploadedImageIds: state => state.uploadedImageIds ?? []
  },
  actions: {
    setSchema(value) {
      this.schema = value
    },
    setSchemaAttr(key, value) {
      this.schema[key] = value
    },
    setMapAttr(key, value) {
      if (!this.schema.map) {
        this.schema.mapInfo = {}
      }
      this.schema.mapInfo[key] = value
    },
    pushImagesToImageInfo(value) {
      if (value.length) {
        value.forEach(item => {
          const isExist = this.schema.imageInfo.some(info => {
            return info.id === item.id || info.id === item.name
          })
          // 如果没有就添加
          !isExist && this.schema.imageInfo.push(item)
        })
      }
    },
    deleteImageInImageInfo(imageId) {
      this.schema.imageInfo = this.schema.imageInfo.filter(item => {
        return item.id !== imageId
      })
      // 删除已经上传的
      this.uploadedImageIds = this.uploadedImageIds.filter(item => {
        return item !== imageId
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
    },
    pushImageToUploadedImageIds(id) {
      if (!this.uploadedImageIds.includes(id)) {
        this.uploadedImageIds.push(id)
      }
    },
    setUploadedImageIds(value) {
      this.uploadedImageIds = value
    },
    deleteImageInUploadedImageIds(id) {
      this.uploadedImageIds = this.uploadedImageIds.filter(item => {
        return item !== id
      })
    }
  }
})
