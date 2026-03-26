/*
 * @Author: Do not edit
 * @Date: 2026-03-18 16:11:31
 * @LastEditors: lemonlqf lemonlqf@outlook.com
 * @LastEditTime: 2026-03-26 17:18:21
 * @FilePath: \PicMap\picMap_fontend\src\services\track.ts
 * @Description: 轨迹图层服务，管理轨迹的加载、显示、删除等操作
 */
import '@/assets/leaflet-gpx/leaflet-gpx.js';
import L from "leaflet";
import { wgs84ToGcj02 } from '../utils/WGS84-GCJ02';
import trackApi from '@/http/modules/track';
import { getDefaultLineColor } from '@/utils/track';

const startIconUrl = new URL('../assets/icon/起点.png', import.meta.url).href;
const endIconUrl = new URL('../assets/icon/终点.png', import.meta.url).href;

const startIcon = L.icon({
  className: "track-marker-icon track-marker-start",
  iconUrl: startIconUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -33],
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

const endIcon = L.icon({
  className: "track-marker-icon track-marker-end",
  iconUrl: endIconUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [0, -33],
  shadowSize: [41, 41],
  shadowAnchor: [13, 41]
});

const defaultOptions = {
  markers: {
    startIcon,
    endIcon,
  }
}

const TRACK_INSTANCE_GC_DELAY_MS = 2000;

/**
 * 轨迹服务类
 * 负责管理所有轨迹实例，提供轨迹的激活、显示、隐藏、删除等功能
 */
class TrackService {
  // 存储所有轨迹实例，key为轨迹ID（文件名）
  private trackInstances: Map<string, TrackInstance>;
  // 待销毁的实例定时器，避免地图快速切换导致重复创建
  private destroyTimers: Map<string, ReturnType<typeof setTimeout>>;


  constructor() {
    this.trackInstances = new Map();
    this.destroyTimers = new Map();
  }

  private clearDestroyTimer(trackId: string) {
    const timer = this.destroyTimers.get(trackId);
    if (timer) {
      clearTimeout(timer);
      this.destroyTimers.delete(trackId);
    }
  }

  private scheduleDestroy(trackId: string) {
    this.clearDestroyTimer(trackId);
    const timer = setTimeout(() => {
      const trackInstance = this.trackInstances.get(trackId);
      // 只有在没有任何地图引用时才真正销毁
      if (trackInstance && trackInstance.getMapInstances().length === 0) {
        this.trackInstances.delete(trackId);
      }
      this.destroyTimers.delete(trackId);
    }, TRACK_INSTANCE_GC_DELAY_MS);
    this.destroyTimers.set(trackId, timer);
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
      this.clearDestroyTimer(file.name);
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
      if (map) {
        const trackLayer = trackInstance.getTrackLayer(map);
        if (trackLayer && map.hasLayer?.(trackLayer)) {
          map.removeLayer(trackLayer);
        }
      } else {
        trackInstance.getMapInstances().forEach(map => {
          const trackLayer = trackInstance.getTrackLayer(map);
          if (trackLayer && map.hasLayer?.(trackLayer)) {
            map.removeLayer(trackLayer);
          }
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
      const trackLayer = trackInstance.getTrackLayer(map);
      if (trackLayer && map?.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      }
      // 如果轨迹实例内部的mapInstances中有这个地图，也要从中移除
      trackInstance.removeMap(map);
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
      if (map) {
        trackInstance.addMap(map);
      } else {
        trackInstance.getMapInstances().forEach(map => {
          trackInstance.addMap(map);
        })
      }
    }
  }

  /**
   * @description: 删除轨迹，从所有地图移除并销毁实例
   * @param {string} trackId - 轨迹ID
   */
  deleteTrack(trackId: string) {
    this.clearDestroyTimer(trackId);
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      trackInstance.getMapInstances().slice().forEach(map => {
        trackInstance.removeMap(map);
      });
      this.trackInstances.delete(trackId);
    }
  }

  /**
   * @description: 删除所有轨迹，清空所有地图上的轨迹图层并清空实例
   */
  deleteAllTracks() {
    this.destroyTimers.forEach((timer) => clearTimeout(timer));
    this.destroyTimers.clear();
    this.getInstances().forEach(trackInstance => {
      trackInstance.getMapInstances().slice().forEach(map => {
        trackInstance.removeMap(map);
      });
    });
    this.trackInstances.clear();
  }

  /**
   * @description: 更新轨迹颜色
   * @param {string} trackId - 轨迹ID
   * @param {string} color - 颜色值
   */
  updateTrackColor(trackId: string, color: string) {
    const trackInstance = this.trackInstances.get(trackId);
    if (trackInstance) {
      trackInstance.setLineColor(color);
    }
  }

  /**
   * @description: 从指定地图删除所有轨迹图层
   * 如果轨迹不在任何地图上则从实例中删除
   * @param {L.Map} map - 地图实例
   */
  deleteTracksInMap(map: L.Map) {
    this.getInstances().forEach(trackInstance => {
      const trackLayer = trackInstance.getTrackLayer(map);
      if (trackLayer && map.hasLayer?.(trackLayer)) {
        map.removeLayer(trackLayer);
      }
      trackInstance.removeMap(map);
      // 两个地图都移除后，延迟销毁，避免快速切换时重复创建实例
      if (trackInstance.getMapInstances().length === 0) {
        this.scheduleDestroy(trackInstance.getTrackId());
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
  // 默认轨迹图层实例（兼容旧接口）
  private trackLayer: L.GPX | undefined;
  // 每个地图维护独立图层，避免同一图层在不同地图间互相影响
  private layerByMap: WeakMap<L.Map, L.GPX> = new WeakMap();
  // 轨迹统计信息
  private trackInfo: Partial<TrackInfo> = {};
  // 地图实例数组
  private mapInstances: L.Map[] = [];
  // 待处理的回调函数（在轨迹信息加载完成前调用）
  private pendingCallbacks: ((trackInfo: any) => void)[] = [];
  private options: any;
  private convertedGpx = '';
  // 轨迹线颜色，用于创建图层时和应用到已有图层
  private lineColor: string | undefined = getDefaultLineColor(true);
  // 悬浮回调函数，按地图实例存储
  private hoverCallbacks: Map<L.Map, (trackInfo: Partial<TrackInfo>, event: 'enter' | 'leave') => void> = new Map();
  // 点击回调函数，按地图实例存储
  private clickCallbacks: Map<L.Map, (trackInfo: Partial<TrackInfo>) => void> = new Map();
  // 当前高亮的地图ID
  private highlightedMapId: string | null = null;

  private hashTrackId(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  /**
   * @description: 获取创建GPX图层时的选项，如果设置了lineColor则应用颜色
   * @return {*} 包含轨迹线颜色的选项对象
   */
  private getLayerOptions() {
    const options = { ...this.options };
    if (this.lineColor) {
      options.polyline_options = {
        ...options.polyline_options,
        color: this.lineColor
      };
    }
    return options;
  }

  /**
   * @description: 设置轨迹线颜色
   * 如果颜色已设置，会遍历所有地图实例上的轨迹图层并更新颜色
   * @param {string | undefined} color - 十六进制颜色值，如 '#FF6B6B'
   */
  setLineColor(color: string | undefined) {
    this.lineColor = color;
    if (color) {
      this.mapInstances.forEach((mapInstance) => {
        const gpxLayer = this.layerByMap.get(mapInstance);
        if (gpxLayer) {
          const layers = gpxLayer.getLayers();
          layers.forEach((layer: any) => {
            if (layer.setStyle) {
              layer.setStyle({ color });
            }
          });
        }
      });
    }
  }

  // 多条轨迹起终点重叠时，做极小偏移避免完全遮挡。
  private disambiguateEdgeMarker(point: L.Marker, pointType: 'start' | 'end') {
    const origin = point.getLatLng();
    const slotCount = 12;
    const slot = this.hashTrackId(`${this.trackId}-${pointType}`) % slotCount;
    const angle = (Math.PI * 2 * slot) / slotCount;
    const radius = pointType === 'start' ? 0.00002 : 0.000026;
    const lat = origin.lat + radius * Math.sin(angle);
    const lng = origin.lng + radius * Math.cos(angle);
    point.setLatLng(L.latLng(lat, lng));
    point.setZIndexOffset(1000 + slot + (pointType === 'end' ? 100 : 0));
  }

  constructor(file: File, maps: L.Map[] = [], options: any = defaultOptions) {

    this.trackId = file.name;
    this.options = options;
    this.mapInstances.push(...maps.filter((map): map is L.Map => !!map));

    // 异步读取并解析GPX文件
    this.readFileAsText(file).then((fileContent) => {
      // 将WGS84坐标转换为GCJ02坐标
      this.convertedGpx = this.convertGpxCoordinates(fileContent);

      // 添加到已存在的地图
      this.mapInstances.forEach(map => {
        if (map) {
          this.addMap(map);
        }
      });

    })
  }

  private createLayerForMap(map: L.Map) {
    const layerOptions = this.getLayerOptions();
    const layer = new L.GPX(this.convertedGpx, layerOptions);

    layer.on('addpoint', (e: any) => {
      if (!e?.point || (e.point_type !== 'start' && e.point_type !== 'end')) {
        return;
      }
      this.disambiguateEdgeMarker(e.point, e.point_type);
    });

    // 首次加载到地图时提取轨迹信息，并释放等待队列
    layer.on('add', () => {
      if (!this.trackInfo.name) {
        this.setTrackInfo(layer);
        this.pendingCallbacks.forEach(cb => cb(this.trackInfo));
        this.pendingCallbacks = [];
      }
      console.log('轨迹图层已添加到地图', this.trackInfo);
    });

    layer.on('mouseover', () => {
      const callback = this.hoverCallbacks.get(map);
      if (callback) {
        callback(this.getTrackInfo(), 'enter');
      }
    });

    layer.on('mouseout', () => {
      const callback = this.hoverCallbacks.get(map);
      if (callback) {
        callback(this.getTrackInfo(), 'leave');
      }
    });

    layer.on('click', (e: any) => {
      console.log('GPX layer click event fired on map:', map);
      const callback = this.clickCallbacks.get(map);
      console.log('Callback found:', !!callback);
      if (callback) {
        callback(this.getTrackInfo());
      }
    });

    if (!this.trackLayer) {
      this.trackLayer = layer;
    }
    return layer;
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
    // 轨迹内容尚未就绪时先仅记录地图，待构造流程自动 addTo
    if (!this.convertedGpx) {
      return
    }

    let layer = this.layerByMap.get(map);
    if (!layer) {
      layer = this.createLayerForMap(map);
      this.layerByMap.set(map, layer);
    }

    if (!map.hasLayer(layer)) {
      map.addLayer(layer);
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
  getTrackLayer(map?: L.Map) {
    if (map) {
      return this.layerByMap.get(map);
    }
    return this.trackLayer;
  }

  removeMap(map: L.Map) {
    const layer = this.layerByMap.get(map);
    if (layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
    this.layerByMap.delete(map);
    this.hoverCallbacks.delete(map);
    this.clickCallbacks.delete(map);

    const index = this.mapInstances.indexOf(map);
    if (index !== -1) {
      this.mapInstances.splice(index, 1);
    }
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
   * @description: 获取轨迹线颜色
   * @return {string | undefined}
   */
  getLineColor() {
    return this.lineColor;
  }

  setHoverCallback(map: L.Map, callback: (trackInfo: Partial<TrackInfo>, event: 'enter' | 'leave') => void) {
    this.hoverCallbacks.set(map, callback);
  }

  setClickCallback(map: L.Map, callback: (trackInfo: Partial<TrackInfo>) => void) {
    this.clickCallbacks.set(map, callback);
  }

  /**
   * @description: 高亮指定地图上的轨迹
   * @param {L.Map} map - 地图实例
   * @param {string} mapId - 地图唯一ID
   */
  highlight(map: L.Map, mapId: string) {
    console.log('Highlight called for mapId:', mapId, 'current highlighted:', this.highlightedMapId);
    if (this.highlightedMapId === mapId) {
      console.log('Already highlighted, skipping');
      return;
    }
    
    this.unhighlight();
    this.highlightedMapId = mapId;
    
    const gpxLayer = this.layerByMap.get(map);
    console.log('GPX Layer:', gpxLayer, 'Layers:', gpxLayer?.getLayers());
    if (gpxLayer) {
      const layers = gpxLayer.getLayers();
      layers.forEach((layer: any) => {
        console.log('Layer:', layer, 'has setStyle:', typeof layer.setStyle);
        if (layer.setStyle) {
          layer.setStyle({
            color: '#409eff',
            weight: 6,
            opacity: 1
          });
        }
        if (layer.bringToFront) {
          layer.bringToFront();
        }
      });
    }
  }

  /**
   * @description: 取消高亮
   */
  unhighlight() {
    if (!this.highlightedMapId) return;
    
    this.mapInstances.forEach(map => {
      const gpxLayer = this.layerByMap.get(map);
      if (gpxLayer) {
        const layers = gpxLayer.getLayers();
        layers.forEach((layer: any) => {
          if (layer.setStyle) {
            layer.setStyle({
              color: this.lineColor,
              weight: 4,
              opacity: 0.8
            });
          }
          if (layer.bringToBack) {
            layer.bringToBack();
          }
        });
      }
    });
    
    this.highlightedMapId = null;
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
    } else {
      // 轨迹信息尚未就绪，加入待处理队列
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
