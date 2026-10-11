import * as maplibregl from 'maplibre-gl'

import markerService from '@/services/marker'
import eventBus from '@/utils/eventBus'
import { toMapLibreLngLat } from '@/utils/mapLibre'

class MapService {
  // 地图实例
  private MAP_INSTANCE: maplibregl.Map | null = null
  // 主地图轨迹渲染回调，由主地图注册，用于开关变化时即时重渲染
  private trackRenderCallback: (() => void) | null = null

  getMapInstance() {
    return this.MAP_INSTANCE
  }

  registerTrackRender(callback: () => void) {
    this.trackRenderCallback = callback
  }

  renderMainMapTracks() {
    this.trackRenderCallback?.()
  }

  initMapInstance(mapInstance: maplibregl.Map) {
    if (!mapInstance) {
      throw new Error('地图实例不能为空')
    }
    this.MAP_INSTANCE = mapInstance
    markerService.initMapInstance(mapInstance)
  }

  observeMapChangeToUpgradeMarker() {
    setTimeout(() => {
      markerService.updateVisibleMarkers()
    }, 100)
    const map = this.MAP_INSTANCE
    // 移动过程中实时判断节点是否移入视窗并添加（requestAnimationFrame 节流，避免频繁重建）
    let rafId: number | null = null
    const scheduleRender = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        markerService.updateVisibleMarkers()
      })
    }
    map?.on('move', scheduleRender)
    // 移动结束后兜底一次，确保最终状态正确
    map?.on('moveend', () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      markerService.updateVisibleMarkers()
    })
    map?.on('movestart', () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      eventBus.emit('hidden-content-menu')
      markerService.cancelAllFlyAnimations()
      markerService.unspiderfy()
    })
  }

  setViewByLatLng(lat: number, lng: number) {
    const map = this.MAP_INSTANCE
    if (lat && lng) {
      map?.flyTo({
        center: toMapLibreLngLat(lat, lng),
        zoom: map.getZoom() ?? 10,
        duration: 500,
      })
    }
  }
}

const mapService = new MapService()

export default mapService
