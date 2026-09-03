/*
 * 视频分块读取共用工具
 * @Description: 通过后端 GetVideoRange 分块读取视频并拼装成 blob objectURL，
 * 供 video.js（普通视频）与 photo-sphere-viewer VideoAdapter（全景视频）共用。
 * 带 in-flight / 结果缓存，避免同一视频被重复分块读取。
 */
import API from '@/wails/api'

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB/段
// videoId -> 已生成的 objectURL（成功后缓存，多次打开同一视频不重复拉流）
const blobUrlCache = new Map<string, string>()
// videoId -> 正在进行中的加载 Promise（并发去重）
const pendingCache = new Map<string, Promise<string>>()
// 已调用 revokeVideoObjectUrl 的 videoId（进行中的加载完成后不应再写缓存）
const revokedSet = new Set<string>()

function appendChunk(parts: Blob[], base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  parts.push(new Blob([bytes]))
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
 * @return {Promise<string>} objectURL；失败返回空串
 */
export async function loadVideoAsObjectUrl(videoId: string): Promise<string> {
  const cached = blobUrlCache.get(videoId)
  if (cached) return cached
  const pending = pendingCache.get(videoId)
  if (pending) return pending

  const p = doLoad(videoId)
    .then((url) => {
      // 已被调用方 revoke 的（如关闭弹窗时）不再写缓存，交由调用方处理
      if (url && !revokedSet.has(videoId)) blobUrlCache.set(videoId, url)
      return url
    })
    .finally(() => {
      pendingCache.delete(videoId)
    })
  pendingCache.set(videoId, p)
  return p
}

async function doLoad(videoId: string): Promise<string> {
  const parts: Blob[] = []
  let loadedBytes = 0

  // 第一段获取文件大小
  const first = await fetchRange(videoId, 0, CHUNK_SIZE)
  if (!first) return ''
  const totalLength = first.length
  appendChunk(parts, first.data)
  loadedBytes = first.end

  // 继续读取后续分段
  while (loadedBytes < totalLength) {
    const end = Math.min(loadedBytes + CHUNK_SIZE, totalLength)
    const chunk = await fetchRange(videoId, loadedBytes, end)
    if (!chunk) break
    appendChunk(parts, chunk.data)
    loadedBytes = chunk.end
  }

  const blob = new Blob(parts, { type: 'video/mp4' })
  return URL.createObjectURL(blob)
}

/**
 * @description: 释放某个视频缓存的 objectURL（关闭播放弹窗时调用，防止内存泄漏）
 * @param {string} videoId
 */
export function revokeVideoObjectUrl(videoId: string) {
  revokedSet.add(videoId)
  const url = blobUrlCache.get(videoId)
  if (url) {
    URL.revokeObjectURL(url)
    blobUrlCache.delete(videoId)
  }
}
