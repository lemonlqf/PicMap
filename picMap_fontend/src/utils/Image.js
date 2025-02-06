/*
 * @Author: Do not edit
 * @Date: 2025-02-05 19:51:22
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-02-05 19:56:41
 * @FilePath: \Code\picMap_fontend\src\utils\Image.js
 * @Description:
 */
import { useSchemaStore } from '../store/schema'
import API from '@/http/index.js'

// 计算MB大小
export function calcMBSize(size) {
  return size ? (size / (1024 * 1000)).toFixed(2) + 'MB' : ''
}

export async function uploadImages(imageInfos) {
  const schemaStore = useSchemaStore()
  imageInfos.forEach(imageInfo => {
    // 将图片
    schemaStore.pushImageToUploadedImageIds(imageInfo.id)
  })
  const res1 = await API.image.uploadImages({ images: imageInfos })
  return res1
}
