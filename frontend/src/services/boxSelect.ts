import mapService from '@/services/map'
import markerService from '@/services/marker'
import { useSelectStore } from '@/store/select'
import type { MapMarkerAdapter } from '@/services/markerAdapter'

/**
 * 框选实现（基于 MapLibre 原生 mouse 事件 + 自绘矩形，不依赖 boxZoom 私有字段覆写）。
 *
 * 为什么不用 boxZoom handler：其触发 modifier 硬编码为 Shift，覆写私有字段（_moveStateManager、
 * mousedown）在 MapLibre 内部结构上较脆弱。改用原生事件 + preventDefault 方案，更稳定可靠。
 *
 * 交互：
 * - Ctrl + 左键拖拽 -> 绘制矩形框选（preventDefault 阻止旋转/平移/boxzoom 默认行为）
 * - 普通左键拖拽 -> 地图平移（不受影响）
 * - 右键拖拽 -> 地图旋转（不受影响）
 * - Esc -> 取消当前框选
 * - Ctrl 按住时点选/拖拽 -> 追加选中；否则替换选中集
 */

let startPos: { x: number; y: number } | null = null
let boxEl: HTMLElement | null = null
let selecting = false

export function initBoxSelect() {
  const map = mapService.getMapInstance()
  if (!map) return
  // 防重复绑定
  if ((map as any).__pmBoxSelectReady) return
  ;(map as any).__pmBoxSelectReady = true

  map.on('mousedown', onMouseDown)
  map.on('mousemove', onMouseMove)
  map.on('mouseup', onMouseUp)
  // Esc 取消框选（地图无 keydown 事件，用 document 监听）
  document.addEventListener('keydown', onKeyDown)
}

function onMouseDown(e: any) {
  const oe: MouseEvent = e.originalEvent
  // 仅 Ctrl/Cmd + 左键触发框选
  if (!(oe.ctrlKey || oe.metaKey) || oe.button !== 0) return

  // 阻止 maplibre 的旋转/平移/boxzoom 默认拖拽行为（官方推荐做法），释放给框选
  e.preventDefault()

  // 用视口坐标（clientX/Y），与 marker 的 getBoundingClientRect 同坐标系
  startPos = { x: oe.clientX, y: oe.clientY }
  selecting = true
}

function onMouseMove(e: any) {
  if (!selecting || !startPos) return
  const map = mapService.getMapInstance()
  if (!map) return
  const cur = { x: e.originalEvent.clientX, y: e.originalEvent.clientY }
  drawBox(startPos, cur)
}

function onMouseUp(e: any) {
  if (!selecting || !startPos) return
  const oe: MouseEvent = e.originalEvent
  const additive = !!(oe && (oe.ctrlKey || oe.metaKey))
  const end = { x: oe.clientX, y: oe.clientY }

  // 完成框选
  removeBox()
  handleBoxSelect(startPos, end, additive)
  startPos = null
  selecting = false
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && selecting) {
    cancelBox()
  }
}

function drawBox(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  if (!boxEl) {
    boxEl = document.createElement('div')
    boxEl.className = 'pm-box-select-rect'
    document.body.appendChild(boxEl)
  }
  const minX = Math.min(p1.x, p2.x)
  const maxX = Math.max(p1.x, p2.x)
  const minY = Math.min(p1.y, p2.y)
  const maxY = Math.max(p1.y, p2.y)
  boxEl.style.left = `${minX}px`
  boxEl.style.top = `${minY}px`
  boxEl.style.width = `${maxX - minX}px`
  boxEl.style.height = `${maxY - minY}px`
}

function removeBox() {
  if (boxEl) {
    boxEl.remove()
    boxEl = null
  }
}

function cancelBox() {
  removeBox()
  startPos = null
  selecting = false
}

/** 根据屏幕矩形计算命中的 marker 并更新选中集 */
function handleBoxSelect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  additive: boolean
) {
  const map = mapService.getMapInstance()
  const selectStore = useSelectStore()
  if (!map) return

  const selRect = {
    left: Math.min(p1.x, p2.x),
    right: Math.max(p1.x, p2.x),
    top: Math.min(p1.y, p2.y),
    bottom: Math.max(p1.y, p2.y),
  }

  const hitIds: string[] = []
  const markers = markerService.getAllMarkers()

  markers.forEach((marker: MapMarkerAdapter) => {
    // 分组节点不参与框选（批量操作只针对图片/视频）
    const markerType = marker.options.type
    if (markerType === 'group' || markerType === 'temporary-group') return
    // 用节点 DOM 实际矩形做相交检测（擦边即命中），而非中心点
    const rect = getMarkerRectInContainer(marker)
    if (!rect) return
    const intersects =
      rect.left <= selRect.right &&
      rect.right >= selRect.left &&
      rect.top <= selRect.bottom &&
      rect.bottom >= selRect.top
    if (!intersects) return
    // cluster 展开全部叶子，image/group 本身即叶子
    hitIds.push(...markerService.getMarkerLeafIds(marker))
  })

  if (additive) {
    selectStore.select(hitIds)
  } else {
    selectStore.replace(hitIds)
  }

  markerService.refreshSelection()
}

/** 获取 marker 的视口矩形（与 clientX/Y 同坐标系），用于与框选矩形相交检测 */
function getMarkerRectInContainer(marker: MapMarkerAdapter): { left: number; right: number; top: number; bottom: number } | null {
  const el = marker.getElement()
  if (!el) return null
  const elRect = el.getBoundingClientRect()
  return {
    left: elRect.left,
    right: elRect.right,
    top: elRect.top,
    bottom: elRect.bottom,
  }
}
