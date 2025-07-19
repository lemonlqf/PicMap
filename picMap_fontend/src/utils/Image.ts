/*
 * @Author: Do not edit
 * @Date: 2025-02-05 19:51:22
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-07-19 23:44:04
 * @FilePath: \Code\picMap_fontend\src\utils\Image.ts
 * @Description:
 */
import { useSchemaStore } from '../store/schema'
import { getMarkerById } from '@/utils/map'
import API from '@/http/index'
import imageHttp from '@/http/modules/image'
import { fileToBase64 } from '@/utils/map'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus';
import { saveSchema } from './schema';
import { deleteMarkerById, MAP_INSTANCE } from '@/utils/map';
import type { IImageDetailInfo } from '@/type/image'
import type { IHttpResponse } from '@/type/http'


// 一个地方集中管理图片，因为一个图片可能在多个分组中
// 保存缩略图的map
// key: imageId, value: imageUrl
export const imageUrlsMap = new Map()

export function addImageUrl(imageId, imageUrl)  {
  imageUrlsMap.set(imageId, imageUrl)
}

export function getImageUrl (imageId){
  return imageUrlsMap.get(imageId)
}

/**
 * @description: 获取单张图片的url，内部实现了复用的逻辑
 * @param {string} imageId
 * @return {*}
 */
export async function getImageUrlById(imageId: string) {
  // 如果已经存在，则直接返回
  if (imageUrlsMap.has(imageId)) {
    return imageUrlsMap.get(imageId)
  }
  // 否则请求图片
  const res = await imageHttp.getImage({imageId})
  if (res.code !== 200) {
    return ''
  }
  const imageUrl = fileToBase64(res.data.file)
  // 将图片保存到映射表中
  imageUrlsMap.set(imageId, imageUrl)
  return imageUrl
}

/**
 * @description: 获取多张图片的url,传入完整的imageId数组，复用逻辑内部实现了
 * @param {string} imageIds
 * @return {*}
 */
export async function getImageUrlByIds(imageIds: string[]) {
  // 返回的图片
  const resImageUrls = new Array(imageIds.length).fill(undefined)
  const requestImageIds = []
  imageIds.forEach((imageId, index) => {
    const imageUrl = imageUrlsMap.get(imageId)
    if (imageUrl) {
      resImageUrls[index] = imageUrl
    } else {
      requestImageIds.push(imageId)
    }
  })
  // 如果没有需要请求的图片，则直接返回
  if (requestImageIds.length === 0) {
    return resImageUrls
  }
  // 请求没有在Map中存在的图片
  const res = await imageHttp.getImages({ imageIds: requestImageIds })
  if (res.code === 200) {
    for (let i = 0; i < resImageUrls.length; i++) {
      if (resImageUrls[i] === undefined) {
        // 取第一个图片
        const imageUrl = fileToBase64((res.data.files as string[]).shift())
        // 设置到数组中空的地方
        resImageUrls[i] = imageUrl
        // 保存一下
        imageUrlsMap.set(imageIds[i], imageUrl)
      }
    }
    return resImageUrls
  }
}

// 计算MB大小
export function calcMBSize(size: number) {
  return size ? (size / (1024 * 1000)).toFixed(2) + 'MB' : ''
}

/**
 * @description: 上传图片
 * @param {*} imageInfos
 * @return {*}
 */
export async function uploadImages(imageInfos: IImageDetailInfo[]): Promise<IHttpResponse[]> {
  const res = []
  const schemaStore = useSchemaStore()
  for(let i = 0; i < imageInfos.length; i ++) {
    const imageInfo = imageInfos[i]
    // 如果不符合上传条件的，先不上传
    if (!canUpload(imageInfo)) {
      continue
    }
    // 请求后端接口上传图片，保存本地文件目录下
    const res1 = await API.image.uploadImages({ images: [imageInfo] })
    // 保存返回的接口结果
    res.push(res1)
    if (res1.code !== 200) {
      ElMessage.warning(`${imageInfo.name} 上传失败！`)
      continue
    }
    // 将图片保存到已经上传的地方
    schemaStore.pushImageToUploadedImageIds(imageInfo.id)
    // marker中可以移动的图片重新设置为不可移动
    const marker = getMarkerById(imageInfo.id, MAP_INSTANCE)
    if (marker) {
      // 将 marker 设置为不可移动
      marker?.dragging?.disable?.()
    }
  }
  return res
}

/**
 * @description: 判断是否允许上传
 * @param {IImageDetailInfo} imageInfo
 * @return {*}
 */
function canUpload(imageInfo: IImageDetailInfo): boolean {
  const res = (
    imageInfo.url &&
    imageInfo.GPSInfo
  )
  return res ? true : false
}

/**
 * @description: 删除分组，会处理schema，marker中的图片
 * @param {*} imageId
 * @return {*}
 */
export async function deleteImageById(imageId) {
  const schemaStore = useSchemaStore()
  // 删除schema中的分组信息
  schemaStore.deleteImageInImageInfo(imageId)
  // TODO:删除分组中的图片
  // 通知上传组件，删除对应的文件
  eventBus.emit('delete-image', imageId)
  saveSchema()
  return Promise.all([API.image.deleteImages({ deleteImages: [imageId] })]).then(res => {
    deleteMarkerById(imageId, MAP_INSTANCE)
    const tipMsg = res.reduce((msg, item) => {
      return msg + item.data
    }, '')
    ElMessage.success(tipMsg)
    // console.log('promise all ==>', res)
  })
}

/**
 * @description: 判断图片是否在imageInfo
 * @param {string} imageId
 * @return {*}
 */
export function isImageExistInImageInfo(imageId: string) {
  const schemaStore = useSchemaStore()
  const imageInfo = schemaStore.getImageInfo
  return imageInfo.some(item => {
    return item.id === imageId
  })
}


