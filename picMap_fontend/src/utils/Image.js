/*
 * @Author: Do not edit
 * @Date: 2025-02-05 19:51:22
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-15 21:07:26
 * @FilePath: \Code\picMap_fontend\src\utils\Image.js
 * @Description:
 */
import { useSchemaStore } from '../store/schema'
import { getMarkerById } from '@/utils/map'
import API from '@/http/index.js'

// 计算MB大小
export function calcMBSize(size) {
  return size ? (size / (1024 * 1000)).toFixed(2) + 'MB' : ''
}

/**
 * @description: 上传图片
 * @param {*} imageInfos
 * @return {*}
 */
export async function uploadImages(imageInfos, map) {
  const schemaStore = useSchemaStore()
  imageInfos.forEach(imageInfo => {
    // 将图片保存到已经上传的地方
    schemaStore.pushImageToUploadedImageIds(imageInfo.id)
    // marker中可以移动的图片重新设置为不可移动
    const marker = getMarkerById(imageInfo.id, map)
    if (marker) {
      // 将 marker 设置为不可移动
      marker?.dragging?.disable?.()
    }
  })
  const res1 = await API.image.uploadImages({ images: imageInfos })
  return res1
}
