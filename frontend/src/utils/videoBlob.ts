/*
 * 视频分块读取共用工具
 * @Description: 通过后端 GetVideoRange 分块读取视频并拼装成 blob objectURL，
 * 供 video.js（普通视频）与 photo-sphere-viewer VideoAdapter（全景视频）共用。
 * 带 in-flight / 结果缓存，避免同一视频被重复分块读取；分块并行拉取并上报进度。
 */
import API from '@/wails/api'

const CHUNK_SIZE = 8 * 1024 * 1024 // 8MB/段（后端单次读取上限同步为 8MB，减少请求次数）
// 并行拉取的并发数（过大反而争抢磁盘/CPU，4 较稳）
const MAX_CONCURRENCY = 4

export type VideoLoadProgress = (loadedBytes: number, totalBytes: number) => void

/**
 * @description: 获取视频的本地流地址（后端本地 HTTP 服务，支持 Range 边下边播）。
 * 服务不可用时返回空串，调用方回退到分块 blob 方案。
 */
export async function getVideoStreamUrl(videoId: string): Promise<string> {
  if (!videoId) return ''
  try {
    const res = await API.video.getVideoStreamUrl({ videoId })
    if (res.code !== 200) return ''
    return res.data?.url || ''
  } catch {
    return ''
  }
}

// videoId -> 已生成的 objectURL（成功后缓存，多次打开同一视频不重复拉流）
const blobUrlCache = new Map<string, string>()
// videoId -> 正在进行中的加载 Promise（并发去重）
const pendingCache = new Map<string, Promise<string>>()
// 已调用 revokeVideoObjectUrl 的 videoId（进行中的加载完成后不应再写缓存）
const revokedSet = new Set<string>()
// 已通过 loadVideoAsObjectUrl 生成、但尚未被任何调用方接管释放的 objectURL 集合；
// 用于组件未调用 revoke 时的兜底回收（避免整段视频内存长期驻留）
const createdUrls = new Set<string>()

/**
 * @description: 将某 videoId 当前缓存的 objectURL 立即释放（若存在）。
 * 同时清理 revokedSet，使该视频后续再次加载时能重新进入正常的缓存/释放流程，
 * 避免"revoke 过就永久不缓存、每次加载都泄漏一份 objectURL"。
 */
function revokeCachedUrl(videoId: string) {
  const url = blobUrlCache.get(videoId)
  if (url) {
    URL.revokeObjectURL(url)
    blobUrlCache.delete(videoId)
    createdUrls.delete(url)
  }
}

function blobFromBase64(base64: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes])
}

async function fetchRange(videoId: string, start: number, end: number) {
  const res = await API.video.getVideoRange({ videoId, start, end })
  if (res.code !== 200 || !res.data?.data) return null
  return res.data as { data: string; start: number; end: number; length: number }
}

/**
 * @description: 分块读取整个视频并返回 blob objectURL（带缓存与并发去重）。
 * 同一 videoId 首次调用后缓存 objectURL，再次调用直接返回缓存（调用方负责播放与销毁）。
 * @param {string} videoId
 * @param {VideoLoadProgress} [onProgress] 进度回调（已加载字节 / 总字节）
 * @return {Promise<string>} objectURL；失败返回空串
 */
export async function loadVideoAsObjectUrl(videoId: string, onProgress?: VideoLoadProgress): Promise<string> {
  const cached = blobUrlCache.get(videoId)
  if (cached) {
    onProgress?.(1, 1)
    return cached
  }
  const pending = pendingCache.get(videoId)
  if (pending) return pending

  // 本次加载开始，清除旧的 revoke 标记（表示调用方希望重新加载该视频）
  revokedSet.delete(videoId)

  const p = doLoad(videoId, onProgress)
    .then((url) => {
      if (!url) return url
      createdUrls.add(url)
      // 加载完成时若调用方已 revoke（弹窗提前关闭/取消），立即释放且不写缓存，避免泄漏
      if (revokedSet.has(videoId)) {
        URL.revokeObjectURL(url)
        createdUrls.delete(url)
        return ''
      }
      blobUrlCache.set(videoId, url)
      return url
    })
    .finally(() => {
      pendingCache.delete(videoId)
    })
  pendingCache.set(videoId, p)
  return p
}

async function doLoad(videoId: string, onProgress?: VideoLoadProgress): Promise<string> {
  // 第一段获取文件大小
  const first = await fetchRange(videoId, 0, CHUNK_SIZE)
  if (!first) return ''
  const totalLength = first.length
  const totalChunks = Math.max(1, Math.ceil(totalLength / CHUNK_SIZE))
  const parts: (Blob | undefined)[] = new Array(totalChunks)
  parts[0] = blobFromBase64(first.data)
  let loadedBytes = first.end - first.start
  onProgress?.(loadedBytes, totalLength)

  // 其余分块并行拉取（按序号写回，保证顺序），限制并发数
  const pendingIndices: number[] = []
  for (let i = 1; i < totalChunks; i++) pendingIndices.push(i)

  let cursor = 0
  const worker = async () => {
    while (cursor < pendingIndices.length) {
      const idx = pendingIndices[cursor++]
      const start = idx * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, totalLength)
      const chunk = await fetchRange(videoId, start, end)
      if (!chunk) continue
      parts[idx] = blobFromBase64(chunk.data)
      loadedBytes += chunk.end - chunk.start
      onProgress?.(Math.min(loadedBytes, totalLength), totalLength)
    }
  }
  const workerCount = Math.min(MAX_CONCURRENCY, pendingIndices.length)
  if (workerCount > 0) {
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
  }

  const blob = new Blob(parts.filter((p): p is Blob => !!p), { type: 'video/mp4' })
  return URL.createObjectURL(blob)
}

/**
 * @description: 释放某个视频缓存的 objectURL（关闭播放弹窗时调用，防止内存泄漏）
 * @param {string} videoId
 */
export function revokeVideoObjectUrl(videoId: string) {
  revokedSet.add(videoId)
  revokeCachedUrl(videoId)
}

/**
 * @description: 释放所有已生成但未回收的视频 objectURL（切换用户 / 应用退出等全局清理场景）
 */
export function revokeAllVideoObjectUrls() {
  // 标记所有已缓存 id，使 in-flight 加载完成后不写缓存
  blobUrlCache.forEach((_url, videoId) => {
    revokedSet.add(videoId)
  })
  // 回收所有已创建的 objectURL（含尚未写入缓存的）
  createdUrls.forEach((url) => {
    URL.revokeObjectURL(url)
  })
  createdUrls.clear()
  blobUrlCache.clear()
}
