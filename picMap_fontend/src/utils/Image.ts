/*
 * @Author: Do not edit
 * @Date: 2025-02-05 19:51:22
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2025-11-07 19:28:08
 * @FilePath: \PicMap\picMap_fontend\src\utils\Image.ts
 * @Description:
 */
import { useSchemaStore } from '../store/schema'
import API from '@/http/index'
import imageHttp from '@/http/modules/image'
import { fileToBase64 } from '@/utils/map'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus';
import { saveSchema } from './schema';
import markerService from '@/services/marker'
import type { IImageDetailInfo } from '@/type/image'
import type { IHttpResponse } from '@/type/http'
import i18n from '@/i18n/index'

// 单位MB
const LARGE_IMAGE_SIZE = 50

/**
 * @description: 图片缓存管理器, 单例模式
 * @param {*}
 * @return {*}
 */
class ImageCacheManager {
  private static instance: ImageCacheManager
  // 保存缩略图的map，集中在这里管理
  private imageUrlsMap: Map<string, string> = new Map()

  // 单例模式，按需创建
  static getInstance(): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager()
    }
    return ImageCacheManager.instance
  }

  addImageUrl(imageId: string, imageUrl: string) {
    try {
      this.imageUrlsMap.set(imageId, imageUrl)
      return true
    } catch {
      console.error('error in ImageCacheManager addImageUrl')
      return false
    }
  }

/**
 * 根据图片ID获取图片URL
 * @param {string} imageId - 图片的唯一标识符
 * @returns {string | undefined} 返回对应的图片URL，如果未找到则返回undefined
 */
  getImageUrl(imageId: string) {
    try {
    // 尝试从imageUrlsMap中获取指定imageId对应的URL
      return this.imageUrlsMap.get(imageId)
    } catch {
    // 如果获取过程中发生错误，捕获异常并在控制台输出错误信息
      console.error('error in ImageCacheManager getImageUrl')
    }
  }

  isImageExist(imageId: string) {
    try {
      return this.imageUrlsMap.has(imageId)
    } catch {
      console.error('error in ImageCacheManager isImageExist')
      return false
    }
  }
}

export const imageUrlsMap = ImageCacheManager.getInstance()

/**
 * @description: 添加图片到缓存
 * @param {*}
 * @return {*}
 */
export function addImageUrl(imageId: string, imageUrl: string): any {
  return ImageCacheManager.getInstance().addImageUrl(imageId, imageUrl)
}

/**
 * @description: 从缓存中获取图片url
 * @param {*}
 * @return {*}
 */
export function getImageUrl(imageId: string) {
  return ImageCacheManager.getInstance().getImageUrl(imageId)
}

/**
 * @description: 判断图片在缓存的map中是否已经存在
 * @param {*}
 * @return {*}
 */
export function isImageExist(imageId: string) {
  return ImageCacheManager.getInstance().isImageExist(imageId)
}

/**
 * @description: 获取单张图片的url，内部实现了复用的逻辑
 * @param {string} imageId
 * @return {*}
 */
export async function getImageUrlById(imageId: string) {
  // 如果已经存在，则直接返回
  if (isImageExist(imageId)) {
    return getImageUrl(imageId)
  }
  // 否则请求图片
  const res = await imageHttp.getImage({ imageId }) as any
  if (res.code !== 200) {
    return ''
  }
  const imageUrl = fileToBase64(res.data.file)
  // 将图片保存到映射表中
  addImageUrl(imageId, imageUrl)
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
  const requestImageIds = [] as string[]
  imageIds.forEach((imageId, index) => {
    const imageUrl = getImageUrl(imageId)
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
  const res = await imageHttp.getImages({ imageIds: requestImageIds }) as any
  if (res.code === 200) {
    for (let i = 0; i < resImageUrls.length; i++) {
      if (resImageUrls[i] === undefined) {
        // 取第一个图片
        const imageUrl = fileToBase64((res.data.files as string[]).shift())
        // 设置到数组中空的地方
        resImageUrls[i] = imageUrl
        // 保存一下
        addImageUrl(imageIds[i], imageUrl)
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
  for (let i = 0; i < imageInfos.length; i++) {
    const imageInfo = imageInfos[i]
    // 如果不符合上传条件的，先不上传
    if (!canUpload(imageInfo)) {
      continue
    }
    if (!imageSizeunderLimit(imageInfo.url)) {
      ElMessage.warning(`${imageInfo.name} ${i18n.global.t('description.largeSize')} ${LARGE_IMAGE_SIZE}MB`)
      continue
    }
    // 请求后端接口上传图片，保存本地文件目录下
    const res1 = await API.image.uploadImages({ images: [imageInfo] })
    // 保存返回的接口结果
    res.push(res1)
    if (res1.code !== 200) {
      ElMessage.warning(`${imageInfo.name} ${i18n.global.t('description.uploadFailed')}`)
      continue
    }
    // 将图片保存到已经上传的地方
    schemaStore.pushImageToUploadedImageIds(imageInfo.id)
    // marker中可以移动的图片重新设置为不可移动
    const marker = markerService.getMarkerById(imageInfo.id)
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
  const hasUrl = !!imageInfo.url
  const hasGPS = !!imageInfo.GPSInfo

  return hasUrl && hasGPS
}

function imageSizeunderLimit(url: any) {
  let size = 0
  if (typeof url === 'string' && url.startsWith('data:')) {
    // base64
    size = base64Size(url)
  }
  // 100MB = 100 * 1024 * 1024
  const underLimit = (size <= LARGE_IMAGE_SIZE * 1024 * 1024)
  return underLimit
}

function base64Size(base64: string): number {
  // 去掉 data:image/png;base64, 头部
  const base64Str = base64.split(',')[1] || ''
  // 1 字节 = 8 bit，base64 每 4 个字符代表 3 字节
  return Math.floor(base64Str.length * 3 / 4)
}

/**
 * @description: 删除分组，会处理schema，marker中的图片
 * @param {*} imageId
 * @return {*}
 */
export async function deleteImageById(imageId: string) {
  const schemaStore = useSchemaStore()
  // 删除schema中的分组信息
  schemaStore.deleteImageInImageInfo(imageId)
  // TODO:删除分组中的图片
  // 通知上传组件，删除对应的文件
  eventBus.emit('delete-image', imageId)
  saveSchema()
  return Promise.all([API.image.deleteImages({ deleteImages: [imageId] })]).then(res => {
    markerService.deleteMarkerById(imageId)
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


