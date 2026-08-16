/*
 * @Author: Do not edit
 * @Date: 2025-02-05 19:51:22
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-28 14:29:38
 * @FilePath: \PicMap\picMap_fontend\src\utils\Image.ts
 * @Description: 图片相关的工具函数，提供图片的上传、删除、获取等功能
 */
import { useSchemaStore } from '../store/schema'
import API from '@/wails/api'
import { fileToBase64 } from '@/utils/map'
import eventBus from '@/utils/eventBus'
import { ElMessage } from 'element-plus';
import { saveSchema } from './schema';
import markerService from '@/services/marker'
import type { IImageDetailInfo } from '@/type/image'
import type { IResult } from '@/type/schema'
import i18n from '@/i18n/index'

/**
 * @description: 图片缓存管理器, 单例模式
 * @param {*}
 * @return {*}
 */
class ImageCacheManager {
  private static instance: ImageCacheManager
  // 保存缩略图的map，集中在这里管理（大图 1000px）
  private imageUrlsMap: Map<string, string> = new Map()
  // marker 专用小图缓存（120px）
  private markerUrlsMap: Map<string, string> = new Map()
  // 原图缓存（完整分辨率，全景预览用）
  private fullImageUrlsMap: Map<string, string> = new Map()
  // in-flight 请求去重：key 为缓存键，value 为进行中的 Promise
  private pendingMap: Map<string, Promise<string>> = new Map()

  // 单例模式，按需创建
  static getInstance(): ImageCacheManager {
    if (!ImageCacheManager.instance) {
      ImageCacheManager.instance = new ImageCacheManager()
    }
    return ImageCacheManager.instance
  }

  /**
   * in-flight 去重：同一缓存键的并发请求共享同一个 Promise
   */
  fetchDedup(cacheKey: string, fetcher: () => Promise<string>): Promise<string> {
    const pending = this.pendingMap.get(cacheKey)
    if (pending) {
      return pending
    }
    const p = fetcher().finally(() => {
      this.pendingMap.delete(cacheKey)
    })
    this.pendingMap.set(cacheKey, p)
    return p
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

  addMarkerImageUrl(imageId: string, imageUrl: string) {
    try {
      this.markerUrlsMap.set(imageId, imageUrl)
      return true
    } catch {
      console.error('error in ImageCacheManager addMarkerImageUrl')
      return false
    }
  }

  addFullImageUrl(imageId: string, imageUrl: string) {
    try {
      this.fullImageUrlsMap.set(imageId, imageUrl)
      return true
    } catch {
      console.error('error in ImageCacheManager addFullImageUrl')
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

  getMarkerImageUrl(imageId: string) {
    try {
      return this.markerUrlsMap.get(imageId)
    } catch {
      console.error('error in ImageCacheManager getMarkerImageUrl')
    }
  }

  getFullImageUrl(imageId: string) {
    try {
      return this.fullImageUrlsMap.get(imageId)
    } catch {
      console.error('error in ImageCacheManager getFullImageUrl')
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

  /**
   * @description: 删除图片URL
   * @param {string} imageId - 图片的唯一标识符
   * @returns {boolean} 返回删除操作是否成功，如果发生错误则返回false
   * @return {*}
   */
  deleteImageUrl(imageId: string) {
    try {
      this.markerUrlsMap.delete(imageId)
      return this.imageUrlsMap.delete(imageId)
    } catch {
      console.error('error in ImageCacheManager deleteImageUrl')
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
 * @description: 获取单张图片的url（大图 1000px），内部实现缓存与 in-flight 去重
 * @param {string} imageId
 * @return {*}
 */
export async function getImageUrlById(imageId: string) {
  const cache = ImageCacheManager.getInstance()
  // 如果已经存在，则直接返回
  const cached = cache.getImageUrl(imageId)
  if (cached) {
    return cached
  }
  // in-flight 去重：并发调用同一图片时共享同一个请求
  return cache.fetchDedup(`large:${imageId}`, async () => {
    const res = await API.image.getImage({ imageId }) as any
    if (res.code !== 200 || !res.data?.file) {
      // 无缩略图不缓存，避免缓存坏 data URL
      return ''
    }
    const imageUrl = fileToBase64(res.data.file)
    cache.addImageUrl(imageId, imageUrl)
    return imageUrl
  })
}

/**
 * @description: 从缓存中获取 marker 专用小尺寸缩略图 url（120px）
 * @param {string} imageId
 * @return {*}
 */
export function getMarkerImageUrl(imageId: string) {
  return ImageCacheManager.getInstance().getMarkerImageUrl(imageId)
}

/**
 * @description: 获取 marker 专用小尺寸缩略图（120px），减少缩放加载时的解码开销
 * @param {string} imageId
 * @return {*}
 */
export async function getMarkerImageUrlById(imageId: string) {
  const cache = ImageCacheManager.getInstance()
  const cached = cache.getMarkerImageUrl(imageId)
  if (cached) {
    return cached
  }
  return cache.fetchDedup(`marker:${imageId}`, async () => {
    const res = await API.image.getMarkerImage({ imageId }) as any
    if (res.code !== 200 || !res.data?.file) {
      return ''
    }
    const imageUrl = fileToBase64(res.data.file)
    cache.addMarkerImageUrl(imageId, imageUrl)
    return imageUrl
  })
}

/**
 * @description: 批量获取 marker 专用小尺寸缩略图（120px），复用单张缓存与 in-flight 去重
 * @param {string[]} imageIds
 * @return {*}
 */
export async function getMarkerImageUrlByIds(imageIds: string[]) {
  return Promise.all(imageIds.map((imageId) => getMarkerImageUrlById(imageId)))
}

/**
 * @description: 获取原图（完整分辨率 base64），全景预览用，内部实现缓存与 in-flight 去重
 * @param {string} imageId
 * @return {*}
 */
export async function getFullImageUrlById(imageId: string) {
  const cache = ImageCacheManager.getInstance()
  const cached = cache.getFullImageUrl(imageId)
  if (cached) {
    return cached
  }
  return cache.fetchDedup(`full:${imageId}`, async () => {
    const res = await API.image.getFullImage({ imageId }) as any
    if (res.code !== 200 || !res.data?.file) {
      return ''
    }
    const imageUrl = fileToBase64(res.data.file)
    cache.addFullImageUrl(imageId, imageUrl)
    return imageUrl
  })
}

// 计算MB大小
export function calcMBSize(size: number) {
  return size ? (size / (1024 * 1000)).toFixed(2) + 'MB' : ''
}

/**
 * @description: 上传图片
 * @param {*} imageInfos
 * @param {Function} onProgress - 进度回调函数，参数为 (current: number, total: number)
 * @return {*}
 */
export async function uploadImages(imageInfos: IImageDetailInfo[], onProgress?: (current: number, total: number) => void): Promise<IResult[]> {
  const res = []
  const schemaStore = useSchemaStore()
  const total = imageInfos.length
  let current = 0

  // 筛选出符合上传条件的图片
  const uploadableImageInfos = [] as IImageDetailInfo[]
  for (const imageInfo of imageInfos) {
    // 如果不符合上传条件的，先不上传
    if (!canUpload(imageInfo)) {
      continue
    }
    uploadableImageInfos.push(imageInfo)
  }

  // 每批最多 4 张图片并发导入
  const BATCH_SIZE = 4
  for (let i = 0; i < uploadableImageInfos.length; i += BATCH_SIZE) {
    const batch = uploadableImageInfos.slice(i, i + BATCH_SIZE)
    // 请求后端接口导入图片，从原路径复制到用户图片目录
    const res1 = await API.image.importImages({ images: batch })
    // 保存返回的接口结果
    res.push(res1)
    if (res1.code !== 200) {
      batch.forEach(imageInfo => {
        ElMessage.warning(`${imageInfo.name} ${i18n.global.t('description.uploadFailed')}`)
      })
      continue
    }
    batch.forEach((imageInfo) => {
      // 上传成功后，将预览图作为缩略图缓存
      if (imageInfo.preview) {
        const previewUrl = `data:image/jpeg;base64,${imageInfo.preview}`
        ImageCacheManager.getInstance().addImageUrl(imageInfo.id, previewUrl)
      }
      // 将图片保存到已经上传的地方
      schemaStore.pushImageToUploadedImageIds(imageInfo.id)
      // marker中可以移动的图片重新设置为不可移动
      const marker = markerService.getMarkerById(imageInfo.id)
      if (marker) {
        // 将 marker 设置为不可移动
        marker?.dragging?.disable?.()
      }
      // 更新进度
      current++
      onProgress?.(current, total)
    })
  }
  return res
}

/**
 * @description: 判断是否允许上传
 * @param {IImageDetailInfo} imageInfo
 * @return {*}
 */
function canUpload(imageInfo: IImageDetailInfo): boolean {
  const hasPath = !!imageInfo.path
  const hasGPS = !!imageInfo.GPSInfo

  // 仅允许“有源文件路径 + 有GPS信息”的图片进入上传流程
  return hasPath && hasGPS
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
    // 删除图片缓存
    ImageCacheManager.getInstance().deleteImageUrl(imageId)
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
