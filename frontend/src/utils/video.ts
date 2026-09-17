/*
 * 轨迹视频相关工具函数
 * @Description: 视频选择、导入、schema 操作
 */
import { useSchemaStore } from '@/store/schema'
import API from '@/wails/api'
import { saveSchema, editSchemaAttrAndSave } from './schema'
import { fileToBase64 } from './map'
import { isVideoExistInOtherGroup } from './group'
import markerService from '@/services/marker'
import { ElMessage } from 'element-plus'
import type { ISelectedVideo, IImportVideoFile } from '@/type/video'
import type { IVideoInfo } from '@/type/schema'

// 共享的"选择视频"上下文：同一时刻只有一个入口消费后端解析事件。
// 轨迹对齐弹窗内从本地选择视频时置为 'alignDialog'，避免上传面板同时把该批视频加入待上传列表。
export const videoSelectContext = { owner: '' as '' | 'uploadPanel' | 'alignDialog' }

/**
 * @description: 从文件名解析视频起始时刻（与后端 ParseStartTimeFromName 规则一致，作为兜底）
 * 支持 DJI_20251130121358_0033_D、20260820_171710、IMG_20260820_171710 等
 * @param {string} [name]
 * @return {number} epoch 毫秒，解析失败返回 0
 */
export function parseVideoNameTimeMs(name: string | undefined): number {
  if (!name) return 0
  const m = name.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})[\s_\-]?(\d{2})[-_]?(\d{2})[-_]?(\d{2})/)
  if (!m) return 0
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  const ms = date.getTime()
  return isNaN(ms) ? 0 : ms
}

/**
 * @description: 获取视频起始绝对时刻（优先用文件解析值，缺失时用文件名解析兜底）
 * @param {IVideoInfo} [video]
 * @return {number} epoch 毫秒，无时间信息返回 0
 */
export function getVideoStartMs(video: IVideoInfo | undefined): number {
  return video?.startTimeMs || parseVideoNameTimeMs(video?.name) || 0
}

/**
 * @description: 按视频起始时刻升序排序（无时间信息的排在最后）
 * @param {string[]} videoIds
 * @return {string[]} 排序后的视频 id 列表
 */
export function sortVideoIdsByTime(videoIds: string[]): string[] {
  const schemaStore = useSchemaStore()
  const videoInfo = schemaStore.getSchema.videoInfo || []
  return [...videoIds].sort((a, b) => {
    const ta = getVideoStartMs(videoInfo.find(v => v.id === a))
    const tb = getVideoStartMs(videoInfo.find(v => v.id === b))
    if (!ta && !tb) return 0
    if (!ta) return 1
    if (!tb) return -1
    return ta - tb
  })
}

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
 * @description: 判断视频是否存在于指定分组中（不传 groupId 则判断是否在任意分组中）
 * @param {string} videoId
 * @param {string} [groupId]
 * @return {boolean}
 */
export function isVideoInGroup(videoId: string, groupId?: string): boolean {
  const schemaStore = useSchemaStore()
  const groupList = schemaStore.getGroupInfo
  if (groupId) {
    return !!groupList.find(group => group.id === groupId)?.videoNumbers?.includes(videoId)
  }
  return groupList.some(group => group.videoNumbers?.includes(videoId))
}

/**
 * @description: 根据视频 id 获取其所属的分组 id 列表
 * @param {string} videoId
 * @return {string[]}
 */
export function getGroupIdsByVideoId(videoId: string): string[] {
  const schemaStore = useSchemaStore()
  return schemaStore.getGroupInfo
    .filter(group => group.videoNumbers?.includes(videoId))
    .map(group => group.id)
}

/**
 * @description: 将视频加入指定分组（写入 groupInfo[].videoNumbers，去重）
 * @param {string} groupId
 * @param {string} videoId
 */
export function addVideoToGroup(groupId: string, videoId: string) {
  const schemaStore = useSchemaStore()
  const group = schemaStore.getGroupInfo.find(item => item.id === groupId)
  if (!group) return
  if (!group.videoNumbers) {
    group.videoNumbers = []
  }
  if (!group.videoNumbers.includes(videoId)) {
    group.videoNumbers.push(videoId)
  }
}

/**
 * @description: 从指定分组中移除视频（与 removeGroupImage 同一套逻辑：
 * 移除关联 → 不在其他分组则重新显示到地图 → 持久化 → 刷新分组图标数量/封面）
 * @param {string} groupId
 * @param {string} videoId
 */
export function removeVideoFromGroup(groupId: string, videoId: string) {
  const schemaStore = useSchemaStore()
  let groupInfo: any = schemaStore.getGroupInfo
  groupInfo = groupInfo.map((item: any) => {
    if (item.id === groupId) {
      item.videoNumbers = item.videoNumbers?.filter((id: string) => id !== videoId)
      return item
    }
    return item
  })
  // 如果在别的分组里就不用在地图中添加了
  if (isVideoExistInOtherGroup(groupId, videoId)) {
    return
  }
  markerService.addExistVideoMarkerToMapById(videoId)
  editSchemaAttrAndSave('groupInfo', groupInfo)
  markerService.resetIconGroupMarker(groupId)
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
  // 从所有 groupInfo.videoNumbers 移除，并记录受影响分组用于刷新封面/计数
  const affectedGroupIds: string[] = []
  schema.groupInfo?.forEach(group => {
    if (group.videoNumbers) {
      if (group.videoNumbers.some(id => videoIds.includes(id))) {
        affectedGroupIds.push(group.id)
      }
      group.videoNumbers = group.videoNumbers.filter(id => !videoIds.includes(id))
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
  // 刷新受影响分组的封面/计数（视频可能作为分组封面）
  affectedGroupIds.forEach(groupId => {
    markerService.resetIconGroupMarker(groupId)
  })
  return API.video.deleteVideos({ videoIds })
}
