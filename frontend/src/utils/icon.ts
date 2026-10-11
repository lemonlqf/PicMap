/*
 * @Author: Do not edit
 * @Description: 全局图标库工具函数
 *  - 预设图标（编译期资源）+ 自定义图标（上传到磁盘，schema 存相对路径）
 *  - 分类：avatar（头像）/ track（轨迹起终点）
 */
import { useAppStore } from '@/store/appSchema'
import { editAppSchemaAttrAndSave } from '@/utils/appSchema'
import API from '@/wails/api'
import type { IIconCategory, IIconItem } from '@/type/appSchema'

// ---- 预设轨迹起终点图标（可扩展，新增文件时在此追加） ----
import node1 from '@/assets/avatar/node1.svg?url'
import node2 from '@/assets/avatar/node2.svg?url'
import node3 from '@/assets/avatar/node3.svg?url'

export const PRESET_TRACK_ICONS: IIconItem[] = [
  { id: 'track_node1', name: '节点1', url: node1, category: 'track', source: 'preset' },
  { id: 'track_node2', name: '节点2', url: node2, category: 'track', source: 'preset' },
  { id: 'track_node3', name: '节点3', url: node3, category: 'track', source: 'preset' },
]

// 默认轨迹图标 id（无配置时使用）
export const DEFAULT_TRACK_START_ICON_ID = 'track_node1'
export const DEFAULT_TRACK_END_ICON_ID = 'track_node1'

/**
 * @description: 获取指定分类的图标列表（预设 + 自定义）
 * @param {IIconCategory} category
 * @return {IIconItem[]}
 */
export function getIconListByCategory(category: IIconCategory): IIconItem[] {
  const appStore = useAppStore()
  const customIcons = (appStore.getAppSchema.iconLibrary || [])
    .filter((item) => item.category === category && item.source === 'custom')
  const presets = category === 'track' ? PRESET_TRACK_ICONS : []
  return [...presets, ...customIcons]
}

/**
 * @description: 根据图标 id 查找图标项（支持预设与自定义）
 * @param {string} iconId
 * @param {IIconCategory} category
 * @return {IIconItem | undefined}
 */
export function getIconItemById(iconId: string, category: IIconCategory): IIconItem | undefined {
  if (!iconId) return undefined
  return getIconListByCategory(category).find((item) => item.id === iconId)
}

/**
 * @description: 将图标 id 解析为可显示的 URL
 *  - 预设：直接返回资源 URL
 *  - 自定义：通过后端 GetIcon 取 base64（异步），返回 dataURL
 * @param {string} iconId
 * @param {IIconCategory} category
 * @return {Promise<string | undefined>}
 */
export async function resolveIconUrl(iconId: string, category: IIconCategory): Promise<string | undefined> {
  if (!iconId) return undefined
  const item = getIconItemById(iconId, category)
  if (!item) return undefined
  if (item.source === 'preset') {
    return item.url
  }
  // 自定义：取文件名，后端读取
  const fileName = decodeIconFileName(iconId)
  if (!fileName) return undefined
  try {
    const res = await API.icon.getIcon(category, fileName)
    const base64 = res?.data?.file || res?.file
    if (base64) {
      const mime = mimeFromFileName(fileName)
      return `data:${mime};base64,${base64}`
    }
  } catch (e) {
    console.error('加载自定义图标失败:', iconId, e)
  }
  return undefined
}

// 根据文件后缀推断 mime 类型
function mimeFromFileName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  switch (ext) {
    case 'svg': return 'image/svg+xml'
    case 'jpg': case 'jpeg': return 'image/jpeg'
    case 'webp': return 'image/webp'
    case 'bmp': return 'image/bmp'
    case 'gif': return 'image/gif'
    default: return 'image/png'
  }
}

/**
 * @description: 上传自定义图标并加入全局图标库
 * @param {File} file - 图标文件
 * @param {IIconCategory} category - 分类
 * @return {Promise<string | undefined>} 返回新图标的 id
 */
export async function uploadIconToLibrary(file: File, category: IIconCategory): Promise<string | undefined> {
  const appStore = useAppStore()
  const res = await API.icon.uploadIcon(file.name, file, category)
  if (res.code !== 200) {
    throw new Error(res.msg || '上传图标失败')
  }
  const fileName = res?.data?.fileName
  const relPath = res?.data?.relPath
  if (!fileName) return undefined
  const iconId = encodeIconFileName(fileName, category)
  const newItem: IIconItem = {
    id: iconId,
    name: file.name,
    url: relPath,
    category,
    source: 'custom',
  }
  const iconLibrary = [...(appStore.getAppSchema.iconLibrary || [])]
  iconLibrary.push(newItem)
  await editAppSchemaAttrAndSave('iconLibrary', iconLibrary)
  return iconId
}

/**
 * @description: 删除自定义图标（从磁盘 + 图标库）
 * @param {string} iconId
 * @return {Promise<void>}
 */
export async function deleteIconFromLibrary(iconId: string) {
  const appStore = useAppStore()
  const item = (appStore.getAppSchema.iconLibrary || []).find((i) => i.id === iconId)
  if (!item || item.source !== 'custom') return
  const fileName = decodeIconFileName(iconId)
  await API.icon.deleteIcon(item.category, fileName)
  const iconLibrary = (appStore.getAppSchema.iconLibrary || []).filter((i) => i.id !== iconId)
  await editAppSchemaAttrAndSave('iconLibrary', iconLibrary)
}

// 自定义图标 id 命名：`custom_<category>_<fileName>`，编码以保证唯一可逆
function encodeIconFileName(fileName: string, category: IIconCategory): string {
  return `custom_${category}_${encodeURIComponent(fileName)}`
}

// 从自定义图标 id 还原文件名
export function decodeIconFileName(iconId: string): string | undefined {
  const prefix = 'custom_'
  if (!iconId.startsWith(prefix)) return undefined
  const parts = iconId.slice(prefix.length).split('_')
  // parts = [category, ...encodedName]
  const category = parts[0]
  const encodedName = parts.slice(1).join('_')
  return decodeURIComponent(encodedName)
}
