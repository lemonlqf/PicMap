import * as maplibregl from 'maplibre-gl'

import IconHTMLFactory, { IconType } from '@/utils/iconHTML'
import { GROUP_CONSTANT, MARKER_CONSTANT } from '@/utils/constant'
import { getMarkerImageUrlByIds } from '@/utils/Image'
import type { IImageInfo, INewGroupFormData } from '@/type/schema'

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
    this.currentAnimationOnFinish = null
    this.animating = false
  }

  // 结束动画并立即跳到终点状态（地图移动打断时使用，避免动画错位）
  finishAnimation() {
    if (this.currentAnimation) {
      this.currentAnimation.cancel()
      this.currentAnimation = null
    }
    const onFinish = this.currentAnimationOnFinish
    this.currentAnimationOnFinish = null
    this.animating = false
    if (onFinish) onFinish()
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
        e.stopPropagation()
        cb(this.wrapEvent(e))
      })
    } else if (event === 'contextmenu') {
      el.addEventListener('contextmenu', (e: Event) => {
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
