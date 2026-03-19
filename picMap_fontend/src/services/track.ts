/*
 * @Author: Do not edit
 * @Date: 2026-03-18 16:11:31
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-19 16:23:47
 * @FilePath: \PicMap\picMap_fontend\src\services\track.ts
 * @Description: 轨迹图层服务
 */
import 'leaflet-gpx';
import L from "leaflet";
import { wgs84ToGcj02 } from '../utils/WGS84-GCJ02';

const defaultOptions = {}

class TrackService {
  private trackInstances: Map<string, TrackInstance>;


  constructor() {
    this.trackInstances = new Map();
  }

  // 激活轨迹
  activeTrack(file: File, map?: L.Map, options: any = defaultOptions): TrackInstance {
    let trackInstance = this.trackInstances.get(file.name);
    if (trackInstance) {
      // 如果有的话直接添加到地图上
      trackInstance.addMap(map);
    } else {
      // 如果没有的话创建新的轨迹实例，并添加到地图上
      trackInstance = new TrackInstance(file, [map], options);
      this.trackInstances.set(trackInstance.getTrackId(), trackInstance);
    }
    return trackInstance;
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

  /**
   * @description: 删除所有轨迹，从所有地图中移除轨迹图层，并且清空trackInstances
   * @return {*}
   */
  deleteAllTracks() {
    this.trackInstances.forEach(trackInstance => {
      const trackLayer = trackInstance.getTrackLayer();
      trackInstance.getMapInstances().forEach(map => {
        map.removeLayer(trackLayer);
      });
    });
    this.trackInstances.clear();
  }

  /**
   * @description: 删除地图上的轨迹，从这个地图中移除轨迹图层，如果这个轨迹图层不在任何地图上了，就从trackInstances中删除这个轨迹实例
   * @param {L} map
   * @return {*}
   */
  deleteTracksInMap(map: L.Map) {
    this.trackInstances.forEach(trackInstance => {
      const trackLayer = trackInstance.getTrackLayer();
      if (map.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      }
      // 如果这个轨迹图层不在任何地图上了，就从trackInstances中删除这个轨迹实例
      if (trackInstance.getMapInstances().length === 0) {
        this.trackInstances.delete(trackInstance.getTrackId());
      }
    });
  }
}

const trackService = new TrackService();

export default trackService;

// -----------------------------------------

// 轨迹统计信息类型
interface TrackInfo {
  name: string;
  distance: number;
  startTime: Date;
  endTime: Date;
  movingTime: number;
  totalTime: number;
  movingPace: number;
  movingSpeed: number;
  totalSpeed: number;
  elevationMin: number;
  elevationMax: number;
  elevationGain: number;
  elevationLoss: number;
  speedMax: number;
  averageHr: number | null;
  averageCadence: number | null;
  averageTemp: number | null;
}

// 轨迹对象
class TrackInstance {

  // 轨迹id，使用文件名
  private trackId: string;
  // 轨迹图层实例
  private trackLayer: L.GPX;
  // 轨迹统计信息
  private trackInfo: Partial<TrackInfo> = {};
  // 地图实例
  private mapInstances: L.Map[] = [];

  constructor(file: File, maps: L.Map[] = [], options: any = defaultOptions) {

    this.trackId = file.name;

    this.mapInstances.push(...maps);


    this.readFileAsText(file).then((fileContent) => {
      // 转换GPX中的坐标，将WGS84坐标转换为GCJ02坐标
      const convertedGpx = this.convertGpxCoordinates(fileContent);
      this.trackLayer = new L.GPX(convertedGpx, options);

      this.trackLayer.on('add', () => {
        this.setTrackInfo(this.trackLayer);
        console.log('轨迹图层已添加到地图', this.trackInfo);
      });

      this.trackLayer.on("mouseover", () => {
        // 鼠标悬停时显示轨迹信息
        const info = this.getTrackInfo();
        const infoStr = JSON.stringify(info);
        console.log('鼠标悬停在轨迹上，显示轨迹信息', infoStr);
      });

      // 地图存在的还才添加
      this.mapInstances.forEach(map => {
        map && this.trackLayer.addTo(map);
      });

    })
  }

  /**
   * @description: 设置轨迹统计信息
   * @param {L} trackLayer
   * @return {*}
   */
  setTrackInfo(trackLayer: L.GPX) {
    this.trackInfo = {
      name: trackLayer.get_name(), // 轨迹名称
      distance: trackLayer.get_distance(), // 总距离，单位：米
      startTime: trackLayer.get_start_time(), // 轨迹开始时间
      endTime: trackLayer.get_end_time(), // 轨迹结束时间
      movingTime: trackLayer.get_moving_time(), // 移动时间，单位：毫秒
      totalTime: trackLayer.get_total_time(), // 总时间，单位：毫秒
      movingPace: trackLayer.get_moving_pace(), // 平均移动配速，单位：毫秒/公里
      movingSpeed: trackLayer.get_moving_speed(), // 平均移动速度，单位：公里/小时
      totalSpeed: trackLayer.get_total_speed(), // 平均总速度，单位：公里/小时
      elevationMin: trackLayer.get_elevation_min(), // 最低海拔，单位：米
      elevationMax: trackLayer.get_elevation_max(), // 最高海拔，单位：米
      elevationGain: trackLayer.get_elevation_gain(), // 累计爬升，单位：米
      elevationLoss: trackLayer.get_elevation_loss(), // 累计下降，单位：米
      speedMax: trackLayer.get_speed_max(), // 最大速度，单位：公里/小时
      averageHr: trackLayer.get_average_hr?.(), // 平均心率（如果有）
      averageCadence: trackLayer.get_average_cadence?.(), // 平均踏频（如果有）
      averageTemp: trackLayer.get_average_temp?.(), // 平均温度（如果有）
    }
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

  getTrackInfo() {
    return this.trackInfo;
  }

  // 工具函数：将GPX中的WGS84坐标转换为GCJ02
  convertGpxCoordinates(gpxContent: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'text/xml');
    const convertedDoc = this.convertDocCoordinates(doc);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(convertedDoc);
  }

  convertDocCoordinates(doc: Document): Document {
    const pointTags = ['trkpt', 'rtept', 'wpt'];
    pointTags.forEach(tagName => {
      const points = doc.getElementsByTagName(tagName);
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lon = parseFloat(pt.getAttribute('lon') || '0');
        const [convertedLon, convertedLat] = wgs84ToGcj02(lon, lat);
        pt.setAttribute('lat', String(convertedLat));
        pt.setAttribute('lon', String(convertedLon));
      }
    });
    return doc;
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