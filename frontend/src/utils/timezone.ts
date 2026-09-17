/*
 * 时区偏好工具
 * @Description: 用于解释 GPX 中不带时区信息的时间戳。
 * - GPX 时间带时区标记（Z / ±HH:MM）时严格按时区解析，不依赖本模块。
 * - GPX 时间不带时区时，按用户选择的时区（默认系统时区）解释。
 * - 用户选择持久化到 localStorage。
 */

const STORAGE_KEY = 'picmap_timezone_offset'

export interface ITimezoneOption {
  // 相对 UTC 的偏移分钟数（东八区为 +480）
  offsetMinutes: number
  // 展示名（中文时区名 + UTC 偏移，如「东八区 (UTC+08:00)」）
  label: string
  // 中文区域描述（可选，作为补充信息）
  region: string
}

// UTC 偏移文本（如 UTC+08:00 / UTC-05:30）
function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMinutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

// 中文时区名：整点用「东N区/西N区」，非整点附加分钟标注
function formatTimezoneLabel(offsetMinutes: number): string {
  const utc = formatUtcOffset(offsetMinutes)
  if (offsetMinutes === 0) return `零时区 (${utc})`
  const dir = offsetMinutes > 0 ? '东' : '西'
  const abs = Math.abs(offsetMinutes)
  const hours = Math.floor(abs / 60)
  const minutes = abs % 60
  const name = minutes === 0 ? `${dir}${hours}区` : `${dir}${hours}区（${minutes}分）`
  return `${utc} ${name}`
}

// 常用时区（按偏移升序），覆盖西十二区 ~ 东十四区的主要区域
const TIMEZONE_RAW: { offsetMinutes: number; region: string }[] = [
  { offsetMinutes: -720, region: '国际日期变更线西' },
  { offsetMinutes: -660, region: '纽埃、萨摩亚' },
  { offsetMinutes: -600, region: '夏威夷' },
  { offsetMinutes: -540, region: '阿拉斯加' },
  { offsetMinutes: -480, region: '洛杉矶、温哥华' },
  { offsetMinutes: -420, region: '丹佛、凤凰城' },
  { offsetMinutes: -360, region: '芝加哥、墨西哥城' },
  { offsetMinutes: -300, region: '纽约、多伦多' },
  { offsetMinutes: -240, region: '圣地亚哥、加拉加斯' },
  { offsetMinutes: -180, region: '圣保罗、布宜诺斯艾利斯' },
  { offsetMinutes: -120, region: '费尔南多·迪诺罗尼亚' },
  { offsetMinutes: -60, region: '亚速尔群岛' },
  { offsetMinutes: 0, region: '伦敦、里斯本' },
  { offsetMinutes: 60, region: '巴黎、柏林、罗马' },
  { offsetMinutes: 120, region: '开罗、雅典、赫尔辛基' },
  { offsetMinutes: 180, region: '莫斯科、利雅得' },
  { offsetMinutes: 210, region: '德黑兰' },
  { offsetMinutes: 240, region: '迪拜、第比利斯' },
  { offsetMinutes: 270, region: '喀布尔' },
  { offsetMinutes: 300, region: '塔什干、伊斯兰堡' },
  { offsetMinutes: 330, region: '新德里、孟买' },
  { offsetMinutes: 345, region: '加德满都' },
  { offsetMinutes: 360, region: '达卡、阿拉木图' },
  { offsetMinutes: 390, region: '仰光' },
  { offsetMinutes: 420, region: '曼谷、雅加达' },
  { offsetMinutes: 480, region: '北京、上海、新加坡' },
  { offsetMinutes: 525, region: '尤克拉' },
  { offsetMinutes: 540, region: '东京、首尔' },
  { offsetMinutes: 570, region: '达尔文、阿德莱德' },
  { offsetMinutes: 600, region: '悉尼、关岛' },
  { offsetMinutes: 630, region: '豪勋爵岛' },
  { offsetMinutes: 660, region: '所罗门群岛' },
  { offsetMinutes: 720, region: '奥克兰、斐济' },
  { offsetMinutes: 765, region: '查塔姆群岛' },
  { offsetMinutes: 780, region: '汤加、萨摩亚' },
  { offsetMinutes: 840, region: '基里巴斯' },
]

export const TIMEZONE_OPTIONS: ITimezoneOption[] = TIMEZONE_RAW.map((item) => ({
  ...item,
  label: formatTimezoneLabel(item.offsetMinutes),
}))

/**
 * @description: 系统当前时区相对 UTC 的偏移分钟数（东八区为 +480）
 * 注意：JS getTimezoneOffset() 返回的是「UTC - 本地」分钟数，符号与常规相反
 */
export function getSystemTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset()
}

/**
 * @description: 读取用户选择的时区偏移（分钟）；未设置时返回系统时区偏移
 */
export function getTimezoneOffsetMinutes(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (isFinite(n)) return n
  }
  return getSystemTimezoneOffsetMinutes()
}

/**
 * @description: 保存用户选择的时区偏移（分钟）
 */
export function setTimezoneOffsetMinutes(offsetMinutes: number) {
  localStorage.setItem(STORAGE_KEY, String(offsetMinutes))
}

/**
 * @description: 是否使用了系统时区默认值（未显式设置过）
 */
export function isUsingSystemTimezone(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw == null || raw === ''
}

/**
 * @description: 按指定时区偏移，把「无时区信息」的日期时间数字解析为 epoch 毫秒
 * 例如 offsetMinutes=480 时，'2026-08-20T17:00:00' 表示东八区 17:00，即 UTC 09:00
 */
export function dateTimeToMsInOffset(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  offsetMinutes: number
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second, 0) - offsetMinutes * 60 * 1000
}
