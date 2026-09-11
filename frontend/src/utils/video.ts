/*
 * 轨迹视频相关工具函数
 * @Description: 视频选择、导入、schema 操作
 */
import { useSchemaStore } from '@/store/schema'
import API from '@/wails/api'
import { saveSchema } from './schema'
import { fileToBase64 } from './map'
import markerService from '@/services/marker'
import { ElMessage } from 'element-plus'
import type { ISelectedVideo, IImportVideoFile } from '@/type/video'
import type { IVideoInfo } from '@/type/schema'

// 共享的"选择视频"上下文：同一时刻只有一个入口消费后端解析事件。
// 轨迹对齐弹窗内从本地选择视频时置为 'alignDialog'，避免上传面板同时把该批视频加入待上传列表。
export const videoSelectContext = { owner: '' as '' | 'uploadPanel' | 'alignDialog' }

// 视频封面缓存（videoId -> data URL），in-flight 去重
const videoCoverMap = new Map<string, string>()
const pendingCoverMap = new Map<string, Promise<string>>()

/**
 * @description: 获取视频第一帧封面 URL（data URL），带缓存与并发去重
 * @param {string} videoId
 * @return {*}
 */
export function getVideoThumbnailUrl(videoId: string): Promise<string> {
  const cached = videoCoverMap.get(videoId)
  if (cached) return Promise.resolve(cached)
  const pending = pendingCoverMap.get(videoId)
  if (pending) return pending
  const p = API.video.getVideoThumbnail({ videoId }).then((res: any) => {
    if (res.code !== 200 || !res.data?.file) return ''
    return fileToBase64(res.data.file)
  }).then((url: string) => {
    if (url) videoCoverMap.set(videoId, url)
    return url
  }).catch(() => {
    return ''
  }).finally(() => {
    pendingCoverMap.delete(videoId)
  })
  pendingCoverMap.set(videoId, p)
  return p
}

// 原路径封面缓存（path -> data URL），in-flight 去重
const pathCoverMap = new Map<string, string>()
const pendingPathCoverMap = new Map<string, Promise<string>>()

/**
 * @description: 从任意路径提取视频首帧封面 URL（data URL），带缓存与并发去重。
 * 用于待上传视频（尚未复制到用户目录）的封面预览。
 * @param {string} path 视频源文件路径
 * @return {*}
 */
export function getVideoFramePreviewUrl(path: string): Promise<string> {
  if (!path) return Promise.resolve('')
  const cached = pathCoverMap.get(path)
  if (cached) return Promise.resolve(cached)
  const pending = pendingPathCoverMap.get(path)
  if (pending) return pending
  const p = API.video.getVideoFramePreview({ path }).then((res: any) => {
    if (res.code !== 200 || !res.data?.file) return ''
    return fileToBase64(res.data.file)
  }).then((url: string) => {
    if (url) pathCoverMap.set(path, url)
    return url
  }).catch(() => {
    return ''
  }).finally(() => {
    pendingPathCoverMap.delete(path)
  })
  pendingPathCoverMap.set(path, p)
  return p
}

/**
 * @description: 打开原生对话框选择视频（秒回路径，后台分批解析经事件推送）
 */
export async function selectVideos() {
  return API.video.selectVideos()
}

/**
 * @description: 导入视频到用户视频目录，返回 VideoInfo
 * @param {IImportVideoFile} file
 */
export async function importVideo(file: IImportVideoFile): Promise<IVideoInfo | null> {
  const res = await API.video.importVideo(file)
  if (res.code === 200) {
    return res.data as IVideoInfo
  }
  ElMessage.error(res.msg || '视频导入失败')
  return null
}

/**
 * @description: 将视频写入 schema 的 videoInfo 数组（去重）
 * @param {IVideoInfo} video
 */
export function pushVideoToSchema(video: IVideoInfo) {
  const schemaStore = useSchemaStore()
  const schema = schemaStore.getSchema
  if (!schema.videoInfo) {
    schema.videoInfo = []
  }
  const exist = schema.videoInfo.find(v => v.id === video.id)
  if (!exist) {
    // 新导入的视频插入到最前面，确保已上传列表置顶显示
    schema.videoInfo.unshift(video)
  }
}

/**
 * @description: 关联视频到某条 GPX 轨迹（写入 trackInfo 的 videos 数组）
 * @param {string} trackId
 * @param {string} videoId
 * @param {number} timeOffsetMs 视频起点相对 GPX 起点的偏移（毫秒）
 */
export function associateVideoToTrack(trackId: string, videoId: string, timeOffsetMs: number) {
  const schemaStore = useSchemaStore()
  const schema = schemaStore.getSchema
  const track = schema.trackInfo?.find(t => t.id === trackId)
  if (!track) return
  if (!track.videos) {
    track.videos = []
  }
  const exist = track.videos.find(v => v.videoId === videoId)
  if (exist) {
    exist.timeOffsetMs = timeOffsetMs
  } else {
    track.videos.push({ videoId, timeOffsetMs })
  }
}

/**
 * @description: 删除视频（从 schema 的 videoInfo 及所有 trackInfo.videos 中移除）
 * @param {string[]} videoIds
 */
export async function deleteVideos(videoIds: string[]) {
  const schemaStore = useSchemaStore()
  const schema = schemaStore.getSchema
  // 从 videoInfo 移除
  if (schema.videoInfo) {
    schema.videoInfo = schema.videoInfo.filter(v => !videoIds.includes(v.id))
  }
  // 从所有 trackInfo.videos 移除
  schema.trackInfo?.forEach(track => {
    if (track.videos) {
      track.videos = track.videos.filter(v => !videoIds.includes(v.videoId))
    }
  })
  // 同步移除内存中的已上传视频 id，使其回到待上传列表
  videoIds.forEach(id => {
    schemaStore.deleteVideoInUploadedVideoIds(id)
  })
  await saveSchema()
  // 移除地图上的视频标记
  videoIds.forEach(videoId => {
    markerService.deleteMarkerById(videoId)
  })
  return API.video.deleteVideos({ videoIds })
}
