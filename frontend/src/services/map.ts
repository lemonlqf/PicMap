import * as maplibregl from 'maplibre-gl'

import markerService from '@/services/marker'
import eventBus from '@/utils/eventBus'
import { toMapLibreLngLat } from '@/utils/mapLibre'

class MapService {
  // 地图实例
  private MAP_INSTANCE: maplibregl.Map | null = null

  getMapInstance() {
    return this.MAP_INSTANCE
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
    let moveendTimer: ReturnType<typeof setTimeout> | null = null
    map?.on('moveend', () => {
      if (moveendTimer) {
        clearTimeout(moveendTimer)
      }
      moveendTimer = setTimeout(() => {
        moveendTimer = null
        markerService.updateVisibleMarkers()
      }, 200)
    })
    map?.on('movestart', () => {
      eventBus.emit('hidden-content-menu')
      markerService.cancelAllFlyAnimations()
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
