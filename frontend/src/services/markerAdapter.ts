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

  getLatLng(): { lat: number; lng: number; alt: number } {
    const ll = this.mlMarker.getLngLat()
    return { lat: ll.lat, lng: ll.lng, alt: 0 }
  }

  setLatLng(lat: number, lng: number) {
    this.mlMarker.setLngLat([lng, lat])
  }

  setIcon(icon: MarkerIcon) {
    this.icon = icon
    const inner = icon.inner ?? icon.element
    // 更新外层内容：清空后放入新的内层元素
    const outer = this.mlMarker.getElement()
    outer.innerHTML = ''
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

// 聚合点图标：圆形 + 数量徽标（单层，无 hover 缩放）
export function createClusterIcon(count: number): MarkerIcon {
  const el = document.createElement('div')
  el.className = 'cluster-marker'
  el.style.cssText =
    'width:40px;height:40px;border-radius:50%;background:#51bbd6;color:#fff;' +
    'display:flex;align-items:center;justify-content:center;font-weight:bold;' +
    'font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;'
  el.textContent = String(count)
  return { element: el }
}
