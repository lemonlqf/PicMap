/*
 * @Author: Do not edit
 * @Date: 2026-03-18 16:11:31
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-19 10:22:43
 * @FilePath: \PicMap\picMap_fontend\src\services\track.ts
 * @Description: 轨迹图层服务
 */
import 'leaflet-gpx';
import L from "leaflet";

const defaultOptions = {}

class TrackService {
  private trackInstances: Map<string, TrackInstance>;

  constructor() {
    this.trackInstances = new Map();
  }

  // 激活轨迹
  activeTrack(file: File, map?: L.Map, options: any = defaultOptions) {
    const existingTrackInstance = this.trackInstances.get(file.name);
    if (existingTrackInstance) {
      // 如果有的话直接添加到地图上
      existingTrackInstance.addMap(map);
    } else {
      // 如果没有的话创建新的轨迹实例，并添加到地图上
      const trackInstace = new TrackInstance(file, map, options);
      this.trackInstances.set(trackInstace.getTrackId(), trackInstace);
    }
  }

  /**
   * @description: 隐藏轨迹，实例仍然维护在trackInstances中
   * @param {string} trackId
   * @param {L} map - 可选参数，如果传入了map，则只从这个map中移除轨迹图层；如果没有传入map，则从所有地图中移除轨迹图层
   * @return {*}
   */
  hideTrack(trackId: string, map?: L.Map) {
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      const trackLayer = trackInstance.getTrackLayer();
      // 从目标地图中移除
      if (map?.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      } else {
        // 从所有地图中移除
        trackInstance.getMapInstances().forEach(map => {
          map.removeLayer(trackLayer);
        });
      }
    }
  }

  /**
   * @description: // 显示轨迹
   * @param {string} trackId
   * @param {L} map - 可选参数，如果传入了map，则只在这个map中显示轨迹图层；如果没有传入map，则在所有地图中显示轨迹图层
   * @return {*}
   */
  showTrack(trackId: string, map?: L.Map) {
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      const trackLayer = trackInstance.getTrackLayer();
      if (map) {
        map.addLayer(trackLayer);
      } else {
        // 添加到地图中
        trackInstance.getMapInstances().forEach(map => {
          map.addLayer(trackLayer);
        })
      }
    }
  }

  /**
   * @description: 删除轨迹，从所有地图中移除轨迹图层，并且从trackInstances中删除轨迹实例
   * @param {string} trackId
   * @return {*}
   */
  deleteTrack(trackId: string) {
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      const trackLayer = trackInstance.getTrackLayer();
      trackInstance.getMapInstances().forEach(map => {
        map.removeLayer(trackLayer);
      });
      this.trackInstances.delete(trackId);
    }
  }
}

const trackService = new TrackService();

export default trackService;

// -----------------------------------------

// 轨迹对象
class TrackInstance {

  // 轨迹id，使用文件名
  private trackId: string;
  // 轨迹图层实例
  private trackLayer: L.GPX;
  // 轨迹统计信息
  private trackInfo: any;
  // 地图实例
  private mapInstances: L.Map[] = [];

  constructor(file: File, maps: L.Map[] = [], options: any = defaultOptions) {

    this.trackId = file.name;

    this.mapInstances.push(...maps);

    this.readFileAsText(file).then((fileContent) => {

      this.trackLayer = new L.GPX(fileContent, options);
      // 地图存在的还才添加
      this.mapInstances.forEach(map => {
        map && this.trackLayer.addTo(map);
      });

      this.trackLayer.on('add', () => {
        console.log('=== add事件触发 - 轨迹统计信息 ===');
        console.log(`总距离：${(this.trackLayer?.get_distance() / 1000).toFixed(2)} 公里`);
        // console.log(`总耗时：${formatSeconds(this.trackLayer?.get_total_time())}`);
        console.log(`平均速度：${this.trackLayer?.get_average_speed?.()?.toFixed(2)} km/h`);

        // 适配地图视野
        // this.mapInstance.fitBounds(this.trackLayer.getBounds(), { padding: [50, 50] });
      });
    })
  }

  addMap(map: L.Map) {
    if (!this.mapInstances.includes(map)) {
      this.mapInstances.push(map);
      map.addLayer(this.trackLayer);
    }
  }

  getTrackId() {
    return this.trackId;
  }

  getTrackLayer() {
    return this.trackLayer;
  }

  getMapInstances() {
    return this.mapInstances;
  }

  // 2. 工具函数：读取本地文件为文本
  readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }
}