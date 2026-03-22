/*
 * @Author: Do not edit
 * @Date: 2026-03-18 16:11:31
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-22 23:49:52
 * @FilePath: \PicMap\picMap_fontend\src\services\track.ts
 * @Description: 轨迹图层服务，管理轨迹的加载、显示、删除等操作
 */
import 'leaflet-gpx';
import L from "leaflet";
import { wgs84ToGcj02 } from '../utils/WGS84-GCJ02';
import trackApi from '@/http/modules/track';

const defaultOptions = {}

/**
 * 轨迹服务类
 * 负责管理所有轨迹实例，提供轨迹的激活、显示、隐藏、删除等功能
 */
class TrackService {
  // 存储所有轨迹实例，key为轨迹ID（文件名）
  private trackInstances: Map<string, TrackInstance>;


  constructor() {
    this.trackInstances = new Map();
  }

  /**
   * @description: 根据轨迹ID获取轨迹实例
   * @param {string} trackId - 轨迹ID
   * @return {TrackInstance | undefined}
   */
  getTrackInstanceById(trackId: string): TrackInstance | undefined {
    return this.trackInstances.get(trackId);
  }

  /**
   * @description: 激活轨迹，将轨迹文件加载到地图上
   * 如果轨迹已存在则直接添加到地图，否则创建新的轨迹实例
   * @param {File} file - 轨迹文件
   * @param {L.Map} map - 地图实例
   * @param {any} options - 配置选项
   * @return {TrackInstance}
   */
  activeTrack(file: File, map?: L.Map, options: any = defaultOptions): TrackInstance {
    let trackInstance = this.trackInstances.get(file.name);
    if (trackInstance) {
      // 如果轨迹已存在，直接添加到地图
      if (map) {
        trackInstance.addMap(map);
      }
    } else {
      // 创建新的轨迹实例并添加到地图
      trackInstance = new TrackInstance(file, map ? [map] : [], options);
      this.trackInstances.set(trackInstance.getTrackId(), trackInstance);
    }
    return trackInstance;
  }

  /**
   * @description: 隐藏轨迹，轨迹图层从地图移除但实例仍保留
   * @param {string} trackId - 轨迹ID
   * @param {L.Map} map - 可选，指定地图；如果不传则从所有地图移除
   */
  hideTrack(trackId: string, map?: L.Map) {
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      const trackLayer = trackInstance.getTrackLayer();
      if (trackLayer && map?.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      } else {
        trackInstance.getMapInstances().forEach(map => {
          map.removeLayer(trackLayer);
        });
      }
    }
  }

  /**
   * @description: 隐藏所有轨迹，所有轨迹图层从指定地图移除但实例仍保留
   * @param {L.Map} map - 地图实例
   */
  hideAllTracks(map: L.Map) {
    this.getInstances().forEach(trackInstance => {
      const trackLayer = trackInstance.getTrackLayer();
      if (trackLayer && map?.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      }
      // 如果轨迹实例内部的mapInstances中有这个地图，也要从中移除
      const mapInstances = trackInstance.getMapInstances();
      const index = mapInstances.indexOf(map);
      if (index !== -1) {
        mapInstances.splice(index, 1);
      }
    });
  }

  /**
   * @description: 显示轨迹，将轨迹图层添加到地图
   * @param {string} trackId - 轨迹ID
   * @param {L.Map} map - 可选，指定地图；如果不传则添加到所有地图
   */
  showTrack(trackId: string, map?: L.Map) {
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      const trackLayer = trackInstance.getTrackLayer();
      if (map) {
        map.addLayer(trackLayer);
      } else {
        trackInstance.getMapInstances().forEach(map => {
          map.addLayer(trackLayer);
        })
      }
    }
  }

  /**
   * @description: 删除轨迹，从所有地图移除并销毁实例
   * @param {string} trackId - 轨迹ID
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
   * @description: 删除所有轨迹，清空所有地图上的轨迹图层并清空实例
   */
  deleteAllTracks() {
    this.getInstances().forEach(trackInstance => {
      const trackLayer = trackInstance.getTrackLayer();
      trackInstance.getMapInstances().forEach(map => {
        map.removeLayer(trackLayer);
      });
    });
    this.trackInstances.clear();
  }

  /**
   * @description: 从指定地图删除所有轨迹图层
   * 如果轨迹不在任何地图上则从实例中删除
   * @param {L.Map} map - 地图实例
   */
  deleteTracksInMap(map: L.Map) {
    this.getInstances().forEach(trackInstance => {
      const trackLayer = trackInstance.getTrackLayer();
      if (trackLayer && map.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      }
      // 如果轨迹不在任何地图上，从实例中删除
      if (trackInstance.getMapInstances().length === 0) {
        this.trackInstances.delete(trackInstance.getTrackId());
      }
    });
  }

  /**
   * @description: 上传轨迹文件到后端
   * @param {File} file - 轨迹文件
   * @return {Promise}
   */
  async uploadTrack(file: File) {
    const res = await trackApi.uploadTrack(file)
    return res
  }

  /**
   * @description: 获取所有轨迹实例
   * @return {Map<string, TrackInstance>}
   */
  getInstances() {
    return Array.from(this.trackInstances.values());
  }
}

const trackService = new TrackService();

export default trackService;

// -----------------------------------------

/**
 * 轨迹统计信息类型
 * 包含轨迹的各类统计数据
 */
interface TrackInfo {
  name: string;           // 轨迹名称
  distance: number;       // 总距离，单位：米
  startTime: Date;        // 开始时间
  endTime: Date;          // 结束时间
  movingTime: number;      // 移动时间，单位：毫秒
  totalTime: number;       // 总时间，单位：毫秒
  movingPace: number;      // 平均移动配速，单位：毫秒/公里
  movingSpeed: number;     // 平均移动速度，单位：公里/小时
  totalSpeed: number;      // 平均总速度，单位：公里/小时
  elevationMin: number;    // 最低海拔，单位：米
  elevationMax: number;    // 最高海拔，单位：米
  elevationGain: number;   // 累计爬升，单位：米
  elevationLoss: number;   // 累计下降，单位：米
  speedMax: number;        // 最大速度，单位：公里/小时
  averageHr: number | null;       // 平均心率
  averageCadence: number | null;   // 平均踏频
  averageTemp: number | null;      // 平均温度
}

/**
 * 轨迹实例类
 * 封装单个轨迹的加载、解析、显示等功能
 */
class TrackInstance {

  // 轨迹ID，使用文件名
  private trackId: string;
  // 轨迹图层实例
  private trackLayer: L.GPX;
  // 轨迹统计信息
  private trackInfo: Partial<TrackInfo> = {};
  // 地图实例数组
  private mapInstances: L.Map[] = [];
  // 待处理的回调函数（在轨迹信息加载完成前调用）
  private pendingCallbacks: ((trackInfo: any) => void)[] = [];

  constructor(file: File, maps: L.Map[] = [], options: any = defaultOptions) {

    this.trackId = file.name;
    this.mapInstances.push(...maps.filter((map): map is L.Map => !!map));

    // 异步读取并解析GPX文件
    this.readFileAsText(file).then((fileContent) => {
      // 将WGS84坐标转换为GCJ02坐标
      const convertedGpx = this.convertGpxCoordinates(fileContent);
      this.trackLayer = new L.GPX(convertedGpx, options);

      // 轨迹图层添加到地图时触发
      this.trackLayer.on('add', () => {
        this.setTrackInfo(this.trackLayer);
        // 触发自定义事件，通知轨迹信息已加载
        this.trackLayer.fire('trackInfoLoaded', { trackInfo: this.trackInfo });
        console.log('轨迹图层已添加到地图', this.trackInfo);
      });

      // 鼠标悬停时显示轨迹信息
      this.trackLayer.on("mouseover", () => {
        const info = this.getTrackInfo();
        const infoStr = JSON.stringify(info);
        console.log('鼠标悬停在轨迹上，显示轨迹信息', infoStr);
      });

      // 添加到已存在的地图
      this.mapInstances.forEach(map => {
        map && this.trackLayer.addTo(map);
      });

      // 处理所有待处理的回调
      this.pendingCallbacks.forEach(cb => cb(this.trackInfo));
      this.pendingCallbacks = [];

    })
  }

  /**
   * @description: 设置轨迹统计信息，从GPX图层中提取各类数据
   * @param {L.GPX} trackLayer - GPX轨迹图层
   */
  setTrackInfo(trackLayer: L.GPX) {
    this.trackInfo = {
      name: trackLayer.get_name(),             // 轨迹名称
      distance: trackLayer.get_distance(),      // 总距离
      startTime: trackLayer.get_start_time(),  // 开始时间
      endTime: trackLayer.get_end_time(),      // 结束时间
      movingTime: trackLayer.get_moving_time(),        // 移动时间
      totalTime: trackLayer.get_total_time(),          // 总时间
      movingPace: trackLayer.get_moving_pace(),         // 移动配速
      movingSpeed: trackLayer.get_moving_speed(),       // 移动速度
      totalSpeed: trackLayer.get_total_speed(),         // 总速度
      elevationMin: trackLayer.get_elevation_min(),     // 最低海拔
      elevationMax: trackLayer.get_elevation_max(),     // 最高海拔
      elevationGain: trackLayer.get_elevation_gain(),   // 累计爬升
      elevationLoss: trackLayer.get_elevation_loss(),   // 累计下降
      speedMax: trackLayer.get_speed_max(),             // 最大速度
      averageHr: trackLayer.get_average_hr?.(),        // 平均心率
      averageCadence: trackLayer.get_average_cadence?.(), // 平均踏频
      averageTemp: trackLayer.get_average_temp?.(),     // 平均温度
    }
  }

  /**
   * @description: 将轨迹图层添加到指定地图
   * @param {L.Map} map - 地图实例
   */
addMap(map: L.Map) {
    if (!map) {
      console.error('addMap called with undefined map')
      return
    }
    if (!this.mapInstances.includes(map)) {
      this.mapInstances.push(map);
    }
    // 轨迹图层是异步创建的，未就绪时先仅记录地图，待构造流程自动 addTo
    if (!this.trackLayer) {
      return
    }
    if (!map.hasLayer(this.trackLayer)) {
      map.addLayer(this.trackLayer);
      // 手动触发add事件以便更新轨迹信息
      this.trackLayer.fire('add');
    }
  }

  /**
   * @description: 获取轨迹ID
   * @return {string}
   */
  getTrackId() {
    return this.trackId;
  }

  /**
   * @description: 获取轨迹图层实例
   * @return {L.GPX}
   */
  getTrackLayer() {
    return this.trackLayer;
  }

  /**
   * @description: 获取该轨迹所在的地图实例数组
   * @return {L.Map[]}
   */
  getMapInstances() {
    return this.mapInstances;
  }

  /**
   * @description: 获取轨迹统计信息
   * @return {Partial<TrackInfo>}
   */
  getTrackInfo() {
    return this.trackInfo;
  }

  /**
   * @description: 监听轨迹信息加载完成事件
   * 如果轨迹信息已经加载完成则立即执行回调，否则等待加载完成
   * @param {Function} callback - 回调函数，接收trackInfo参数
   */
  onTrackInfoReady(callback: (trackInfo: any) => void) {
    if (this.trackInfo && this.trackInfo.name) {
      // 轨迹信息已加载，直接执行回调
      callback(this.trackInfo);
    } else if (this.trackLayer) {
      // 等待轨迹信息加载完成事件
      this.trackLayer.once('trackInfoLoaded', (e: any) => {
        callback(e.trackInfo);
      });
    } else {
      // 轨迹图层还未创建，加入待处理队列
      this.pendingCallbacks.push(callback);
    }
  }

  /**
   * @description: 将GPX内容中的WGS84坐标转换为GCJ02坐标
   * @param {string} gpxContent - GPX文件内容
   * @return {string} 转换后的GPX内容
   */
  convertGpxCoordinates(gpxContent: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'text/xml');
    const convertedDoc = this.convertDocCoordinates(doc);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(convertedDoc);
  }

  /**
   * @description: 将文档中所有坐标点从WGS84转换为GCJ02
   * @param {Document} doc - XML文档
   * @return {Document}
   */
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

  /**
   * @description: 将文件读取为文本
   * @param {File} file - 文件对象
   * @return {Promise<string>}
   */
  readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }
}