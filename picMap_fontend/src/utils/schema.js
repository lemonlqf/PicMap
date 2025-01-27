/*
 * @Author: Do not edit
 * @Date: 2025-01-26 18:21:16
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-01-27 20:45:26
 * @FilePath: \Code\picMap_fontend\src\utils\schema.js
 * @Description:
 */
import { useSchemaStore } from '@/store/schema'
import { cloneDeep } from 'lodash-es'

/**
 * @description: 获取图片组和图片列表，用于直接在地图上展示
 * @return {*}
 */
export function getGroupAndImageList() {
  const schemaStore = useSchemaStore()
  console.log('-----------', schemaStore.getImageInfo)
  const imageInfo = cloneDeep(schemaStore.getImageInfo, schemaStore.getGroupInfo, schemaStore.getSchema)
  const groupInfo = cloneDeep(schemaStore.getGroupInfo)
  const imageIdInGroup = []
  const res = []
  // 将分组的信息放到res中
  groupInfo.forEach(item => {
    // 将本来在放到imageIdInGroup，后续剩余的照片就不放到返回的结果中
    item.groupNumbers && imageIdInGroup.push(...item.groupNumbers)
    item.type = 'group'
    res.push(item)
  })
  // 将不在分组内的照片放到res中
  imageInfo.forEach(item => {
    if (!imageIdInGroup.includes(item.id)) {
      item.type = 'image'
      res.push(item)
    }
  })
  return res
}

/**
 * @description: 判断id是否存在于图片信息中
 * @param {*} id
 * @return {*}
 */
export function isExistInImageInfo(id) {
  const schemaStore = useSchemaStore()
  const imageInfo = schemaStore.getImageInfo
  return imageInfo.some(item => item?.id === id)
}
