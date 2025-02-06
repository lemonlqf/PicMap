/*
 * @Author: Do not edit
 * @Date: 2025-01-26 18:21:16
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-06 20:08:05
 * @FilePath: \Code\picMap_fontend\src\utils\schema.js
 * @Description:
 */
import { useSchemaStore } from '@/store/schema'
import { cloneDeep } from 'lodash-es'
import API from '@/http/index.js'

/**
 * @description: 获取图片组和图片列表，用于直接在地图上展示
 * @return {*}
 */
export function getGroupAndImageList() {
  const schemaStore = useSchemaStore()
  console.log('-----------', schemaStore.getSchema)
  const imageInfo = cloneDeep(schemaStore.getSchema.imageInfo)
  const groupInfo = cloneDeep(schemaStore.getSchema.groupInfo)
  const imageIdInGroup = []
  const res = []
  // 将分组的信息放到res中
  groupInfo?.forEach?.(item => {
    // 将本来在放到imageIdInGroup，后续剩余的照片就不放到返回的结果中
    item.groupNumbers && imageIdInGroup.push(...item.groupNumbers)
    item.type = 'group'
    res.push(item)
  })
  // 将不在分组内的照片放到res中
  imageInfo?.forEach?.(item => {
    if (!imageIdInGroup.includes(item.id)) {
      item.type = 'image'
      res.push(item)
    }
  })
  return res
}

/**
 * @description: 获取图片或者分组中schema的信息
 * @param {*} id
 * @return {*}
 */
export function getSchemaInfoById(id) {
  const schemaStore = useSchemaStore()
  const groupInfo = schemaStore.getSchema.groupInfo
  const imageInfo = schemaStore.getSchema.imageInfo
  return [...groupInfo, ...imageInfo].filter(item => {
    return item.id === id
  })[0]
}

/**
 * @description: 判断图片是否已经上传了
 * @param {*} id
 * @return {*}
 */
export function judgeHadUploadImage(id) {
  const schemaStore = useSchemaStore()
  return schemaStore.getUploadedImageIds.some(item => {
    return item === id
  })
}

/**
 * @description: 获取schema中imageInfo的所有id
 * @return {*}
 */
export function getAllImageIdInSchema() {
  const schemaStore = useSchemaStore()
  const res = schemaStore?.getSchema?.imageInfo?.map(item => item.id)
  return res
}

/**
 * @description: 保存schema
 * @return {*}
 */
export async function saveSchema() {
  const schemaStore = useSchemaStore()
  const schema = cloneDeep(schemaStore.getSchema)
  const updateImages = schemaStore.getUploadedImageIds
  // 只保留已经上传的图片信息（剔除未上传的）
  schema.imageInfo = schema.imageInfo.filter(item => {
    return updateImages.includes(item.id)
  })
  schema?.imageInfo?.forEach?.(item => {
    // 删除url，精简schema
    delete item.url
  })
  const res = await API.schema.setSchema({ schema: JSON.stringify(schema) })
  return res
}
