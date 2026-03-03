/*
* @Author: your name
* @Date: 2025-09-12 10:52:54
 * @LastEditTime: 2026-03-03 22:28:14
 * @LastEditors: lemonlqf lemonlqf@outlook.com
* @Description: In User Settings Edit
 * @FilePath: \PicMap\picMap_fontend\src\services\marker.ts
*/
import L from "leaflet";
import { ElMessage } from "element-plus";

import mapService from '@/services/map';
import { useMapStore } from "@/store/map";
import { useSchemaStore } from "@/store/schema";

import IconHTMLFactory, { IconType } from "@/utils/iconHTML";
import { getImageUrl } from "@/utils/Image";
import {
  MAP_CONSTANT,
  MARKER_CONSTANT,
  GROUP_CONSTANT,
  imageMarkerTranslateY,
  groupMarkerTranslateY,
} from "@/utils/constant";
import { judgeHadUploadImage } from "@/utils/schema";
import { getImageUrlById, getImageUrlByIds } from "@/utils/Image";
import { getGroupIdsByImageId, getGroupInfoByGroupId } from "@/utils/group";
import eventBus from "@/utils/eventBus";
import { GPSInfoLegality } from "@/utils/map";
import "leaflet.markercluster"
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  type IImageInfo,
  type INewGroupFormData,
  type IGroupInfo,
  type IGPSInfo,
} from "@/type/schema";

class MarkerService {
  // 地图实例
  private MAP_INSTANCE: L.Map | null;
  // 创建聚合组
  private markerClusters: L.MarkerClusterGroup | null;
  constructor() {
    this.markerClusters = L.markerClusterGroup({
      // spiderfyOnMaxZoom: false,
      maxClusterRadius: 20,
      // 缩放比例为MAP_CONSTANT.MAX_ZOOM时不在成簇
      disableClusteringAtZoom: MAP_CONSTANT.MAX_ZOOM,
      // 样式
      // iconCreateFunction: function (cluster: any) {
      //   return L.divIcon({ html: '<b>' + cluster.getChildCount() + '</b>' });
      // }
    });
  }

  /**
   * @description: 获取markerClusters
   * @param {*}
   * @return {*}
   */
  getMarkerClusters() {
    return this.markerClusters;
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
  }

  /**
   * @description: 获取所有marker
   * @return {*}
   */
  getAllMarkers(): L.Marker[] {
    const markers: L.Marker[] = [];
    this.MAP_INSTANCE.eachLayer((layer: L.Layer) => {
      if (layer instanceof L.Marker) {
        markers.push(layer);
      }
    });
    return markers;
  }

  /**
   * @description: 根据marker获取gps信息
   * @param {*}
   * @return {*}
   */
  getGPSInfoByMarkerInstance(marker: L.Marker): IGPSInfo {
    if (!marker) {
      ElMessage.error("没有传入marker实例");
      return { GPSLatitude: 0, GPSLongitude: 0, GPSAltitude: 0 };
    }
    const { lat, lng, alt } = marker.getLatLng();
    const GPSLatitude = lat;
    const GPSLongitude = lng;
    const GPSAltitude = alt;
    return {
      GPSAltitude,
      GPSLongitude,
      GPSLatitude,
    };
  }

  /**
   * @description: 添加图片到地图中
   * @param {*} imageUrl
   * @return {*}
   */
  addImageMarkerToMap(imageInfo: IImageInfo) {
    const mapStore = useMapStore()
    const myIcon = this.createImageMarkerIcon(imageInfo);
    if (imageInfo.GPSInfo.GPSLatitude && imageInfo.GPSInfo.GPSLongitude) {
      const isExist = mapStore.getVisibleMarkerIdList.some(
        (markerId: string) => {
          return markerId === imageInfo.id;
        }
      );
      if (!isExist) {
        // 如果还没有需要新建，传参先纬度再经度
        const marker = L.marker(
          [imageInfo.GPSInfo.GPSLatitude, imageInfo.GPSInfo.GPSLongitude],
          {
            icon: myIcon,
            title: imageInfo.name,
            type: "image",
            riseOnHover: true,
            id: imageInfo.id,
          }
        );
        this.markerClusters.addLayer(marker);
        // 添加聚合组到地图
        this.MAP_INSTANCE.addLayer(this.markerClusters);
        // marker.addTo(map)
        // 添加id到store中
        mapStore.addMarkerId(imageInfo.id);
      } else {
        // 如果已经有了就复用
        const markerId = mapStore.getVisibleMarkerIdList.find(
          (markerId: string) => {
            return markerId === imageInfo.id;
          }
        );
        const marker = this.getMarkerById(markerId);
        marker?.setIcon(myIcon);
      }
    }
  }

  /**
   * @description: 添加分组到地图中
   * @param {*} map
   * @param {*} groupInfo
   * @return {*}
   */
  async addGroupMarkerToMap(groupInfo: IGroupInfo) {
    const GPSInfo = groupInfo.GPSInfo;
    // 定位无效，直接不加
    if (!GPSInfoLegality(GPSInfo)) {
      return;
    }
    const map = this.MAP_INSTANCE;
    const mapStore = useMapStore();
    let myIcon = await this.createGroupMarkerIcon(groupInfo);
    // 先纬度再经度
    const marker = L.marker([GPSInfo.GPSLatitude, GPSInfo.GPSLongitude], {
      icon: myIcon,
      title: groupInfo.name,
      type: "group",
      riseOnHover: true,
      id: groupInfo.id,
    });
    marker.addTo(map);
    // 因为涉及到异步请求数据了，所以这里需要手动添加一下鼠标事件
    this.markerMouseListener(marker);
    // 添加到store中
    mapStore.addMarkerId(groupInfo.id);
  }

  /**
   * @description: 创建L.Icon实例，用于marke渲染
   * @param {IImageInfo} imageInfo
   * @return {*}
   */
  createImageMarkerIcon(imageInfo: IImageInfo): L.Icon {
    let myIcon;
    let imageUrl = imageInfo.url ?? getImageUrl(imageInfo.id);
    // 如果没有url直接用文字名称代替
    if (!imageUrl) {
      myIcon = L.divIcon({
        html: IconHTMLFactory.createIcon(IconType.NoImage, imageInfo.name),
        iconSize: MARKER_CONSTANT.IMAGE_MARKER_SIZE,
        iconAnchor: [
          MARKER_CONSTANT.IMAGE_MARKER_SIZE[0] / 2,
          imageMarkerTranslateY,
        ], // 设置锚点为底部中心
      });
    } else {
      myIcon = L.divIcon({
        // 传值使用
        iconUrl: imageUrl,
        html: IconHTMLFactory.createIcon(IconType.SingleImage, imageUrl),
        iconSize: MARKER_CONSTANT.IMAGE_MARKER_SIZE,
        iconAnchor: [
          MARKER_CONSTANT.IMAGE_MARKER_SIZE[0] / 2,
          imageMarkerTranslateY,
        ], // 设置锚点为底部中心
      });
    }
    return myIcon;
  }

  /**
   * @description: 通过图片id添加已有的图片到地图，并修改visibleMarkerIdList
   * @param {*} imageId
   * @return {*}
   */
  addExistImageMarkerToMapById(imageId: string) {
    const schemaStore = useSchemaStore();
    const mapStore = useMapStore();
    // 如果本来没有
    if (!mapStore.visibleMarkerIdList.includes(imageId)) {
      const imageInfo = schemaStore?.getSchema?.imageInfo?.filter?.(
        (item: IImageInfo) => item.id === imageId
      )[0];
      if (imageInfo) {
        this.addImageMarkerToMap(imageInfo);
      } else {
        console.error("不存在图片信息");
        return;
      }
      // 用这个方法，有些特殊操作
      this.addVisibleMarkerById(imageId);
    } else {
      this.showMarkerById(imageId);
    }
  }

  /**
   * @description: 添加可移动的图片marker
   * @param {*} imageInfo
   * @return {*}
   */
  addManualLocateImageMarkerToMap(
    imageInfo: IImageInfo,
    lat?: number,
    Lng?: number
  ) {
    // 先判断一下是不是有marker了
    const marker1 = this.getMarkerById(imageInfo.id);
    if (marker1) {
      // 定位到这个marker
      this.setViewByMarkerId(imageInfo.id);
      ElMessage.warning("节点已存在！，请编辑已有节点");
      return;
    }
    const map = this.MAP_INSTANCE;
    const myIcon = this.createImageMarkerIcon(imageInfo);
    // 地图中心
    const markerLatLng =
      lat && Lng ? [lat, Lng] : [map.getCenter().lat, map.getCenter().lng];
    const marker = L.marker(markerLatLng, {
      icon: myIcon,
      title: imageInfo.name,
      type: "temporary-image",
      riseOnHover: true,
      id: imageInfo.id,
      draggable: true,
    });
    marker.addTo(map);
    this.markerMouseListener(marker);
    return marker;
  }

  /**
   * @description: 添加可移动的分组marker
   * @param {*} groupInfo
   * @return {*}
   */
  async addManualLocateGroupMarkerToMap(
    groupInfo: INewGroupFormData,
    lat?: number,
    Lng?: number
  ) {
    // 先判断一下是不是有marker了
    const marker1 = this.getMarkerById(groupInfo.id);
    if (marker1) {
      // 定位到这个marker
      this.setViewByMarkerId(groupInfo.id);
      ElMessage.warning("节点已存在！，请编辑已有节点");
      return;
    }
    const map = this.MAP_INSTANCE;
    const myIcon = await this.createGroupMarkerIcon(groupInfo);
    // 地图中心
    const markerLatLng =
      lat && Lng ? [lat, Lng] : [map.getCenter().lat, map.getCenter().lng];
    const marker = L.marker(markerLatLng, {
      icon: myIcon,
      title: groupInfo.name,
      type: "temporary-group",
      riseOnHover: true,
      id: groupInfo.id,
      draggable: true,
    });
    marker.addTo(map);
    this.markerMouseListener(marker);
    return marker;
  }

  /**
   * @description: 删除地图中的marker
   * @param {*} marker
   * @return {*}
   */
  deleteMarkerInMap(marker: L.Marker) {
    const map = this.MAP_INSTANCE;
    const mapStore = useMapStore();
    if (map && marker) {
      // 删除聚合组中的节点
      this.markerClusters.removeLayer(marker);
      // 删除地图中的节点
      map.removeLayer(marker);
      mapStore.deleteMarker(marker?.options?.id);
    }
  }

  /**
   * @description: 根据markerId删除地图中的marker
   * @param {*} markerId
   * @param {*} map
   * @return {*}
   */
  deleteMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId);
    this.deleteMarkerInMap(marker);
  }

  /**
   * @description: 隐藏marker
   * @param {*} markerId
   * @param {*} map
   * @return {*}
   */
  hiddenMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId);
    if (marker) {
      marker.setOpacity(0);
    }
  }

  /**
   * @description: 显示marker
   * @param {string} markerId
   * @return {*}
   */
  showMarkerById(markerId: string) {
    const marker = this.getMarkerById(markerId);
    if (marker) {
      marker.setOpacity(1);
    }
  }

  /**
   * @description: 簇点击事件，更新图片需要图片移动或缩放，有时候点击簇不会发生地图缩放
   * ，导致图片不会加载，所有在点击时手动出发可视marker的更新
   * @return {*}
   */
  observeClisterClick() {
    const _this = this;
    this.markerClusters.on("clusterclick", function (a: any) {
      // a.layer is actually a cluster
      setTimeout(() => {
        _this.updateVisibleMarkers();
      }, 100);
    });
  }

  /**
   * @description: 根据markerId设置地图中心
   * @param {string} markerId
   * @return {*}
   */
  setViewByMarkerId(id: string) {
    if (!id) {
      return
    }

    let marker = this.getMarkerById(id)
    // 如果不存在，那可能是在分组里面，这时候需要跳转到第一个分组位置
    if (!marker) {
      const groupId = getGroupIdsByImageId(id)?.[0]
      groupId && (marker = this.getMarkerById(groupId))
    }
    // 这时候还存在就直接返回，说明没这节点
    if (!marker) {
      return
    }
    const { lat, lng } = marker?.getLatLng()
    mapService.setViewByLatLng(lat, lng)
  }

  /**
   * @description: 创建L.Icon实例，用于marke渲染
   * @param {INewGroupFormData} groupInfo
   * @return {*}
   */
  async createGroupMarkerIcon(groupInfo: INewGroupFormData): L.Icon {
    let myIcon = null;
    const groupNumbers = groupInfo.groupNumbers;
    // 如果没有url直接用文字名称代替
    if (groupNumbers && groupNumbers.length > 0) {
      // 请求前几张图片，并保存到
      console.log("groupInfo---", groupInfo);
      // 先只获取前4张图片
      const resImageUrls = await getImageUrlByIds(
        groupInfo.groupNumbers!.slice(0, GROUP_CONSTANT.GROUP_COVER_NUMBER)
      );
      if (!resImageUrls || resImageUrls.length === 0) {
        ElMessage.error("获取图片失败");
        return;
      }
      const imageUrls = resImageUrls.map((item) => {
        return item;
      });
      myIcon = L.divIcon({
        // 传值使用
        imageUrls,
        html: IconHTMLFactory.createIcon(IconType.MultiImage, imageUrls),
        iconSize: MARKER_CONSTANT.GROUP_MARKER_SIZE,
        iconAnchor: [
          MARKER_CONSTANT.GROUP_MARKER_SIZE[0] / 2,
          groupMarkerTranslateY,
        ],
      });
    } else {
      myIcon = L.divIcon({
        html: IconHTMLFactory.createIcon(IconType.NoImageGroup, groupInfo.name),
        iconSize: MARKER_CONSTANT.GROUP_MARKER_SIZE,
        iconAnchor: [
          MARKER_CONSTANT.GROUP_MARKER_SIZE[0] / 2,
          groupMarkerTranslateY,
        ],
      });
    }
    return myIcon;
  }

  /**
   * @description: 根据id获取地图中的marker
   * @param {*} markerId
   * @param {*} map 地图实例
   * @return {*}
   */
  getMarkerById(markerId: string): L.Marker {
    let foundMarker;
    const markerClusters = markerService.getMarkerClusters()
    // 先遍历聚合组
    markerClusters.getLayers().forEach((layer: L.Marker) => {
      if (layer instanceof L.Marker && layer.options.id === markerId) {
        foundMarker = layer;
      }
    })
    // 没有再遍历地图上的节点
    !foundMarker && this.MAP_INSTANCE.eachLayer?.(layer => {
      if (layer instanceof L.Marker && layer.options.id === markerId) {
        foundMarker = layer;
      }
    });
    return foundMarker;
  }


  /**
   * @description: 添加可视marker到store，并且更新实例，实现左键右键等功能
   * @param {*} markerId
   * @param {*} map
   * @return {*}
   */
  addVisibleMarkerById(markerId: string) {
    const mapStore = useMapStore()
    mapStore.addVisibleMarkerId(markerId);
    const marker = this.getMarkerById(markerId);
    // 鼠标事件监听
    this.markerMouseListener(marker);
  }

  /**
   * @description: 判断marker是否在聚合组中
   * @param {L.Marker} marker
   * @return {boolean}
   */
  isMarkerInCluster(marker: L.Marker): boolean {
    let isMarkerInClusters = false;
    if (!marker._mapToAdd && !marker._map) {
      isMarkerInClusters = true
    }
    return isMarkerInClusters
  }

  /**
   * @description: 更新在可视范围内marker的图片,防抖
   * @param {*} map
   * @return {*}
   */
  updateVisibleMarkers() {
    const mapStore = useMapStore()
    const visibleMarkerIdList = mapStore.getVisibleMarkerIdList;
    const getMarkerIdList = mapStore.getMarkerIdList;
    getMarkerIdList.forEach((markerId: string) => {
      const marker = this.getMarkerById(markerId);
      if (marker && this.isMarkerInView(marker)) {
        if (!visibleMarkerIdList.includes(markerId)) {
          if (marker.options.type === "image") {
            // 更新一下marker
            this.updateImageMarker(marker);
          }
          if (marker.options.type === "group") {
            // 更新分组的图片
            this.updateGroupMarker(marker);
          }
          this.addVisibleMarkerById(markerId);
        }
      }
    });
  }

  /**
   * @description: 更新单个marker，用于渲染图片等
   * @param {*} id
   * @param {*} newMarkerData
   * @return {*}
   */
  async updateImageMarker(marker: L.Marker) {
    const isMarkerInCluster = this.isMarkerInCluster(marker);
    if (isMarkerInCluster) {
      return
    }
    const mapStore = useMapStore()
    // 将marker添加到已经渲染的store中
    const index = mapStore.getVisibleMarkerIdList.findIndex(
      (markerId: string) => markerId === marker.options.id
    );
    // 判断是否在schema中
    const isInSchema = judgeHadUploadImage(marker.options.id);
    if (index === -1 && marker?.options?.divIcon?.options?.iconUrl) {
      // 如果本身就有照片了，那就不用请求图片了（这种情况出现在获取图片后手动上传时，此时已有图片）
      return;
    }
    // move地图后请求图片数据
    if (index === -1 && isInSchema) {
      const fileUrl = await getImageUrlById(marker.options.id);
      if (!fileUrl || fileUrl === "") {
        // 如果没有请求成功需要先删除掉
        mapStore.deleteVisbleMarkerId(marker.options.id);
        return;
      }
      const myIcon = L.divIcon({
        html: IconHTMLFactory.createIcon(IconType.SingleImage, fileUrl),
        // 传值使用
        iconUrl: fileUrl,
        iconSize: MARKER_CONSTANT.IMAGE_MARKER_SIZE,
        iconAnchor: [
          MARKER_CONSTANT.IMAGE_MARKER_SIZE[0] / 2,
          imageMarkerTranslateY,
        ], // 设置锚点为底部中心
      });
      marker.setIcon(myIcon);
    }
  }

  /**
   * @description: 更新分组marker的图片
   * @param {*}
   * @return {*}
   */
  updateGroupMarker(marker: L.Marker) {
    const mapStore = useMapStore()
    // 将marker添加到已经渲染的store中
    const index = mapStore.getVisibleMarkerIdList.findIndex(
      (markerId: string) => markerId === marker.options.id
    );
    console.log("marker---", marker);
    // 判断是否在schema中
    const isInSchema = judgeHadUploadImage(marker.options.id);
    if (index === -1 && marker?.options?.divIcon?.options?.iconUrl) {
      // 如果本身就有照片了，那就不用请求图片了（这种情况出现在获取图片后手动上传时，此时已有图片）
      return;
    }
    if (index === -1 && isInSchema) {
    }
  }

  /**
   * @description: 判断当前marker是否在地图可视范围内
   * @param {*} marker marker实例
   * @return {*}
   */
  isMarkerInView(marker: L.Marker) {
    // 获取地图的可视范围
    const bounds = this.MAP_INSTANCE.getBounds();
    // marker.getLatLng()获取marker的经纬度
    if (!marker) {
      return false;
    }
    return bounds.contains(marker.getLatLng()) && !this.isMarkerInCluster(marker);
  }

  /**
   * @description: 添加鼠标事件监听
   * @param {*} marker marker实例
   * @return {*}
   */
  markerMouseListener(marker: L.Marker) {
    // 添加点击事件监听，这里的mouseEvent的target中有marker信息
    marker.on("click", (event: MouseEvent) => {
      // ElMessage.success('触发Marker点击事件')
      // 点击节点后弹出图片详情框
      eventBus.emit("show-image-data", event);
    });
    // 添加右击时间监听
    marker.on("contextmenu", (event: MouseEvent) => {
      // ElMessage.success('触发Marker右键事件')
      // 出现右键菜单
      eventBus.emit("show-content-menu", event);
    });
    // 高亮
    marker.on("mouseover", () => {
      this.highlightMarker(marker);
    });
    // 取消高亮
    marker.on("mouseout", () => {
      this.resetMarker(marker);
    });
  }

  /**
   * @description: 高亮marker
   * @param {*}
   * @return {*}
   */
  highlightMarker(marker: L.Marker) {
    const markerElement = marker.getElement();
    if (markerElement) {
      const oldTransformCss = markerElement.style.transform;
      let newTransformCss = "";
      if (oldTransformCss.includes("scale")) {
        newTransformCss = oldTransformCss
          .replace(
            /scale\([^)]*\)/,
            `scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`
          )
          .trim();
      } else {
        newTransformCss = `${oldTransformCss} scale(${MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO})`;
      }
      markerElement.style.transform = newTransformCss;
    }
  }

  /**
   * @description: 重置marker
   * @param {*}
   * @return {*}
   */
  resetMarker(marker: L.Marker) {
    const markerElement = marker.getElement();
    if (markerElement) {
      const oldTransformCss = markerElement.style.transform;
      const newTransformCss = oldTransformCss
        .replace(
          /scale\([^)]*\)/,
          `scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`
        )
        .trim();
      markerElement.style.transform = newTransformCss;
    }
  }

  /**
   * @description: 重置分组的封面
   * @param {*} groupId
   * @return {*}
   */
  async resetIconGroupMarker(groupId: string) {
    const groupMarker = this.getMarkerById(groupId);
    const groupInfo = getGroupInfoByGroupId(groupId);
    let newIcon = await this.createGroupMarkerIcon(groupInfo);
    groupMarker && groupMarker.setIcon(newIcon);
  }

  /**
   * @description: 获取固定marker的type
   * @param {string} markerType
   * @return {*}
   */
  getPermanentType(markerType: string) {
    return markerType.replace("temporary-", "");
  }

  /**
   * @description: 获取临时marker的type
   * @param {string} markerType
   * @return {*}
   */
  getTemporaryType(markerType: string) {
    if (markerType.includes("temporary-")) {
      return markerType;
    }
    return `temporary-${markerType}`;
  }

  /**
   * @description: 根据地图缩放比例适当缩放marker
   * @param {*} map
   * @return {*}
   */
  scaleMarkerByMap() {
    const map = this.MAP_INSTANCE;
    const mapStore = useMapStore()
    const markerIdList = mapStore.getMarkerIdList;
    const zoom = map.getZoom();

    if (zoom >= 15) {
      MARKER_CONSTANT.MARKER_SHOW_RADIO = 1.1;
      MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO = 1.2;
    } else if (zoom < 15 && zoom >= 13) {
      MARKER_CONSTANT.MARKER_SHOW_RADIO = 1;
      MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO = 1.1;
    } else if (zoom < 13 && zoom >= 11) {
      MARKER_CONSTANT.MARKER_SHOW_RADIO = 0.9;
      MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO = 1;
    } else if (zoom < 11 && zoom >= 9) {
      MARKER_CONSTANT.MARKER_SHOW_RADIO = 0.8;
      MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO = 0.9;
    } else if (zoom < 9 && zoom >= 6) {
      MARKER_CONSTANT.MARKER_SHOW_RADIO = 0.7;
      MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO = 0.8;
    } else if (zoom < 6) {
      MARKER_CONSTANT.MARKER_SHOW_RADIO = 0.6;
      MARKER_CONSTANT.MARKER_HOVER_SHOW_RADIO = 0.7;
    }
    console.log("zoom", zoom, MARKER_CONSTANT.MARKER_SHOW_RADIO);
    markerIdList.forEach((markerId: string) => {
      const marker = this.getMarkerById(markerId);
      const markerElement = marker.getElement();
      if (markerElement) {
        const originalTransform =
          window.getComputedStyle(markerElement).transform;
        const newTransform =
          originalTransform.replace(/scale\([^)]*\)/, "").trim() +
          ` scale(${MARKER_CONSTANT.MARKER_SHOW_RADIO})`;
        markerElement.style.transform = newTransform;
      }
    });
  }

  /**
   * @description: 获取marker的GPS信息
   * @param {string} markerId
   * @param {*} map
   * @return {*}
   */
  getGPSInfoById(markerId: string) {
    const marker = this.getMarkerById(markerId);
    return this.getGPSInfoByMarkerInstance(marker);
  }
}

const markerService = new MarkerService();

export default markerService;
