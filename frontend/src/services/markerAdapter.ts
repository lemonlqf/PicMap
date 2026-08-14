import * as maplibregl from 'maplibre-gl'

import IconHTMLFactory, { IconType } from '@/utils/iconHTML'
import { GROUP_CONSTANT } from '@/utils/constant'
import { getMarkerImageUrlByIds } from '@/utils/Image'
import type { IImageInfo, INewGroupFormData } from '@/type/schema'

export interface MarkerIcon {
  element: HTMLElement
  iconUrl?: string
  imageUrls?: string[]
}

export interface MarkerOptions {
  id: string
  type: string
  draggable?: boolean
  iconUrl?: string
}

export class MapMarkerAdapter {
  readonly options: MarkerOptions
  readonly mlMarker: maplibregl.Marker
  dragging: { enable: () => void; disable: () => void }
  private icon: MarkerIcon

  constructor(icon: MarkerIcon, lngLat: [number, number], options: MarkerOptions) {
    this.options = options
    this.icon = icon
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
    const el = this.mlMarker.getElement()
    el.innerHTML = icon.element.innerHTML
    el.className = icon.element.className
  }

  getElement(): HTMLElement {
    return this.mlMarker.getElement()
  }

  setZIndexOffset(offset: number) {
    this.mlMarker.getElement().style.zIndex = String(offset)
  }

  on(event: string, cb: (...args: any[]) => void) {
    const el = this.mlMarker.getElement()
    if (event === 'moveend' || event === 'dragend') {
      this.mlMarker.on('dragend', () => cb())
    } else if (event === 'click') {
      el.addEventListener('click', (e: Event) => cb(e))
    } else if (event === 'contextmenu') {
      el.addEventListener('contextmenu', (e: Event) => cb(e))
    } else if (event === 'mouseover') {
      el.addEventListener('mouseover', (e: Event) => cb(e))
    } else if (event === 'mouseout') {
      el.addEventListener('mouseout', (e: Event) => cb(e))
    }
  }
}

export function createImageMarkerIcon(imageInfo: IImageInfo, imageUrl?: string): MarkerIcon {
  const url = imageUrl ?? imageInfo.url ?? ''
  if (!url) {
    return {
      element: IconHTMLFactory.createIcon(IconType.NoImage, imageInfo.name),
    }
  }
  return {
    element: IconHTMLFactory.createIcon(IconType.SingleImage, url),
    iconUrl: url,
  }
}

export async function createGroupMarkerIcon(groupInfo: INewGroupFormData): Promise<MarkerIcon> {
  const groupNumbers = groupInfo.groupNumbers
  if (groupNumbers && groupNumbers.length > 0) {
    const resImageUrls = await getMarkerImageUrlByIds(
      groupNumbers.slice(0, GROUP_CONSTANT.GROUP_COVER_NUMBER)
    )
    if (!resImageUrls || resImageUrls.length === 0) {
      return { element: IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name) }
    }
    const imageUrls = resImageUrls.map((item) => item)
    return {
      element: IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls, groupNumbers?.length ?? 0),
      imageUrls,
    }
  }
  return {
    element: IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name),
  }
}

export function createGroupMarkerElement(
  groupNumbers: string[],
  imageUrls: string[],
  name: string
): MarkerIcon {
  if (groupNumbers && groupNumbers.length > 0 && imageUrls && imageUrls.length > 0) {
    return {
      element: IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls, groupNumbers.length),
      imageUrls,
    }
  }
  return { element: IconHTMLFactory.createIcon(IconType.NoImageGroup, name) }
}

// 聚合点图标：圆形 + 数量徽标
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
