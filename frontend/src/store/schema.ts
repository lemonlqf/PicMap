/*
 * @Author: 吕奇峰 1353041516@qq.com
 * @Date: 2024-12-13 00:41:27
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-15 21:05:07
 * @FilePath: \Code\picMap_fontend\src\store\schema.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import { judgeHadUploadImage } from '../utils/schema'
import { isGroupIdExist, createNewGroupName } from '@/utils/group'
import type { IGroupInfo, IImageInfo, IMapInfo, ISchema } from '@/type/schema'

// 地图schema
export const useSchemaStore = defineStore('schema', {
  state: () => ({
    schema: {} as ISchema,
    // 已经上传的图片
    uploadedImageIds: [] as string[]
  }),
  getters: {
    getSchema: state => state.schema as ISchema,
    getUploadedImageIds: state => state.uploadedImageIds ?? [] as string[],
    getGroupInfo: state => state.schema.groupInfo ?? [] as IGroupInfo[],
    getMapInfo: state => state.schema.mapInfo ?? {} as IMapInfo,
    getImageInfo: state => state.schema.imageInfo ?? {} as IImageInfo[]
  },
  actions: {
    setSchema(value) {
      this.schema = value
    },
    setSchemaAttr(key, value) {
      this.schema[key] = value
    },
    setMapAttr(key, value) {
      if (!this.schema.mapInfo) {
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
      // 删除已经上传的图片
      this.uploadedImageIds = this.uploadedImageIds.filter(item => {
        return item !== imageId
      })
    },
    deleteGroupInGroupInfo(groupId) {
      this.schema.groupInfo = this.schema.groupInfo.filter(item => {
        return item.id !== groupId
      })
      // 删除已经上传的分组
      this.uploadedImageIds = this.uploadedImageIds.filter(item => {
        return item !== groupId
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
    },
    pushImageToGroupInfo(imageId, groupId) {
      if (isGroupIdExist(groupId)) {
        const groupNumbers = this.schema.groupInfo.find(group => group.id === groupId).groupNumbers
        if (!groupNumbers.includes(imageId)) {
          groupNumbers.push(imageId)
        }
      } else {
        this.schema.groupInfo.push({
          id: groupId,
          name: createNewGroupName(groupId),
          groupNumbers: [imageId]
        })
      }
    },
  }
})
