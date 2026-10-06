/*
 * 播放器参数工具
 * @Description:
 * - 倍速选项与格式化（倍速在每次打开视频弹窗时重置为 1，不持久化）
 * - 音量持久化（唯一跨弹窗保留的参数）
 */

export const PLAYBACK_RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2, 4] as const

// 默认播放倍速（每次打开弹窗都回到 1）
export const DEFAULT_PLAYBACK_RATE = 1

const VOLUME_STORAGE_KEY = 'picmap.videoVolume'

/**
 * @description: 读取记忆的音量（0~1）；非法/未设置时返回 1。
 * 静音（0）不写入，保证取消静音时能恢复上次的有效音量。
 */
export function getStoredVolume(): number {
  const raw = localStorage.getItem(VOLUME_STORAGE_KEY)
  const n = raw != null ? Number(raw) : NaN
  return isFinite(n) && n > 0 && n <= 1 ? n : 1
}

/**
 * @description: 保存有效音量（0 不保存，避免把静音状态记忆成音量）
 */
export function setStoredVolume(volume: number) {
  if (!(volume > 0)) return
  localStorage.setItem(VOLUME_STORAGE_KEY, String(Math.min(1, volume)))
}

/**
 * @description: 倍速展示文本（如 1x / 1.25x / 0.5x）
 */
export function formatPlaybackRate(rate: number): string {
  return `${rate}x`
}
