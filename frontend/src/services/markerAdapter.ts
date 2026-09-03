import * as maplibregl from 'maplibre-gl'

import IconHTMLFactory, { IconType } from '@/utils/iconHTML'
import { GROUP_CONSTANT, MARKER_CONSTANT } from '@/utils/constant'
import { getMarkerImageUrlByIds } from '@/utils/Image'
import type { IImageInfo, INewGroupFormData, IVideoInfo } from '@/type/schema'

const panoramaBadgeUrl = new URL('../assets/icon/panorama.svg', import.meta.url).href

export interface MarkerIcon {
  element: HTMLElement
  inner?: HTMLElement
  iconUrl?: string
  imageUrls?: string[]
}

export interface MarkerOptions {
  id: string
  type: string
  draggable?: boolean
  iconUrl?: string
  name?: string
}

// 飞行动画配置（聚合/散开过渡，可自由配置速度与透明度）
export interface FlyAnimationOptions {
  /** 动画时长（ms），默认 300 */
  duration?: number
  /** 缓动函数（控制位移），输入 0-1 返回 0-1，默认 easeInOutCubic */
  easing?: (t: number) => number
  /** 是否在移动时做透明度过渡 */
  fade?: boolean
  /** 起点透明度（0-1），配合 fade 使用 */
  fadeFrom?: number
  /** 终点透明度（0-1），配合 fade 使用 */
  fadeTo?: number
  /** 透明度的缓动函数（独立于位移 easing），默认与 easing 一致 */
  fadeEasing?: (t: number) => number
}

// 常用缓动函数
export const Easing = {
  linear: (t: number) => t,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  // 提前完成淡出：在动画 40% 前完成过渡（透明到 0），之后保持全透明（用于聚合节点淡出）
  fadeOutAt40: (t: number) => Math.min(t / 0.4, 1),
  // 延迟淡入：前 20% 保持透明，之后淡入到不透明（用于散开/分裂节点飞出的淡入）
  fadeInFrom20: (t: number) => (t <= 0.2 ? 0 : (t - 0.2) / 0.8),
}

// 包裹一层：外层负责 MapLibre 定位（translate，无 transition），内层负责缩放（scale，有 transition）
function wrapMarkerElement(
  iconElement: HTMLElement,
  width: number,
  height: number
): { element: HTMLElement; inner: HTMLElement } {
  const outer = document.createElement('div')
  outer.className = 'map-marker'
  outer.style.width = `${width}px`
  outer.style.height = `${height}px`
  outer.style.boxSizing = 'border-box'
  // 把定位尖角移到外层，避免 hover 缩放 / overflow 裁剪时消失
  const location = iconElement.querySelector('.location')
  if (location) {
    location.remove()
    outer.appendChild(location)
  }
  iconElement.style.width = '100%'
  iconElement.style.height = '100%'
  iconElement.style.boxSizing = 'border-box'
  outer.appendChild(iconElement)
  return { element: outer, inner: iconElement }
}

export class MapMarkerAdapter {
  readonly options: MarkerOptions
  readonly mlMarker: maplibregl.Marker
  dragging: { enable: () => void; disable: () => void }
  private icon: MarkerIcon
  private innerElement: HTMLElement
  // 是否正在飞行动画中（renderClusters 应跳过，避免状态冲突）
  animating = false
  private currentAnimation: Animation | null = null
  private currentAnimationOnFinish: (() => void) | null = null

  constructor(icon: MarkerIcon, lngLat: [number, number], options: MarkerOptions) {
    this.options = options
    this.icon = icon
    this.innerElement = icon.inner ?? icon.element
    // 可拖动定位的临时节点，标记红色尖角
    if (options.draggable) {
      icon.element.classList.add('draggable-marker')
    }
    this.mlMarker = new maplibregl.Marker({
      element: icon.element,
      anchor: 'bottom',
      draggable: !!options.draggable,
    }).setLngLat(lngLat)
    this.dragging = {
      enable: () => this.mlMarker.setDraggable(true),
      disable: () => this.mlMarker.setDraggable(false),
    }
  }

  addTo(map: maplibregl.Map) {
    this.mlMarker.addTo(map)
    return this
  }

  remove() {
    this.mlMarker.remove()
  }

  // 取消进行中的飞行动画（用于连续缩放时避免状态冲突）
  cancelAnimation() {
    if (this.currentAnimation) {
      this.currentAnimation.cancel()
      this.currentAnimation = null
    }
    if (this.latLngRafId !== null) {
      cancelAnimationFrame(this.latLngRafId)
      this.latLngRafId = null
    }
    this.currentAnimationOnFinish = null
    this.animating = false
  }

  // 结束动画并立即跳到终点状态（地图移动打断时使用，避免动画错位）
  finishAnimation() {
    if (this.currentAnimation) {
      this.currentAnimation.cancel()
      this.currentAnimation = null
    }
    if (this.latLngRafId !== null) {
      cancelAnimationFrame(this.latLngRafId)
      this.latLngRafId = null
    }
    // 中断时恢复目标透明度，避免残留中间值
    if (this.currentFadeTo !== null) {
      this.setOpacity(this.currentFadeTo)
      this.currentFadeTo = null
    }
    const onFinish = this.currentAnimationOnFinish
    this.currentAnimationOnFinish = null
    this.animating = false
    if (onFinish) onFinish()
  }

  // 设置透明度（作用于整个 marker 外层元素）
  setOpacity(opacity: number) {
    this.mlMarker.getElement().style.opacity = String(opacity)
  }

  // 基于经纬度插值的移动动画：marker 平滑从当前位置移动到目标坐标（rAF 逐帧 setLngLat）
  // 支持配置 duration / easing / fade（透明度过渡），比 CSS transform 脱离地图的方案更简单可靠
  private latLngRafId: number | null = null
  // 当前动画的目标透明度（用于中断时恢复，null 表示未做透明度过渡）
  private currentFadeTo: number | null = null

  animateToLatLng(targetLat: number, targetLng: number, options?: FlyAnimationOptions, onFinish?: () => void) {
    this.cancelAnimation()
    const from = this.mlMarker.getLngLat()
    const startLat = from.lat
    const startLng = from.lng
    const duration = options?.duration ?? 300
    const easing = options?.easing ?? Easing.easeInOutCubic
    const fade = options?.fade ?? false
    const fadeFrom = options?.fadeFrom ?? 0
    const fadeTo = options?.fadeTo ?? 1
    const fadeEasing = options?.fadeEasing ?? easing

    // 起点与终点一致时，无移动，但保留透明度过渡
    const samePos = startLat === targetLat && startLng === targetLng
    if (samePos && !fade) {
      this.currentFadeTo = null
      this.setOpacity(fadeTo)
      onFinish?.()
      return
    }

    // 记录目标透明度（中断时恢复用）
    this.currentFadeTo = fade ? fadeTo : null

    // 从起始透明度开始（fade 时）
    if (fade) this.setOpacity(fadeFrom)

    this.animating = true
    this.currentAnimationOnFinish = onFinish ?? null
    const startTime = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = easing(t)
      if (!samePos) {
        this.mlMarker.setLngLat([startLng + (targetLng - startLng) * eased, startLat + (targetLat - startLat) * eased])
      }
      if (fade) {
        this.setOpacity(fadeFrom + (fadeTo - fadeFrom) * fadeEasing(t))
      }
      if (t < 1) {
        this.latLngRafId = requestAnimationFrame(step)
      } else {
        this.latLngRafId = null
        this.currentFadeTo = null
        if (fade) this.setOpacity(fadeTo)
        const cb = this.currentAnimationOnFinish
        this.currentAnimationOnFinish = null
        this.animating = false
        if (cb) cb()
      }
    }
    this.latLngRafId = requestAnimationFrame(step)
  }

  // 开始飞行动画（记录 animating 状态，动画完成后清理）
  runFlyAnimation(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions, onFinish: () => void) {
    this.cancelAnimation()
    this.animating = true
    const anim = el.animate(keyframes, options)
    this.currentAnimation = anim
    this.currentAnimationOnFinish = onFinish
    anim.onfinish = () => {
      this.currentAnimation = null
      this.currentAnimationOnFinish = null
      this.animating = false
      onFinish()
    }
    return anim
  }

  getLatLng(): { lat: number; lng: number; alt: number } {
    const ll = this.mlMarker.getLngLat()
    return { lat: ll.lat, lng: ll.lng, alt: 0 }
  }

  setLatLng(lat: number, lng: number) {
    this.mlMarker.setLngLat([lng, lat])
  }

  setIcon(icon: MarkerIcon) {
    this.icon = icon
    const outer = this.mlMarker.getElement()
    outer.innerHTML = ''
    const inner = icon.inner ?? icon.element
    // 定位尖角统一放到外层，避免 hover 缩放 / overflow 裁剪时消失
    const location = icon.element.querySelector('.location') ?? inner.querySelector('.location')
    if (location) location.remove()
    inner.style.width = '100%'
    inner.style.height = '100%'
    inner.style.boxSizing = 'border-box'
    if (location) outer.appendChild(location)
    outer.appendChild(inner)
    this.innerElement = inner
  }

  getElement(): HTMLElement {
    return this.mlMarker.getElement()
  }

  // 内层元素：用于 hover 缩放（scale），与 MapLibre 定位（translate）分离
  getInnerElement(): HTMLElement {
    return this.innerElement
  }

  setZIndexOffset(offset: number) {
    this.mlMarker.getElement().style.zIndex = String(offset)
  }

  on(event: string, cb: (...args: any[]) => void) {
    const el = this.mlMarker.getElement()
    if (event === 'moveend' || event === 'dragend') {
      this.mlMarker.on('dragend', () => cb())
    } else if (event === 'click') {
      el.addEventListener('click', (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        cb(this.wrapEvent(e))
      })
    } else if (event === 'contextmenu') {
      el.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        cb(this.wrapEvent(e))
      })
    } else if (event === 'mouseover') {
      el.addEventListener('mouseover', (e: Event) => cb(e))
    } else if (event === 'mouseout') {
      el.addEventListener('mouseout', (e: Event) => cb(e))
    }
  }

  // 包装成 Leaflet 风格事件结构，兼容上层组件（event.target.options.id / event.originalEvent.x/y）
  private wrapEvent(e: Event) {
    return {
      target: this,
      originalEvent: e,
      latlng: this.getLatLng(),
    }
  }
}

export function createImageMarkerIcon(imageInfo: IImageInfo, imageUrl?: string): MarkerIcon {
  const url = imageUrl ?? imageInfo.url ?? ''
  const iconElement = url
    ? IconHTMLFactory.createIcon(IconType.SingleImage, url)
    : IconHTMLFactory.createIcon(IconType.NoImage, imageInfo.name)
  // 全景图片标记角标（右下角显示全景图标）
  if (imageInfo.isPanorama) {
    const badge = document.createElement('div')
    badge.className = 'panorama-marker-badge'
    const img = document.createElement('img')
    img.className = 'panorama-marker-icon'
    img.src = panoramaBadgeUrl
    img.alt = '全景'
    badge.appendChild(img)
    iconElement.appendChild(badge)
  }
  const { element, inner } = wrapMarkerElement(
    iconElement,
    MARKER_CONSTANT.IMAGE_MARKER_SIZE[0],
    MARKER_CONSTANT.IMAGE_MARKER_SIZE[1]
  )
  return {
    element,
    inner,
    iconUrl: url,
  }
}

// 视频标记图标：封面图 + 播放角标
export function createVideoMarkerIcon(videoInfo: IVideoInfo, coverUrl?: string): MarkerIcon {
  const url = coverUrl || ''
  const iconElement = url
    ? IconHTMLFactory.createIcon(IconType.SingleImage, url)
    : IconHTMLFactory.createIcon(IconType.NoImage, videoInfo.name || '视频')
  const badge = document.createElement('div')
  badge.className = 'video-marker-badge'
  badge.textContent = '▶'
  iconElement.appendChild(badge)
  const { element, inner } = wrapMarkerElement(
    iconElement,
    MARKER_CONSTANT.IMAGE_MARKER_SIZE[0],
    MARKER_CONSTANT.IMAGE_MARKER_SIZE[1]
  )
  return {
    element,
    inner,
    iconUrl: url,
  }
}

export async function createGroupMarkerIcon(groupInfo: INewGroupFormData): Promise<MarkerIcon> {
  const groupNumbers = groupInfo.groupNumbers
  let iconElement: HTMLElement
  let imageUrls: string[] | undefined
  if (groupNumbers && groupNumbers.length > 0) {
    const resImageUrls = await getMarkerImageUrlByIds(
      groupNumbers.slice(0, GROUP_CONSTANT.GROUP_COVER_NUMBER)
    )
    if (!resImageUrls || resImageUrls.length === 0) {
      iconElement = IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name)
    } else {
      imageUrls = resImageUrls.map((item) => item)
      iconElement = IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls, groupNumbers?.length ?? 0)
    }
  } else {
    iconElement = IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name)
  }
  const { element, inner } = wrapMarkerElement(
    iconElement,
    MARKER_CONSTANT.GROUP_MARKER_SIZE[0],
    MARKER_CONSTANT.GROUP_MARKER_SIZE[1]
  )
  return {
    element,
    inner,
    imageUrls,
  }
}

export function createGroupMarkerElement(
  groupNumbers: string[],
  imageUrls: string[],
  name: string
): MarkerIcon {
  const iconElement =
    groupNumbers && groupNumbers.length > 0 && imageUrls && imageUrls.length > 0
      ? IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls, groupNumbers.length)
      : IconHTMLFactory.createIcon(IconType.NoImageGroup, name)
  const { element, inner } = wrapMarkerElement(
    iconElement,
    MARKER_CONSTANT.GROUP_MARKER_SIZE[0],
    MARKER_CONSTANT.GROUP_MARKER_SIZE[1]
  )
  return {
    element,
    inner,
    imageUrls,
  }
}

// 聚合点图标：圆形 + 数量徽标（两层：外层定位，内层弹出动画）
export function createClusterIcon(count: number): MarkerIcon {
  const inner = document.createElement('div')
  inner.className = 'cluster-marker-inner'
  inner.style.cssText =
    'width:100%;height:100%;border-radius:50%;background:#51bbd6;color:#fff;' +
    'display:flex;align-items:center;justify-content:center;font-weight:bold;' +
    'font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;'
  inner.textContent = String(count)
  const outer = document.createElement('div')
  outer.className = 'map-marker'
  outer.style.width = '40px'
  outer.style.height = '40px'
  outer.style.boxSizing = 'border-box'
  outer.appendChild(inner)
  return { element: outer, inner }
}

// 弹出动画：聚合点/离散单点出现时 scale 0.3→1，只做缩放不做透明度（避免闪烁）
export function popInMarker(marker: MapMarkerAdapter) {
  const inner = marker.getInnerElement()
  if (inner && typeof inner.animate === 'function') {
    inner.animate(
      [
        { transform: 'scale(0.3)' },
        { transform: 'scale(1)' },
      ],
      { duration: 200, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' }
    )
  }
}
