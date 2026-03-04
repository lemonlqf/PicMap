/*
 * @Author: your name
 * @Date: 2025-09-13 14:43:09
 * @LastEditTime: 2025-09-13 17:44:35
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @Description: In User Settings Edit
 * @FilePath: \Code\picMap_fontend\src\services\map.ts
 */
import L from "leaflet";

import markerService from "@/services/marker";

import eventBus from "@/utils/eventBus";

class MapService {
  // 地图实例
  private MAP_INSTANCE: L.Map | null;

  /**
   * @description: 获取地图实例
   * @param {*}
   * @return {*}
   */
  getMapInstance() {
    return this.MAP_INSTANCE;
  }

  /**
   * @description: 初始化地图实例
   * @param {*}
   * @return {*}
   */
  initMapInstance(mapInstance: L.Map) {
    if (!mapInstance) {
      throw new Error("地图实例不能为空");
    }
    this.MAP_INSTANCE = mapInstance;
    // 其他地方也需要使用地图实例，所以需要将地图实例暴露出去
    markerService.initMapInstance(mapInstance);
  }

  /**
   * @description: 监听地图改变事件，用于更新marker
   * @param {*} map
   * @return {*}
   */
  observeMapChangeToUpgradeMarker() {
    // 刚开始先更新一波
    setTimeout(() => {
      markerService.updateVisibleMarkers();
    }, 100);
    const map = this.MAP_INSTANCE;
    map.on("moveend", () => {
      // 更新在可视范围内marker的图片
      markerService.updateVisibleMarkers();
    });
    map.on("movestart", () => {
      // 隐藏所有右击出现的弹框
      eventBus.emit("hidden-content-menu");
    });
    // 地图缩放改变marker大小
    map.on("zoomend", () => {
      // scaleMarkerByMap()
    });
  }

  /**
   * @description: 设置地图中心点
   * @param {*}
   * @return {*}
   */
  setViewByLatLng(lat: number, lng: number) {
    const map = this.MAP_INSTANCE
    if (lat && lng) {
      map?.setView?.([lat, lng], map.getZoom() ?? 10, {
        animate: true,
        duration: 0.5 // 动画持续时间，单位为秒
      })
      return
    }
  }

}

const mapService = new MapService();

export default mapService;
